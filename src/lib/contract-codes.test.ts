import { describe, expect, it } from "vitest";
import { isUniqueViolation, maxCodeNumber, nextContractCodeFrom, nextProspectCodeFrom } from "./contract-codes";

describe("contract code generation", () => {
  it("uses the numeric maximum, not string order (CON9999 < CON16729)", () => {
    expect(nextContractCodeFrom(["CON9999", "CON16729", "CON00042"])).toBe("CON16730");
  });

  it("ignores non-CON and malformed codes instead of jumping to huge numbers", () => {
    expect(nextContractCodeFrom(["69216365", "CONX12", "CON16729", ""])).toBe("CON16730");
  });

  it("counts suffixed codes so the next one can't collide", () => {
    expect(nextContractCodeFrom(["CON16729A", "CON100"])).toBe("CON16730");
  });

  it("starts at CON00001 when there are no codes", () => {
    expect(nextContractCodeFrom([])).toBe("CON00001");
  });

  it("pads prospect codes and accepts both PROS-0004 and PROS0004", () => {
    expect(nextProspectCodeFrom(["PROS-0003", "PROS0004"])).toBe("PROS-0005");
  });

  it("maxCodeNumber handles a large set beyond 1000 rows", () => {
    const codes = Array.from({ length: 7048 }, (_, i) => `CON${i + 1}`);
    expect(maxCodeNumber(codes, /^CON(\d+)$/i)).toBe(7048);
  });

  it("recognises unique violations", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ message: 'duplicate key value violates unique constraint "x"' })).toBe(true);
    expect(isUniqueViolation({ code: "42501" })).toBe(false);
  });
});
