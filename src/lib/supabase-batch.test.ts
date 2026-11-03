import { describe, expect, it } from "vitest";
import { uniqueRowsById } from "./supabase-batch";
import { matchesSearch } from "./search-match";

describe("contract register page identity", () => {
  const matching = { id: "guard-contract", code: "CLI4108" };
  const other = { id: "other-contract", code: "CLI4109" };

  it("removes overlapping page IDs before rendering search results", () => {
    const rows = uniqueRowsById([other, matching, other, matching]);
    expect(rows.map((row) => row.id)).toEqual(["other-contract", "guard-contract"]);
    expect(rows.filter((row) => matchesSearch("CLI4108", [row.code])))
      .toEqual([matching]);
  });

  it("preserves distinct contracts belonging to the same client", () => {
    const historical = { id: "historical-contract", code: "CLI4108" };
    expect(uniqueRowsById([matching, historical, matching]))
      .toEqual([matching, historical]);
  });
});