import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TrainingDocument } from "@/lib/training-library";

export function TrainingPreview({ document, onClose }: { document: TrainingDocument | null; onClose: () => void }) {
  const url = useQuery({
    queryKey: ["training-preview", document?.id], enabled: !!document, staleTime: 5 * 60_000, gcTime: 5 * 60_000,
    queryFn: async () => {
      if (!document) throw new Error("Choose a document");
      const { data, error } = await supabase.storage.from("training").createSignedUrl(document.file_path, 600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return <Dialog open={!!document} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="h-[90dvh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-6xl" aria-describedby={undefined}>
      <DialogHeader className="pr-10"><DialogTitle>{document?.title}</DialogTitle>
        {url.data && <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={() => window.open(url.data, "_blank", "noopener,noreferrer")}><ExternalLink className="mr-2 h-4 w-4" />Open PDF</Button>}
      </DialogHeader>
      {url.isPending ? <div className="grid place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        : url.isError ? <div className="grid place-items-center"><div><p>Could not open this guide.</p><Button onClick={() => void url.refetch()}>Try again</Button></div></div>
        : <iframe src={`${url.data}#toolbar=1&navpanes=0&view=FitH`} title={document?.title} className="h-full min-h-0 w-full rounded-lg border" />}
    </DialogContent>
  </Dialog>;
}