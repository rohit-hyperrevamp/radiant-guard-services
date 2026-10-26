import { describe, expect, it } from "vitest";
import { employeePickerSearchFilters } from "./employee-picker-search";

describe("employee picker search", () => {
  it("searches employee 28199 by employee ID as well as phone", () => {
    expect(employeePickerSearchFilters("28199")).toEqual([
      "employee_code.ilike.%28199%,mobile.ilike.%28199%",
    ]);
  });
  it("normalizes an Indian phone without discarding employee ID search", () => {
    expect(employeePickerSearchFilters("+91 98765 43210")).toEqual([
      "employee_code.ilike.%919876543210%,mobile.ilike.%9876543210%",
    ]);
  });
  it("keeps any-word-order name searches", () => {
    expect(employeePickerSearchFilters("Kumar Satheesh")).toEqual([
      "full_name.ilike.%kumar%,employee_code.ilike.%kumar%,mobile.ilike.%kumar%",
      "full_name.ilike.%satheesh%,employee_code.ilike.%satheesh%,mobile.ilike.%satheesh%",
    ]);
  });
});