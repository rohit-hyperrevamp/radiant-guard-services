import { describe, expect, it } from "vitest";
import { plainDbError, saveConfirmCopy } from "./form-copy";

describe("saveConfirmCopy", () => {
  it("asks to create a new record without edit wording", () => {
    const copy = saveConfirmCopy("Create organization");
    expect(copy.title).toBe("Create this organization?");
    expect(copy.description).not.toMatch(/applied to this record/);
    expect(copy.confirmText).toBe("Yes, create");
  });
  it("handles add and bare labels", () => {
    expect(saveConfirmCopy("Add rule").title).toBe("Add this rule?");
    expect(saveConfirmCopy("Create").title).toBe("Create this record?");
  });
  it("uses save wording for edits", () => {
    expect(saveConfirmCopy("Save changes").title).toBe("Save changes?");
    expect(saveConfirmCopy("Update").title).toBe("Save changes?");
  });
  it("has specific wording for submit and approve", () => {
    expect(saveConfirmCopy("Submit").title).toBe("Submit now?");
    expect(saveConfirmCopy("Approve").confirmText).toBe("Yes, approve");
  });
});

describe("plainDbError", () => {
  it("hides raw Postgres errors", () => {
    const msg = plainDbError("UPDATE requires a WHERE clause", "organization");
    expect(msg).not.toMatch(/WHERE/);
    expect(msg).toMatch(/organization/);
  });
  it("maps common causes", () => {
    expect(plainDbError("new row violates row-level security policy")).toMatch(/permission/);
    expect(plainDbError('duplicate key value violates unique constraint "customers_code_key"', "organization")).toMatch(/already exists/);
    expect(plainDbError("TypeError: Failed to fetch")).toMatch(/connection/);
    expect(plainDbError('null value in column "name" violates not-null constraint')).toMatch(/required/);
  });
  it("keeps messages that are already plain", () => {
    expect(plainDbError("Organisation ID already exists")).toBe("Organisation ID already exists");
    expect(plainDbError("You do not have permission to change clients")).toBe("You do not have permission to change clients");
  });
  it("has a fallback for empty input", () => {
    expect(plainDbError("", "client")).toMatch(/client/);
  });
});
