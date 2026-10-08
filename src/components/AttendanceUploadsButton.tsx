import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Eye, FileImage } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFileViewer } from "@/components/FileViewer";

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const BUCKET = "attendance-uploads";

/** Keeps the original uploaded attendance file so it can be compared later. */
export async function saveAttendanceUploads(unitId: string, periodStart: string, periodEnd: string, files: File[]) {
  for (const file of files) {
    try {
      const path = `${unitId}/${periodStart}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (up.error) continue;
      await db.from("attendance_uploads").insert({ unit_id: unitId, period_start: periodStart, period_end: periodEnd, path, file_name: file.name, mime: file.type || null });
    } catch {
      /* saving the original must never block reading the sheet */
    }
  }
}

type Row = { id: string; path: string; file_name: string; mime: string | null; created_at: string; period_start: string | null };

export function AttendanceUploadsButton({ unitId, periodStart }: { unitId: string; periodStart: string }) {
  const [open, setOpen] = useState(false);
  const viewFile = useFileViewer();
  const q = useQuery({
    queryKey: ["attendance-uploads", unitId, periodStart],
    queryFn: async () => {
      const { data, error } = await db.from("attendance_uploads").select("id,path,file_name,mime,created_at,period_start").eq("unit_id", unitId).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const rows = q.data ?? [];
  const thisPeriod = rows.filter((r) => r.period_start === periodStart);
  const older = rows.filter((r) => r.period_start !== periodStart);
  const view = async (r: Row) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(r.path, 3600);
    if (error || !data) return toast.error("Could not open file");
    viewFile({ url: data.signedUrl, name: r.file_name, mime: r.mime });
  };
  const list = (items: Row[]) => items.map((r) => (
    <button key={r.id} type="button" onClick={() => view(r)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted">
      <FileImage className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{r.file_name}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{format(new Date(r.created_at), "dd MMM, h:mm a")}</span>
      <Eye className="h-4 w-4 shrink-0 text-primary" />
    </button>
  ));
  return (
    <>
      <Button variant="outline" className="h-10 min-w-0 rounded-xl px-3 text-sm" onClick={() => { setOpen(true); void q.refetch(); }}>
        <Eye className="mr-2 h-4 w-4 shrink-0" />
        <span className="truncate">Uploaded sheets{thisPeriod.length ? ` (${thisPeriod.length})` : ""}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Uploaded attendance sheets</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">This period</div>
              {thisPeriod.length ? list(thisPeriod) : <div className="px-2 text-sm text-muted-foreground">Nothing uploaded for this period yet.</div>}
            </div>
            {older.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Earlier periods</div>
                {list(older)}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
