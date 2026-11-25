import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { exactIlikePattern, importMayChangePostings, uniqueMatch } from "./attendance-sheet-people";

describe("attendance sheet person matching", () => {
  it("returns the single record", () => {
    expect(uniqueMatch([{ id: "a" }])).toEqual({ id: "a" });
  });

  it("reports ambiguity instead of taking the first hit", () => {
    expect(uniqueMatch([{ id: "a" }, { id: "b" }])).toBe("ambiguous");
  });

  it("returns null when nothing matches", () => {
    expect(uniqueMatch([])).toBeNull();
  });

  it("escapes LIKE wildcards and collapses spaces for an exact name match", () => {
    expect(exactIlikePattern("  Ram   Kumar ")).toBe("Ram Kumar");
    expect(exactIlikePattern("RAM_%")).toBe("RAM\\_\\%");
  });
});

describe("importMayChangePostings", () => {
  it("allows posting changes for the current window", () => {
    expect(importMayChangePostings("2026-11-30", "2026-11-25")).toBe(true);
  });

  it("blocks posting changes when importing a past month", () => {
    expect(importMayChangePostings("2026-10-31", "2026-11-25")).toBe(false);
  });
});

import { addCoveredDates, staleEntryIdsAfterImport, type ImportedCell } from "./attendance-sheet-people";

describe("staleEntryIdsAfterImport", () => {
  const cell = (p: Partial<ImportedCell> & { id?: string }) => ({
    id: "x",
    candidate_id: "c1",
    designation_id: "d1",
    shift_hours: 0,
    is_reliever: false,
    entry_date: "2026-11-01",
    ...p,
  });

  it("never deletes dates the file does not cover (partial file)", () => {
    const covered = new Map<string, Set<string>>();
    addCoveredDates(covered, "c1", ["2026-11-01"]);
    const stored = [cell({ id: "keep", entry_date: "2026-11-20" })];
    expect(staleEntryIdsAfterImport(stored, [cell({ entry_date: "2026-11-01" })], covered)).toEqual([]);
  });

  it("keeps the line just written and removes a phantom line on a covered date", () => {
    const covered = new Map<string, Set<string>>();
    addCoveredDates(covered, "c1", ["2026-11-01"]);
    const stored = [cell({ id: "same" }), cell({ id: "phantom", designation_id: "d2" })];
    expect(staleEntryIdsAfterImport(stored, [cell({})], covered)).toEqual(["phantom"]);
  });

  it("treats a reliever line as different from the regular line", () => {
    const covered = new Map<string, Set<string>>();
    addCoveredDates(covered, "c1", ["2026-11-01"]);
    const stored = [cell({ id: "r", is_reliever: true })];
    expect(staleEntryIdsAfterImport(stored, [cell({})], covered)).toEqual(["r"]);
  });

  it("leaves people who are not in the file alone", () => {
    const covered = new Map<string, Set<string>>();
    addCoveredDates(covered, "c1", ["2026-11-01"]);
    expect(staleEntryIdsAfterImport([cell({ id: "o", candidate_id: "c2" })], [], covered)).toEqual([]);
  });
});
