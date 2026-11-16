import { ListSkeleton } from "@/components/Skeletons";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronLeft, FileText, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrainingCategories } from "@/components/TrainingCategories";
import { ScrollingText } from "@/components/ScrollingText";
import { TRAINING_CATEGORIES, categoryDocuments } from "@/lib/training-library";
import { useHasSupabaseSession } from "@/lib/supabase-ready";
import { Input } from "@/components/ui/input";
import { matchesSearch } from "@/lib/search-match";

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
  head: () => ({ meta: [
    { title: "Department Training Library | Radiant Guard Services" },
    { name: "description", content: "Read Radiant training guides by department, including HR, payroll, finance, transport and field operations." },
    { property: "og:title", content: "Department Training Library | Radiant Guard Services" },
    { property: "og:description", content: "Department-wise training guides for Radiant teams." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MyTrainingPage() {
  const hasSession = useHasSupabaseSession();
  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);

  const modulesQ = useQuery({
    queryKey: ["my-training-modules"],
    enabled: hasSession,
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
  const category = TRAINING_CATEGORIES.find((c) => c.key === categoryKey);
  const visibleModules = useMemo(() => categoryDocuments(modules, categoryKey ?? "").filter((m) => matchesSearch(search, [m.title, m.description])), [modules, categoryKey, search]);
  const selected = modules.find((m) => m.id === selectedId) ?? null;

  const loadSignedUrl = async (m: TrainingModule, valid: () => boolean = () => true) => {
    setViewerLoading(true);
    setViewerError(null);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(m.file_path, 600);
      if (error) throw error;
      if (valid()) setSignedUrl(data.signedUrl);
    } catch (e) {
      if (valid()) setViewerError(e instanceof Error ? e.message : "Could not open the document.");
    } finally {
      if (valid()) setViewerLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setSignedUrl(null);
    if (selected) void loadSignedUrl(selected, () => active);
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selectedIndex = selected ? modules.findIndex((module) => module.id === selected.id) : -1;

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-0 w-full flex-col gap-3 overflow-hidden px-3 pb-2 pt-3 sm:h-[calc(100dvh-5rem)] sm:px-5 sm:pb-4 sm:pt-4 lg:gap-4 lg:px-6">
      <div className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3", selected && "hidden lg:grid")}>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black">Training</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">{category?.name ?? "Department library"} · {modules.length} guides</p>
        </div>
      </div>

      {category && <div className="flex flex-wrap items-center gap-3"><Button variant="outline" size="sm" onClick={() => { setCategoryKey(null); setSelectedId(null); setSearch(""); }}><ChevronLeft className="mr-1 h-4 w-4" />All categories</Button><Input aria-label="Search training guides" placeholder="Search guides" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" /></div>}
      {modulesQ.isError ? <div><p>Could not load training guides.</p><Button onClick={() => void modulesQ.refetch()}>Try again</Button></div> : !hasSession || modulesQ.isLoading ? (
        <div className="flex-1 rounded-2xl border bg-card">
          <ListSkeleton rows={6} />
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
      ) : !category ? <div className="min-h-0 flex-1 overflow-y-auto"><TrainingCategories documents={modules} onSelect={setCategoryKey} /></div> : (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-4">
          {/* Document list */}
          <div
            className={cn(
              "min-h-0 flex-col overflow-y-auto bg-card lg:gap-1.5 lg:rounded-lg lg:border lg:p-2",
              selected ? "hidden lg:flex" : "flex",
            )}
          >
            <div className="mb-2 flex items-center justify-between border-b px-1 pb-3 lg:hidden">
              <p className="text-sm font-semibold">Your documents</p>
              <p className="text-xs text-muted-foreground">{visibleModules.length} available</p>
            </div>
            {visibleModules.length === 0 && <p className="p-3 text-sm text-muted-foreground">No guides match your search.</p>}
            {visibleModules.map((m, i) => {
              const active = m.id === selectedId;
              return (
                <Button
                  key={m.id}
                  variant="ghost"
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    "h-auto w-full justify-start gap-3 rounded-lg border-0 px-2 py-3 text-left lg:py-2.5",
                    active
                      ? "bg-primary/10 hover:bg-primary/10"
                      : "hover:bg-muted/60",
                  )}
                >
                  <div
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-md text-sm font-bold",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <ScrollingText text={m.title} className="block text-sm font-semibold leading-5" />
                    {m.description ? (
                      <ScrollingText text={m.description} className="mt-0.5 block text-xs font-normal text-muted-foreground" />
                    ) : null}
                    <p className="mt-1 text-[11px] font-normal text-muted-foreground">
                      PDF{formatSize(m.size_bytes) ? ` · ${formatSize(m.size_bytes)}` : ""}
                    </p>
                  </div>
                </Button>
              );
            })}
          </div>

          {/* In-app reader */}
          <div
            className={cn(
              "min-h-0 flex-col overflow-hidden bg-card lg:rounded-lg lg:border",
              selected ? "flex" : "hidden lg:flex",
            )}
          >
            {selected ? (
              <>
                <div className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b px-1 sm:px-2 lg:px-3">
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
                    <ScrollingText text={selected.title} className="block text-sm font-semibold" />
                    <p className="text-[11px] text-muted-foreground lg:hidden">
                      Document {selectedIndex + 1} of {modules.length}
                    </p>
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
                      src={`${signedUrl}#toolbar=1&navpanes=0&view=FitH`}
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
