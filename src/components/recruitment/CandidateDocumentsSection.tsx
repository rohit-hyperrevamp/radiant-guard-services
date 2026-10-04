import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/ConfirmProvider";
import { Button } from "@/components/ui/button";
import { logActivity } from "@/lib/activity-log";
import {
  addEvent,
  fetchCandidateDocuments,
  openCandidateDocument,
  QK,
  REC_DOCUMENT_CATEGORIES,
  REC_MODULE,
  removeCandidateDocument,
  uploadCandidateDocument,
  type RecCandidate,
  type RecCandidateDocumentCategory,
} from "@/lib/recruitment";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_FILES = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp";

const fileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function CandidateDocumentsSection({ candidate }: { candidate: RecCandidate }) {
  const qc = useQueryClient();
  const inputRefs = useRef<Partial<Record<RecCandidateDocumentCategory, HTMLInputElement | null>>>({});
  const [busyCategory, setBusyCategory] = useState<RecCandidateDocumentCategory | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const documentsQ = useQuery({
    queryKey: QK.documents(candidate.id),
    queryFn: () => fetchCandidateDocuments(candidate.id),
  });

  async function upload(category: RecCandidateDocumentCategory, files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (selected.some((file) => file.size > MAX_FILE_BYTES)) {
      toast.error("Each document must be 10 MB or smaller");
      return;
    }
    setBusyCategory(category);
    try {
      for (const file of selected) {
        const saved = await uploadCandidateDocument(candidate.id, category, file);
        void logActivity({
          module: REC_MODULE,
          action: "upload",
          entityType: "rec_candidate_documents",
          entityId: saved.id,
          entityLabel: `${candidate.code} · ${file.name}`,
          details: { category },
        });
      }
      await addEvent(candidate.id, "documents_uploaded", `${selected.length} supporting document${selected.length === 1 ? "" : "s"} uploaded`);
      await qc.invalidateQueries({ queryKey: QK.documents(candidate.id) });
      await qc.invalidateQueries({ queryKey: QK.candidate(candidate.id) });
      toast.success(`${selected.length} document${selected.length === 1 ? "" : "s"} uploaded`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusyCategory(null);
      const input = inputRefs.current[category];
      if (input) input.value = "";
    }
  }

  async function remove(document: Awaited<ReturnType<typeof fetchCandidateDocuments>>[number]) {
    const confirmed = await confirmAction({
      title: "Remove document?",
      description: `${document.file_name} will be permanently removed from this candidate's record.`,
      confirmText: "Remove document",
      cancelText: "Keep document",
      destructive: true,
      tone: "warning",
    });
    if (!confirmed) return;
    setRemovingId(document.id);
    try {
      await removeCandidateDocument(document);
      await addEvent(candidate.id, "document_removed", document.file_name);
      void logActivity({
        module: REC_MODULE,
        action: "delete",
        entityType: "rec_candidate_documents",
        entityId: document.id,
        entityLabel: `${candidate.code} · ${document.file_name}`,
        details: { category: document.category },
      });
      await qc.invalidateQueries({ queryKey: QK.documents(candidate.id) });
      toast.success("Document removed");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="font-display text-sm font-semibold">Miscellaneous documents</h2>
        <p className="mt-1 text-xs text-muted-foreground">Optional supporting documents collected by the recruiter.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {REC_DOCUMENT_CATEGORIES.map((category) => {
          const documents = (documentsQ.data ?? []).filter((document) => document.category === category.key);
          const isBusy = busyCategory === category.key;
          return (
            <div key={category.key} className="min-w-0 rounded-lg border border-border/70 p-3">
              <div className="flex min-h-8 items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">{category.label}</h3>
                  <p className="text-[11px] text-muted-foreground">Optional{category.multiple ? " · multiple files allowed" : ""}</p>
                </div>
                <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" disabled={isBusy} onClick={() => inputRefs.current[category.key]?.click()} aria-label={`Upload ${category.label}`} title={`Upload ${category.label}`}>
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
                <input
                  ref={(node) => { inputRefs.current[category.key] = node; }}
                  type="file"
                  className="hidden"
                  accept={ACCEPTED_FILES}
                  multiple={category.multiple}
                  onChange={(event) => void upload(category.key, event.target.files)}
                />
              </div>
              {documents.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">No document uploaded</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {documents.map((document) => (
                    <li key={document.id} className="flex min-w-0 items-center gap-2 rounded-md bg-muted/40 px-2 py-2">
                      <FileText className="h-4 w-4 shrink-0 text-accent" />
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openCandidateDocument(document.file_path).catch((error) => toast.error(error.message))}>
                        <span className="block truncate text-xs font-medium">{document.file_name}</span>
                        <span className="block text-[11px] text-muted-foreground">{fileSize(Number(document.file_size) || 0)}</span>
                      </button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => openCandidateDocument(document.file_path).catch((error) => toast.error(error.message))} aria-label={`Open ${document.file_name}`} title="Open document">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" disabled={removingId === document.id} onClick={() => void remove(document)} aria-label={`Remove ${document.file_name}`} title="Remove document">
                        {removingId === document.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      {documentsQ.isError && <p className="text-sm text-destructive">Could not load the candidate documents.</p>}
    </section>
  );
}