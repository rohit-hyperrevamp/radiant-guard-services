import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentPermissions } from "@/lib/rbac";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFileViewer } from "@/components/FileViewer";
import { useHasSupabaseSession } from "@/lib/supabase-ready";

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const BUCKET = "contract-copies";
const SIGN_TTL = 300; // short-lived link: the copy is client pricing
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
  review_period: string | null;
};

/** The client rate card / signed copy this contract was reviewed against (contract_copies, private bucket). */
export function ContractCopySection({ contractId }: { contractId: string }) {
  const session = useHasSupabaseSession();
  const viewFile = useFileViewer();
  const qc = useQueryClient();
  const { canSub, isSuperAdmin } = useCurrentPermissions();
  const canUpload = isSuperAdmin || canSub("contracts", "client_contracts", "edit");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const q = useQuery({
    queryKey: ["contract-copies", contractId],
    enabled: session && !!contractId,
    queryFn: async () => {
      const { data, error } = await db
        .from("contract_copies")
        .select("id,storage_path,file_name,sources,review_period")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const view = async (r: Row) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(r.storage_path, SIGN_TTL);
    if (error || !data) return toast.error("Could not open the contract copy");
    viewFile({ url: data.signedUrl, name: r.file_name, mime: mimeFor(r.storage_path) });
  };
  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) return toast.error("File is larger than 20 MB");
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) return toast.error("Upload a PDF, JPG or PNG");
    setUploading(true);
    try {
      const path = `uploads/${contractId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const up = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: mimeFor(file.name) });
      if (up.error) throw up.error;
      const ins = await db.from("contract_copies").insert({
        contract_id: contractId,
        storage_path: path,
        file_name: file.name,
        sources: [{ file: file.name, label: "Uploaded copy" }],
      });
      if (ins.error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw ins.error;
      }
      toast.success("Contract copy uploaded");
      await qc.invalidateQueries({ queryKey: ["contract-copies", contractId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload the contract copy");
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
        {uploading ? "Uploading…" : "Upload contract copy"}
      </Button>
    </>
  ) : null;
  const rows = q.data ?? [];
  if (q.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!rows.length)
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          No contract copy attached to this contract yet.
        </span>
        {uploadButton}
      </div>
    );
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => void view(r)}
          className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left hover:bg-muted"
        >
          <FileText className="h-5 w-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{r.file_name}</span>
            {r.sources?.length ? (
              <span className="block truncate text-xs text-muted-foreground">
                Rate card: {r.sources.map((s) => s.label).join(" · ")}
              </span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
            <Eye className="h-4 w-4" /> View
          </span>
        </button>
      ))}
      {uploadButton ? <div className="flex justify-end">{uploadButton}</div> : null}
    </div>
  );
}
