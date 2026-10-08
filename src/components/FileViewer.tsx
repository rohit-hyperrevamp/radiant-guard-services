import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Download, ExternalLink, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type FileItem = { url: string; name: string; mime?: string | null };

const Ctx = createContext<(f: FileItem) => void>(() => {});

/** Opens images and PDFs inside the app so stored documents can be viewed any time. */
export function useFileViewer() {
  return useContext(Ctx);
}

export function isPdfFile(f: { url: string; name?: string; mime?: string | null }) {
  return f.mime === "application/pdf" || /\.pdf(\?|$)/i.test(f.name ?? "") || /\.pdf(\?|$)/i.test(f.url.split("?")[0]);
}
export function isImageFile(f: { url: string; name?: string; mime?: string | null }) {
  return (f.mime ?? "").startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|bmp)$/i.test(f.name ?? f.url.split("?")[0]);
}

export function FileViewerProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<FileItem | null>(null);
  const [zoom, setZoom] = useState(1);
  const open = useCallback((f: FileItem) => { setZoom(1); setFile(f); }, []);
  const pdf = file ? isPdfFile(file) : false;
  const img = file ? !pdf && (isImageFile(file) || file.url.startsWith("data:image") || file.url.startsWith("blob:")) : false;
  return (
    <Ctx.Provider value={open}>
      {children}
      <Dialog open={!!file} onOpenChange={(o) => !o && setFile(null)}>
        <DialogContent className="max-w-5xl sm:max-w-5xl">
          <DialogHeader><DialogTitle className="truncate pr-8">{file?.name}</DialogTitle></DialogHeader>
          {file && (
            <div className="space-y-2">
              <div className="flex flex-wrap justify-end gap-1.5">
                {img && (<>
                  <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
                </>)}
                <Button size="sm" variant="outline" asChild><a href={file.url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />New tab</a></Button>
                <Button size="sm" variant="outline" asChild><a href={file.url} download={file.name}><Download className="mr-1 h-4 w-4" />Download</a></Button>
              </div>
              <div className="max-h-[75vh] overflow-auto rounded-lg bg-muted/40">
                {pdf ? (
                  <iframe src={file.url} title={file.name} className="h-[75vh] w-full" />
                ) : img ? (
                  <img src={file.url} alt={file.name} style={{ width: `${zoom * 100}%` }} className="mx-auto block max-w-none object-contain" />
                ) : (
                  <div className="p-10 text-center text-sm text-muted-foreground">This file type can't be previewed here. Use Download or New tab.</div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
