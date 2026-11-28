import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Eye, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentPermissions } from "@/lib/rbac";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFileViewer } from "@/components/FileViewer";
import { useHasSupabaseSession } from "@/lib/supabase-ready";

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const BUCKET = "attendance-cards";
const SIGN_TTL = 300; // short-lived link: the card carries employee attendance
const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const MAX_BYTES = 20 * 1024 * 1024;

function mimeFor(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "xlsx" || ext === "xlsm")
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "xls") return "application/vnd.ms-excel";
  if (ext === "csv") return "text/csv";
  return "application/pdf";
}

type Source = { file: string; label: string };
type Row = {
  id: string;
  storage_path: string;
  file_name: string;
  sources: Source[] | null;
  check_status: string | null;
  check_summary: { people?: number; duties?: number } | null;
};

/** The client attendance card this sheet was checked against (attendance_card_copies, private bucket). */
export function AttendanceCardSection({
  unitId,
  periodStart,
  periodEnd,
}: {
  unitId: string;
  periodStart: string;
  periodEnd: string;
}) {
  const session = useHasSupabaseSession();
  const viewFile = useFileViewer();
  const qc = useQueryClient();
  const { canAction, isSuperAdmin } = useCurrentPermissions();
  const canUpload = isSuperAdmin || canAction("attendance", "upload", "edit");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const qk = ["attendance-card-copies", unitId, periodStart, periodEnd];
  const q = useQuery({
    queryKey: qk,
    enabled: session && !!unitId && !!periodStart && !!periodEnd,
    queryFn: async () => {
      const { data, error } = await db
        .from("attendance_card_copies")
        .select("id,storage_path,file_name,sources,check_status,check_summary")
        .eq("unit_id", unitId)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const view = async (r: Row) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(r.storage_path, SIGN_TTL);
    if (error || !data) return toast.error("Could not open the attendance card");
    viewFile({ url: data.signedUrl, name: r.file_name, mime: mimeFor(r.storage_path) });
  };
  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) return toast.error("File is larger than 20 MB");
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) return toast.error("Upload a PDF, JPG or PNG");
    setUploading(true);
    try {
      const path = `uploads/${unitId}/${periodStart}_${periodEnd}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const up = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: mimeFor(file.name) });
      if (up.error) throw up.error;
      const ins = await db.from("attendance_card_copies").insert({
        unit_id: unitId,
        period_start: periodStart,
        period_end: periodEnd,
        storage_path: path,
        file_name: file.name,
        sources: [{ file: file.name, label: "Uploaded card" }],
      });
      if (ins.error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw ins.error;
      }
      toast.success("Attendance card uploaded");
      await qc.invalidateQueries({ queryKey: qk });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload the attendance card");
    } finally {
      setUploading(false);
    }
  };
  const uploadButton = canUpload ? (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? "Uploading…" : "Upload attendance card"}
      </Button>
    </>
  ) : null;
  const rows = q.data ?? [];
  return (
    <div className="rounded-xl border border-border/60 bg-card p-2.5 print:hidden sm:p-3">
      <div className="mb-2 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Attendance card
        </span>
      </div>
      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !rows.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            No attendance card attached for this period yet.
          </span>
          {uploadButton}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => void view(r)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left hover:bg-muted"
            >
              {r.check_status === "match" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <ClipboardList className="h-5 w-5 shrink-0 text-primary" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.file_name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.check_status === "match"
                    ? `Matches this sheet${r.check_summary?.people ? ` · ${r.check_summary.people} people` : ""}${r.check_summary?.duties != null ? ` · ${r.check_summary.duties} duties` : ""}`
                    : r.sources?.length
                      ? r.sources.map((s) => s.label).join(" · ")
                      : "Attendance card"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                <Eye className="h-4 w-4" /> View attendance
              </span>
            </button>
          ))}
          {uploadButton ? <div className="flex justify-end">{uploadButton}</div> : null}
        </div>
      )}
    </div>
  );
}
