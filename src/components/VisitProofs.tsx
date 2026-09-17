import { useQuery } from "@tanstack/react-query";
import { FileSignature, Image as ImageIcon } from "lucide-react";

import { signedProofUrl } from "@/lib/field-visits";

export function VisitProofs({ visitId, signaturePath, photoPath }: { visitId: string; signaturePath: string | null; photoPath: string | null }) {
  const proofQuery = useQuery({
    queryKey: ["field-visit-proofs", visitId, signaturePath, photoPath],
    queryFn: async () => {
      const [signatureUrl, photoUrl] = await Promise.all([signedProofUrl(signaturePath), signedProofUrl(photoPath)]);
      return { signatureUrl, photoUrl };
    },
    enabled: Boolean(signaturePath || photoPath),
    staleTime: 8 * 60_000,
  });

  if (!signaturePath && !photoPath) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {photoPath && <a href={proofQuery.data?.photoUrl ?? undefined} target="_blank" rel="noopener noreferrer" aria-label="Open client photo" className="overflow-hidden rounded-lg border border-border/60 bg-secondary/30">
        {proofQuery.data?.photoUrl ? <img src={proofQuery.data.photoUrl} alt="Client visit proof" className="h-20 w-full object-cover" loading="lazy" /> : <span className="grid h-20 place-items-center text-muted-foreground"><ImageIcon className="h-5 w-5" /></span>}
        <span className="block px-2 py-1.5 text-[10px] font-semibold text-foreground">Client photo</span>
      </a>}
      {signaturePath && <a href={proofQuery.data?.signatureUrl ?? undefined} target="_blank" rel="noopener noreferrer" aria-label="Open client signature" className="overflow-hidden rounded-lg border border-border/60 bg-card">
        {proofQuery.data?.signatureUrl ? <img src={proofQuery.data.signatureUrl} alt="Client signature" className="h-20 w-full object-contain p-2" loading="lazy" /> : <span className="grid h-20 place-items-center text-muted-foreground"><FileSignature className="h-5 w-5" /></span>}
        <span className="block px-2 py-1.5 text-[10px] font-semibold text-foreground">Signature</span>
      </a>}
    </div>
  );
}