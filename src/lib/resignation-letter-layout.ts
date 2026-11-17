import type { LetterPage } from "./employment-letters";

/** Employee-authored request, not a company-issued termination or a signed declaration. */
export const resignationLayout: LetterPage[] = [{
  width: 595.28, height: 841.89,
  lines: [
    [60, "Date: {{resignation_date}}"],
    [110, "To,"],
    [134, "The HR Department"],
    [158, "Radiant Guard Services"],
    [210, "Subject: Resignation request"],
    [260, "Dear Sir / Madam,"],
    [304, "I, {{name}}, Employee ID {{employee_code}},"],
    [328, "request to resign from my position as {{designation}}."],
    [370, "My requested last working date is {{last_working_date}}."],
    [412, "Reason: {{resignation_reason}}"],
    [464, "Please review my request and confirm the exit formalities."],
    [520, "Yours faithfully,"],
    [568, "{{name}}"],
    [610, "Employee signature: ________________________"],
  ].map(([top, value]) => ({
    top: Number(top), left: 65, width: 465, size: 12, family: "serif",
    runs: [{ text: String(value), bold: top === 210 }],
  })),
}];