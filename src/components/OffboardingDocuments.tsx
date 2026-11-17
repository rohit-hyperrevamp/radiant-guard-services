import { Eye } from "lucide-react";
import { EmploymentLetters } from "@/components/EmploymentLetters";
import { DocumentChecklist } from "@/components/recruitment/DocumentChecklist";
import { Button } from "@/components/ui/button";
import { LETTER_GROUPS, LETTER_LABELS } from "@/lib/employment-letters";

export function OffboardingDocuments({ candidateId, employee, start, fieldOverrides }: {
  candidateId: string;
  employee: Record<string, any>;
  start?: string | null;
  fieldOverrides?: Record<string, string>;
}) {
  return <EmploymentLetters candidateId={candidateId} group="exit" fieldOverrides={fieldOverrides}
    renderLauncher={(open, history) => <DocumentChecklist id={candidateId} purpose="offboarding" employee={employee} start={start}
      documentOptions={Object.fromEntries(LETTER_GROUPS.exit.map(kind => [kind, {
        label: LETTER_LABELS[kind],
        actions: <Button size="sm" variant="outline" onClick={() => open(kind)}><Eye className="mr-2 h-4 w-4" />Preview / edit</Button>,
        history: history(kind),
      }]))} />}
  />;
}