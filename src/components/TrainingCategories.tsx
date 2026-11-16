import { ArrowUpRight, BookOpen, BriefcaseBusiness, Users, Wallet, Package, Truck, Scale, Shield, Radio, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollingText } from "@/components/ScrollingText";
import { TRAINING_CATEGORIES, categoryDocuments, type TrainingDocument } from "@/lib/training-library";

const icons = [BriefcaseBusiness, Users, Wallet, Package, Truck, Scale, Users, Shield, Radio, Library];

export function TrainingCategories({ documents, onSelect, includeEmpty = false }: { documents: TrainingDocument[]; onSelect: (key: string) => void; includeEmpty?: boolean }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {TRAINING_CATEGORIES.map((category, index) => {
      const count = categoryDocuments(documents, category.key).length;
      if (!includeEmpty && !count) return null;
      const Icon = icons[index] ?? BookOpen;
      return <Button key={category.key} data-panel variant="outline" onClick={() => onSelect(category.key)} className={`h-auto min-h-28 justify-start gap-4 rounded-lg p-5 text-left ${category.tint}`}>
        <span className="tile-icon grid h-11 w-11 shrink-0 place-items-center rounded-lg"><Icon className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1"><ScrollingText text={category.name} className="block text-base font-semibold" /><span className="mt-2 block text-sm font-normal">{count} guide{count === 1 ? "" : "s"}</span></span>
        <ArrowUpRight className="h-4 w-4 shrink-0" />
      </Button>;
    })}
  </div>;
}