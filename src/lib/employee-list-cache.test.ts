import { describe, expect, it } from "vitest";
import { patchEmployeeSlice } from "./employee-list-cache";

describe("saved employee list updates", () => {
  const employee = { id: "49837", status: "active", reports_to: "old" };
  it("shows a saved manager change immediately without adding duplicates", () => {
    expect(patchEmployeeSlice([employee], { ...employee, reports_to: "new" }, false))
      .toEqual([{ ...employee, reports_to: "new" }]);
  });
  it("moves deactivated staff out of working and into loaded inactive history", () => {
    const disabled = { ...employee, status: "inactive" };
    expect(patchEmployeeSlice([employee], disabled, false)).toEqual([]);
    expect(patchEmployeeSlice([], disabled, true)).toEqual([disabled]);
  });
  it("moves reactivated staff back to working without creating a partial unloaded history", () => {
    expect(patchEmployeeSlice([], employee, false)).toEqual([employee]);
    expect(patchEmployeeSlice([{ ...employee, status: "inactive" }], employee, true)).toEqual([]);
    expect(patchEmployeeSlice(undefined, employee, true)).toBeUndefined();
  });
});