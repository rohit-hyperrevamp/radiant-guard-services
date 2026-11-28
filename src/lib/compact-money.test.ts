import { describe, expect, it } from "vitest";
import { compactINR, compactNumberIN } from "@/lib/compact-money";

describe("compact Indian money", () => {
  it("formats crore, lakh and smaller amounts", () => {
    expect(compactINR(149157364.64)).toBe("₹14.92 Cr");
    expect(compactINR(5974004.33)).toBe("₹59.74 L");
    expect(compactINR(12450.4)).toBe("₹12,450");
    expect(compactINR(-150000)).toBe("−₹1.5 L");
    expect(compactINR(null)).toBe("—");
  });
  it("formats chart axis numbers", () => {
    expect(compactNumberIN(1400000)).toBe("14 L");
    expect(compactNumberIN(45000)).toBe("45K");
    expect(compactNumberIN(120000000)).toBe("12 Cr");
    expect(compactNumberIN(900)).toBe("900");
  });
});
