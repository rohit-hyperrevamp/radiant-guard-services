import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Download, ExternalLink, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type FileItem = { url: string; name: string; mime?: string | null };

const Ctx = createContext<(f: FileItem) => void>(() => {});

/** Opens images, PDFs and spreadsheets inside the app so stored documents can be viewed any time. */
export function useFileViewer() {
  return useContext(Ctx);
}

export function isPdfFile(f: { url: string; name?: string; mime?: string | null }) {
  return (
    f.mime === "application/pdf" ||
    /\.pdf(\?|$)/i.test(f.name ?? "") ||
    /\.pdf(\?|$)/i.test(f.url.split("?")[0])
  );
}
export function isImageFile(f: { url: string; name?: string; mime?: string | null }) {
  return (
    (f.mime ?? "").startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|heic|bmp)$/i.test(f.name ?? f.url.split("?")[0])
  );
}

export function isSpreadsheetFile(f: { url: string; name?: string; mime?: string | null }) {
  const m = f.mime ?? "";
  return (
    /spreadsheetml|ms-excel|text\/csv/i.test(m) ||
    /\.(xlsx|xlsm|xls|csv)$/i.test(f.name ?? "") ||
    /\.(xlsx|xlsm|xls|csv)(\?|$)/i.test(f.url.split("?")[0])
  );
}

/** Shows an Excel / CSV file as a table inside the viewer (no download needed). */
function SpreadsheetPreview({ url }: { url: string }) {
  const [sheets, setSheets] = useState<{ name: string; rows: (string | number)[][] }[] | null>(
    null,
  );
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setSheets(null);
    setError(null);
    setActive(0);
    (async () => {
      try {
        const [XLSX, res] = await Promise.all([import("xlsx"), fetch(url)]);
        if (!res.ok) throw new Error(`Could not load the file (${res.status})`);
        const wb = XLSX.read(await res.arrayBuffer(), { type: "array" });
        const out = wb.SheetNames.filter(
          (n) => !wb.Workbook?.Sheets?.find((x) => x.name === n)?.Hidden,
        ).map((n) => ({
          name: n,
          rows: XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[n], {
            header: 1,
            raw: false,
            blankrows: false,
            defval: "",
          }),
        }));
        if (alive) setSheets(out);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not read this spreadsheet");
      }
    })();
    return () => {
      alive = false;
    };
  }, [url]);
  if (error)
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        {error}. Use Download or New tab.
      </div>
    );
  if (!sheets)
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">Loading spreadsheet…</div>
    );
  const sheet = sheets[active];
  const width = Math.max(0, ...(sheet?.rows ?? []).map((r) => r.length));
  return (
    <div>
      {sheets.length > 1 && (
        <div className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-background p-1.5">
          {sheets.map((sh, i) => (
            <Button
              key={sh.name}
              size="sm"
              variant={i === active ? "default" : "ghost"}
              onClick={() => setActive(i)}
            >
              {sh.name}
            </Button>
          ))}
        </div>
      )}
      <table className="min-w-full border-collapse bg-background text-xs">
        <tbody>
          {(sheet?.rows ?? []).map((r, ri) => (
            <tr key={ri}>
              {Array.from({ length: width }, (_, ci) => (
                <td
                  key={ci}
                  className="whitespace-nowrap border border-border px-1.5 py-0.5 align-top"
                >
                  {r[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FileViewerProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<FileItem | null>(null);
  const [zoom, setZoom] = useState(1);
  const open = useCallback((f: FileItem) => {
    setZoom(1);
    setFile(f);
  }, []);
  const sheet = file ? isSpreadsheetFile(file) : false;
  const pdf = file ? !sheet && isPdfFile(file) : false;
  const img = file
    ? !pdf &&
      !sheet &&
      (isImageFile(file) || file.url.startsWith("data:image") || file.url.startsWith("blob:"))
    : false;
  return (
    <Ctx.Provider value={open}>
      {children}
      <Dialog open={!!file} onOpenChange={(o) => !o && setFile(null)}>
        <DialogContent className="max-w-5xl sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{file?.name}</DialogTitle>
          </DialogHeader>
          {file && (
            <div className="space-y-2">
              <div className="flex flex-wrap justify-end gap-1.5">
                {img && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" asChild>
                  <a href={file.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-4 w-4" />
                    New tab
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={file.url} download={file.name}>
                    <Download className="mr-1 h-4 w-4" />
                    Download
                  </a>
                </Button>
              </div>
              <div className="max-h-[75vh] overflow-auto rounded-lg bg-muted/40">
                {sheet ? (
                  <SpreadsheetPreview url={file.url} />
                ) : pdf ? (
                  <iframe src={file.url} title={file.name} className="h-[75vh] w-full" />
                ) : img ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    style={{ width: `${zoom * 100}%` }}
                    className="mx-auto block max-w-none object-contain"
                  />
                ) : (
                  <div className="p-10 text-center text-sm text-muted-foreground">
                    This file type can't be previewed here. Use Download or New tab.
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
