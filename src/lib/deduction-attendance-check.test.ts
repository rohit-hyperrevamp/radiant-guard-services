import { describe, expect, it } from "vitest";
import { namesLookAlike } from "./deduction-attendance-check";

describe("namesLookAlike", () => {
  it("matches duplicate records with an extra middle name", () => {
    expect(namesLookAlike("Ravi Vinod Shirpurkar", "Ravi Shirpurkar")).toBe(true);
    expect(namesLookAlike("Jadhav Santosh Baliram", "Jadhav Santosh")).toBe(true);
  });
  it("does not match people who only share a first name", () => {
    expect(namesLookAlike("Ravi Shirpurkar", "Ravi Kumar")).toBe(false);
  });
});
