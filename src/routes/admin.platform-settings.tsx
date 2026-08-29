import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareLock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";
import { PageHeader } from "@/components/PageHeader";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/platform-settings")({
  component: PlatformSettingsPage,
  head: () => ({
    meta: [
      { title: "Platform Settings | Radiant Control Center" },
      {
        name: "description",
        content:
          "Control platform-wide switches such as real SMS OTP delivery for sign-in.",
      },
      { property: "og:title", content: "Platform Settings | Radiant Control Center" },
      {
        property: "og:description",
        content:
          "Control platform-wide switches such as real SMS OTP delivery for sign-in.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const OTP_KEY = "msg91_otp_enabled";
const QK = ["admin", "platform-settings"] as const;
const MODULE = "Platform Settings";

function PlatformSettingsPage() {
  const qc = useQueryClient();

  const { data: otpEnabled = true, isLoading } = useQuery({
    queryKey: QK,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("inv_settings" as never)
        .select("value")
        .eq("key", OTP_KEY)
        .maybeSingle();
      if (error) throw error;
      const value = (data as unknown as { value?: { enabled?: boolean } } | null)?.value;
      return Boolean(value?.enabled ?? true);
    },
  });

  const toggleMut = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("inv_settings" as never)
        .upsert(
          {
            key: OTP_KEY,
            value: { enabled },
            description:
              "Controls real MSG91 OTP delivery. When disabled, users sign in with 1111; the super admin uses 2503.",
          } as never,
          { onConflict: "key" },
        );
      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => {
      void qc.invalidateQueries({ queryKey: QK });
      void logActivity({
        module: MODULE,
        action: enabled ? "enable" : "disable",
        entityType: "inv_settings",
        entityLabel: "MSG91 OTP",
        details: { key: OTP_KEY, enabled },
      });
      toast.success(
        enabled
          ? "Real OTPs enabled — users will receive an SMS code."
          : "Real OTPs disabled — users will sign in with the fallback code 1111.",
      );
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not update the setting."),
  });

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        title="Platform Settings"
        description="Platform-wide switches that change how the application behaves for every user."
        crumbs={[{ label: "Control Center", to: "/admin/control-center" }, { label: "Platform Settings" }]}
      />

      <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <MessageSquareLock className="h-5 w-5" />
            </span>
            <div>
              <Label htmlFor="msg91-toggle" className="text-[15px] font-semibold">
                MSG91 OTP (real SMS)
              </Label>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                When ON, every user receives a real 4-digit OTP over SMS through
                MSG91. When OFF, all users sign in with the fallback code{" "}
                <span className="font-semibold text-foreground">1111</span>. The
                super admin always signs in with a fixed code, regardless of this
                setting.
              </p>
            </div>
          </div>
          <Switch
            id="msg91-toggle"
            checked={otpEnabled}
            disabled={isLoading || toggleMut.isPending}
            onCheckedChange={(v) => toggleMut.mutate(v)}
          />
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-[12px] font-medium text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-accent" />
          <span>
            Status:{" "}
            {otpEnabled
              ? "Live SMS delivery via MSG91"
              : "Fallback mode — no SMS is sent"}
          </span>
        </div>
      </div>
    </div>
  );
}
