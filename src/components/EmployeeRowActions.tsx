import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, Edit2, MoreHorizontal, FileText, FileSignature, Network, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmploymentLetters } from "@/components/EmploymentLetters";
import { Switch } from "@/components/ui/switch";

export function EmployeeRowActions({ id, canEdit, editLocked, opening, hasExit, onEdit, onSites, onPostings, onSign, onStatus, statusLabel, statusActive, statusDisabled, onEnableRehire }: {
  id: string; canEdit: boolean; editLocked: boolean; opening: boolean; hasExit: boolean;
  onEdit: () => void; onSites?: () => void; onPostings: () => void;
  onSign: (kind: "nda" | "appointment_letter") => void;
  onStatus: () => void; statusLabel: string; statusActive: boolean; statusDisabled?: boolean; onEnableRehire?: () => void;
}) {
  const [letters, setLetters] = useState<string | null>(null);
  return <div className="flex flex-nowrap items-center justify-end gap-1.5">
    {canEdit && <Switch checked={statusActive} disabled={statusDisabled} onCheckedChange={onStatus} title={statusLabel} aria-label={statusLabel} />}
    <Button asChild variant="secondary" size="icon" title="View employee profile" aria-label="View employee profile"><Link to="/admin/candidates/$id/details" params={{ id }} search={{ section: "basic" }}><Eye /></Link></Button>
    {canEdit && <Button variant="outline" size="icon" title={editLocked ? "Inactive profile is read-only" : "Edit employee"} aria-label="Edit employee" disabled={editLocked || opening} onClick={onEdit}>{opening ? <Loader2 className="animate-spin" /> : <Edit2 />}</Button>}
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="secondary" size="icon" title="More employee actions" aria-label="More employee actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {onEnableRehire && <DropdownMenuItem onSelect={onEnableRehire}>Enable approved rehire</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => setLetters("hiring")}><FileText />Hiring letters</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setLetters("confirmation")}><FileText />Confirmation letter</DropdownMenuItem>
        {hasExit && <DropdownMenuItem onSelect={() => setLetters("exit")}><FileText />Offboarding documents</DropdownMenuItem>}
        {onSites && <DropdownMenuItem onSelect={onSites}><MapPin />Client sites</DropdownMenuItem>}
        {canEdit && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={onPostings}><Network />Billing type & postings</DropdownMenuItem><DropdownMenuItem onSelect={() => onSign("nda")}><FileSignature />Sign NDA</DropdownMenuItem><DropdownMenuItem onSelect={() => onSign("appointment_letter")}><FileSignature />Sign appointment letter</DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu>
    {letters && <EmploymentLetters key={letters} candidateId={id} group={letters} initialOpen onClose={() => setLetters(null)} launcherHidden />}
  </div>;
}