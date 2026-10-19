import { describe, expect, it } from "vitest";
import { matchesSearch, statusRank } from "./search-match";

const tarun = ["Tarun Kumar Singh", "9876543210", "EMP123"];

describe("matchesSearch", () => {
  it("finds by last name in any case", () => expect(matchesSearch("SINGH", tarun)).toBe(true));
  it("finds by middle name", () => expect(matchesSearch("kumar", tarun)).toBe(true));
  it("finds first + last skipping middle, any order", () => expect(matchesSearch("singh  tarun", tarun)).toBe(true));
  it("finds by phone with +91 and spaces", () => expect(matchesSearch("+91 98765 43210", tarun)).toBe(true));
  it("rejects non-matching", () => expect(matchesSearch("harsh", tarun)).toBe(false));
});

describe("statusRank", () => {
  it("puts active before expired", () => expect(statusRank("active")).toBeLessThan(statusRank("expired")));
});
