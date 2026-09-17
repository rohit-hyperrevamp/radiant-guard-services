import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import radiantLogo from "@/assets/radiant-logo-v2.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCurrentUserRole } from "@/lib/use-current-user-role";
import { createNotification } from "@/lib/notifications";

const SEEN_PREFIX = "radiant:welcome-seen:v1:";

type WelcomeInfo = {
  fullName: string;
  employeeCode: string;
  designation: string;
  unitLabel: string;
  managerName: string;
};

async function loadWelcomeInfo(candidateId: string): Promise<WelcomeInfo | null> {
  const { data } = await supabase
    .from("candidates")
    .select("id,full_name,employee_code,candidate_code,unit_id,reports_to,designation_id")
    .eq("id", candidateId)
    .maybeSingle();
  const me = (data as unknown) as
    | {
        full_name: string | null;
        employee_code: string | null;
        candidate_code: string | null;
        unit_id: string | null;
        reports_to: string | null;
        designation_id: string | null;
      }
    | null;
  if (!me) return null;

  const [unitRes, mgrRes, desigRes] = await Promise.all([
    me.unit_id
      ? supabase.from("units").select("name,code").eq("id", me.unit_id).maybeSingle()
      : Promise.resolve({ data: null }),
    me.reports_to
      ? supabase.from("candidates").select("full_name").eq("id", me.reports_to).maybeSingle()
      : Promise.resolve({ data: null }),
    me.designation_id
      ? supabase.from("designations").select("name").eq("id", me.designation_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const unit = (unitRes.data as unknown) as { name: string | null; code: string | null } | null;
  const mgr = (mgrRes.data as unknown) as { full_name: string | null } | null;
  const desig = (desigRes.data as unknown) as { name: string | null } | null;

  return {
    fullName: me.full_name ?? "",
    employeeCode: me.employee_code || me.candidate_code || "",
    designation: desig?.name ?? "",
    unitLabel: unit ? [unit.name, unit.code].filter(Boolean).join(" · ") : "",
    managerName: mgr?.full_name ?? "",
  };
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2 last:border-0">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-[13px] font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function WelcomeDialog() {
  const { candidateId, userId, isLoading } = useCurrentUserRole();
  const [open, setOpen] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  const seenKey = candidateId ? `${SEEN_PREFIX}${candidateId}` : "";
  const alreadySeen = React.useMemo(() => {
    if (!seenKey || typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem(seenKey) === "1";
    } catch {
      return true;
    }
  }, [seenKey]);

  const info = useQuery({
    queryKey: ["welcome-info", candidateId],
    enabled: !!candidateId && !alreadySeen && !isLoading && !dismissed,
    staleTime: Infinity,
    queryFn: () => loadWelcomeInfo(candidateId as string),
  });

  React.useEffect(() => {
    if (info.data && !alreadySeen && !dismissed) setOpen(true);
  }, [info.data, alreadySeen, dismissed]);

  const close = React.useCallback(async () => {
    setOpen(false);
    setDismissed(true);
    if (seenKey) {
      try {
        window.localStorage.setItem(seenKey, "1");
      } catch {
        /* ignore */
      }
    }
    const d = info.data;
    if (!userId || !d) return;
    const lines = [
      `Welcome aboard, ${d.fullName || "team member"}.`,
      d.employeeCode ? `Employee code: ${d.employeeCode}` : "",
      d.designation ? `Designation: ${d.designation}` : "",
      d.unitLabel ? `Home unit: ${d.unitLabel}` : "",
      d.managerName ? `Reporting officer: ${d.managerName}` : "",
    ].filter(Boolean);
    await createNotification({
      userId,
      type: "welcome",
      title: "Welcome to Radiant Guard Services",
      message: lines.join("\n"),
      entityType: "candidate",
      entityId: candidateId ?? "",
    }).catch(() => undefined);
  }, [info.data, seenKey, userId, candidateId]);

  const d = info.data;
  if (!d) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) void close(); }}>
      <DialogContent className="max-w-[420px] overflow-hidden rounded-[26px] border-border/60 p-0">
        <div className="flex flex-col items-center gap-3 bg-accent/8 px-6 pb-5 pt-7 text-center">
          <img src={radiantLogo} alt="Radiant Guard Services" className="h-12 w-auto object-contain" />
          <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
            <Sparkles className="h-3 w-3" /> Welcome
          </div>
          <h2 className="font-display text-[20px] font-bold leading-tight text-foreground">
            Welcome to Radiant Guard Services{d.fullName ? `, ${d.fullName.split(" ")[0]}` : ""}!
          </h2>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            Your account is active. Here are your posting details — you can reopen this from your notifications any time.
          </p>
        </div>
        <div className="px-6 py-4">
          <Row label="Name" value={d.fullName} />
          <Row label="Code" value={d.employeeCode} />
          <Row label="Designation" value={d.designation} />
          <Row label="Home unit" value={d.unitLabel} />
          <Row label="Reporting officer" value={d.managerName} />
        </div>
        <div className="px-6 pb-6">
          <Button className="w-full" onClick={() => void close()}>
            Let’s get started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
