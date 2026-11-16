import { describe, expect, it } from "vitest";
import { categoryDocuments, trainingCategory, type TrainingDocument } from "./training-library";

describe("department training categories", () => {
  it("groups HR and Payroll guides together", () => {
    expect(trainingCategory("hr")).toBe("hr");
    expect(trainingCategory("payroll")).toBe("hr");
  });
  it("keeps transport guides separate from inventory", () => {
    const docs = ["transport", "inventory", "guard"].map((role_key, i) => ({ id: String(i), role_key, title: role_key, description: null, file_path: "test.pdf", file_name: "test.pdf", size_bytes: 1, sort_order: i } satisfies TrainingDocument));
    expect(categoryDocuments(docs, "transport").map((d) => d.role_key)).toEqual(["transport"]);
  });
  it("retains existing Field Officer and Security Guard categories", () => {
    expect(trainingCategory("field_officer")).toBe("field_officer");
    expect(trainingCategory("guard")).toBe("guard");
  });
  it("retains uncategorised guides in the programme category", () => {
    expect(trainingCategory("general")).toBe("general");
    expect(trainingCategory("sales")).toBe("general");
  });
});