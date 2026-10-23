import type { FormulaConfig } from "./formula-engine";

export const FORMULA_TEMPLATES: { id: string; label: string; config: FormulaConfig }[] = [
  {
    id: "hra-basic-da-5",
    label: "HRA 5% (Basic+DA)",
    config: {
      mode: "preset",
      preset: {
        base: { kind: "basic_plus_da" },
        operator: "percent",
        percent: 5,
        multipliers: [],
      },
    },
  },
];

export function selectFormulaTemplate(id: string): FormulaConfig | null {
  const template = FORMULA_TEMPLATES.find((item) => item.id === id);
  return template ? structuredClone(template.config) : null;
}