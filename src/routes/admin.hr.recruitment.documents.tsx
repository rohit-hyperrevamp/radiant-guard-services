import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentFollowupPanel } from "@/components/recruitment/DocumentFollowupPanel";

export const Route = createFileRoute("/admin/hr/recruitment/documents")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: typeof search.type === "string" ? search.type : "all",
    overdue: search.overdue === true || search.overdue === "true",
  }),
  head: () => ({ meta: [
    { title: "Employee Document Follow-up — Radiant" },
    { name: "description", content: "Review missing employee documents, submission deadlines and recruitment letters." },
    { property: "og:title", content: "Employee Document Follow-up — Radiant" },
    { property: "og:description", content: "Review missing employee documents, submission deadlines and recruitment letters." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const { type, overdue } = Route.useSearch();
  return <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-xl font-semibold">Employee documents</h1>
      <Button asChild variant="outline" size="sm"><Link to="/admin/hr/recruitment/dashboard"><ArrowLeft className="mr-2 h-4 w-4"/>Recruitment dashboard</Link></Button>
    </header>
    <DocumentFollowupPanel key={`${type}-${overdue}`} initialType={type} initialOverdue={overdue}/>
  </div>;
}