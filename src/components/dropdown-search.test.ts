import { describe, expect, it } from "vitest";
import { filterDropdownOptions, indexDropdownOptions } from "./dropdown-search";

const options = [
  { value: "CLI4670", label: "Bank of Baroda Ram Nagar", hint: "Gujarat Ahmedabad" },
  { value: "CLI4091", label: "ANZ Acacia", hint: "Karnataka Bengaluru" },
  { value: "ITEM24", label: "Security Uniform Shirt", hint: "Large Blue" },
];
const indexed = indexDropdownOptions(options);

describe("smart dropdown matching", () => {
  it("finds client names in any word order and capitalization", () => {
    expect(filterDropdownOptions(indexed, "NAGAR bank")).toEqual([options[0]]);
  });
  it("finds clients by their client ID", () => {
    expect(filterDropdownOptions(indexed, "cli4091")).toEqual([options[1]]);
  });
  it("finds state and branch information with extra spaces and dots", () => {
    expect(filterDropdownOptions(indexed, " Ahmedabad.  Gujarat ")).toEqual([options[0]]);
  });
  it("finds inventory items by name and size", () => {
    expect(filterDropdownOptions(indexed, "large shirt")).toEqual([options[2]]);
  });
  it("requires every word and returns no unrelated options", () => {
    expect(filterDropdownOptions(indexed, "bank Karnataka")).toEqual([]);
  });
  it("clearing the search restores all options in the original order", () => {
    filterDropdownOptions(indexed, "uniform");
    expect(filterDropdownOptions(indexed, "")).toEqual(options);
    expect(indexed.map(({ option }) => option)).toEqual(options);
  });
});