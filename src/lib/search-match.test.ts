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

import { buildSearchHay, compileSearch } from "./search-match";
describe("compiled search", () => {
  const hay = buildSearchHay(["Tarun Kumar Singh", "+91 98765 43210", "49222"]);
  it("finds last name then first name in any order", () => {
    expect(compileSearch("singh tarun")!(hay)).toBe(true);
  });
  it("finds a phone number typed with +91", () => {
    expect(compileSearch("+919876543210")!(hay)).toBe(true);
  });
  it("rejects a name that is not there", () => {
    expect(compileSearch("harsh")!(hay)).toBe(false);
  });
});
