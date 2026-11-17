import { describe, it, expect } from "vitest";
import { createLetter, employeeLetterFields, decodeLetter, LETTER_LABELS, letterPdf } from "./employment-letters";

describe("employment letters", () => {
  it("fills the chosen employee only without changing their source record", () => {
    const employee = { full_name: "Test Person", employee_code: "TEST42", preferred_joining_date: "2025-09-05", offboarding_details: { date_of_resignation: "2026-10-01", date_of_last_working: "2026-10-31" } };
    const before = JSON.stringify(employee);
    const fields = employeeLetterFields(employee, { designation_name: "Officer" });
    expect(fields.name).toBe("Test Person"); expect(fields.employee_code).toBe("TEST42");
    expect(fields.resignation_date).toContain("October"); expect(fields.annual_ctc).toBe("");
    expect(JSON.stringify(employee)).toBe(before);
  });
  it("does not invent CTC, performance statements or a signatory", () => {
    const fields = employeeLetterFields({ full_name: "Person", billing_rate: 99999 });
    expect(fields.annual_ctc).toBe(""); expect(fields.performance_statement).toBe(""); expect(fields.signatory).toBe("");
  });
  it("preserves editable saved copies independently of subsequent employee changes", () => {
    const copy = createLetter("relieving", { name: "First", employee_code: "42", resignation_date: "1 October 2026" });
    copy.pages[0].lines[0].runs[0].text = "Edited date";
    const restored = decodeLetter(JSON.stringify(copy));
    expect(restored?.fields.name).toBe("First"); expect(restored?.pages[0].lines[0].runs[0].text).toBe("Edited date");
    expect(decodeLetter("existing signed appointment")).toBeNull();
  });
  it("exports every format as a nonempty vector PDF file", async () => {
    for (const kind of Object.keys(LETTER_LABELS) as Array<keyof typeof LETTER_LABELS>) {
      const copy = createLetter(kind, { name: "Test Person", employee_code: "TEST42" });
      const blob = await letterPdf(copy);
      expect(blob.type).toBe("application/pdf"); expect(blob.size).toBeGreaterThan(1000);
      expect((await blob.text()).slice(0, 5)).toBe("%PDF-");
    }
  });
  it("uses unsaved offboarding dates and reason in resignation and exit copies", () => {
    const fields = employeeLetterFields({ full_name: "Test Guard", employee_code: "TEST42", offboarding_details: { date_of_resignation: "2026-11-18", date_of_last_working: "2026-11-30", reason_text: "Personal reasons" } });
    expect(fields.resignation_date).toContain("18 November 2026");
    expect(fields.last_working_date).toContain("30 November 2026");
    const copy = createLetter("resignation", fields);
    expect(copy.fields.resignation_reason).toBe("Personal reasons");
    expect(decodeLetter(JSON.stringify(copy))?.kind).toBe("resignation");
    expect(copy.fields.signatory).toBe("");
  });
});