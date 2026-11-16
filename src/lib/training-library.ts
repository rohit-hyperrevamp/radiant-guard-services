export type TrainingDocument = {
  id: string; role_key: string; title: string; description: string | null;
  file_path: string; file_name: string; size_bytes: number | null; sort_order: number;
  is_active?: boolean;
};

export const TRAINING_CATEGORIES = [
  { key: "leadership", name: "Leadership", roles: ["leadership", "admin", "super_admin", "vp_operations"], tint: "tile-tint-blue" },
  { key: "hr", name: "HR & Payroll", roles: ["hr", "payroll", "hr_executive"], tint: "tile-tint-rose" },
  { key: "finance", name: "Finance & Accounts", roles: ["finance", "accounts"], tint: "tile-tint-emerald" },
  { key: "inventory", name: "Inventory", roles: ["inventory", "branch_manager"], tint: "tile-tint-amber" },
  { key: "transport", name: "Vehicle & Transport", roles: ["transport"], tint: "tile-tint-sky" },
  { key: "legal", name: "Legal", roles: ["legal"], tint: "tile-tint-violet" },
  { key: "field_officer", name: "Field Officers", roles: ["field_officer"], tint: "tile-tint-emerald" },
  { key: "guard", name: "Security Guards", roles: ["guard"], tint: "tile-tint-blue" },
  { key: "control_center", name: "Control Center & Operations", roles: ["control_center", "control_center_head", "operations", "operations_manager"], tint: "tile-tint-amber" },
  { key: "general", name: "Programme & Other Guides", roles: [], tint: "tile-tint-slate" },
] as const;

export function trainingCategory(roleKey: string): string {
  return TRAINING_CATEGORIES.find((c) => (c.roles as readonly string[]).includes(roleKey))?.key ?? "general";
}

export function categoryDocuments<T extends TrainingDocument>(documents: T[], category: string): T[] {
  return documents.filter((d) => trainingCategory(d.role_key) === category);
}