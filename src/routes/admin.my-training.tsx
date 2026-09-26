import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronLeft, FileText, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BUCKET = "training";

type TrainingModule = {
  id: string;
  role_key: string;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  size_bytes: number;
  sort_order: number;
};

export const Route = createFileRoute("/admin/my-training")({
  ssr: false,
  component: MyTrainingPage,
});

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MyTrainingPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);

  const modulesQ = useQuery({
    queryKey: ["my-training-modules"],
    queryFn: async () => {
      const db = supabase as any;
      const { data, error } = await db
        .from("training_modules")
        .select("id, role_key, title, description, file_path, file_name, size_bytes, sort_order")
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as TrainingModule[];
    },
  });

  const modules = useMemo(() => modulesQ.data ?? [], [modulesQ.data]);
  const selected = modules.find((m) => m.id === selectedId) ?? null;

  // Auto-select the first document so the reader is never empty when docs exist.
  useEffect(() => {
    if (!selectedId && modules.length > 0) setSelectedId(modules[0].id);
  }, [modules, selectedId]);

  const loadSignedUrl = async (m: TrainingModule) => {
    setViewerLoading(true);
    setViewerError(null);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(m.file_path, 600);
      if (error) throw error;
      setSignedUrl(data.signedUrl);
    } catch (e) {
      setViewerError(e instanceof Error ? e.message : "Could not open the document.");
    } finally {
      setViewerLoading(false);
    }
  };

  useEffect(() => {
    setSignedUrl(null);
    if (selected) void loadSignedUrl(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black sm:text-2xl">Training</h1>
          <p className="truncate text-sm text-muted-foreground">
            Documents and guides for your role. Tap one to read it here.
          </p>
        </div>
      </div>

      {modulesQ.isLoading ? (
        <div className="grid flex-1 place-items-center rounded-2xl border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : modules.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-2xl border bg-card p-8 text-center">
          <div>
            <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">No training documents yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              When your team adds training material for your role, it will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Document list */}
          <div
            className={cn(
              "min-h-0 flex-col gap-2 overflow-y-auto rounded-2xl border bg-card p-3",
              selected ? "hidden lg:flex" : "flex",
            )}
          >
            {modules.map((m, i) => {
              const active = m.id === selectedId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:border-border hover:bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{m.title}</p>
                    {m.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{m.description}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      PDF{formatSize(m.size_bytes) ? ` · ${formatSize(m.size_bytes)}` : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* In-app reader */}
          <div
            className={cn(
              "min-h-0 flex-col overflow-hidden rounded-2xl border bg-card",
              selected ? "flex" : "hidden lg:flex",
            )}
          >
            {selected ? (
              <>
                <div className="flex items-center gap-2 border-b px-3 py-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 lg:hidden"
                    onClick={() => setSelectedId(null)}
                    aria-label="Back to document list"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{selected.title}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => void loadSignedUrl(selected)}
                    aria-label="Reload document"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <div className="relative min-h-0 flex-1 bg-muted/30">
                  {viewerLoading ? (
                    <div className="grid h-full place-items-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : viewerError ? (
                    <div className="grid h-full place-items-center p-6 text-center">
                      <div>
                        <p className="text-sm font-semibold">Couldn't open the document</p>
                        <p className="mt-1 text-xs text-muted-foreground">{viewerError}</p>
                        <Button className="mt-3" size="sm" onClick={() => void loadSignedUrl(selected)}>
                          Try again
                        </Button>
                      </div>
                    </div>
                  ) : signedUrl ? (
                    <iframe
                      key={signedUrl}
                      src={signedUrl}
                      title={selected.title}
                      className="h-full w-full border-0"
                    />
                  ) : null}
                </div>
              </>
            ) : (
              <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">
                Pick a document to start reading.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
