import { afterEach, describe, expect, it } from "vitest";
import { fixedCodeFor, identifierMatches, parseFixedCodes } from "./otp.server";
import { randomPassword } from "./phone-session.server";

const env = process.env;
afterEach(() => {
  delete env.SUPER_ADMIN_OTP;
  delete env.FIXED_OTP_CODES;
  delete env.SUPER_ADMIN_PHONE;
});

describe("fixed sign-in codes come only from server env", () => {
  it("has no fixed codes when env is not set (nothing hardcoded)", () => {
    expect(fixedCodeFor("8373914073")).toBeNull();
    expect(fixedCodeFor("7517551288")).toBeNull();
    expect(fixedCodeFor("9175292300")).toBeNull();
  });

  it("reads the Super Admin code from SUPER_ADMIN_OTP", () => {
    env.SUPER_ADMIN_PHONE = "9000000001";
    env.SUPER_ADMIN_OTP = "4821";
    expect(fixedCodeFor("9000000001")).toBe("4821");
    expect(fixedCodeFor("9000000002")).toBeNull();
  });

  it("parses FIXED_OTP_CODES and rejects phone-derived (last 4 digit) codes", () => {
    expect(parseFixedCodes("9876543210:4821, 9123456789:6789 ,bad:1234,9000000000:12")).toEqual({
      "9876543210": "4821",
    });
  });
});

describe("MSG91 identifier binding", () => {
  it("rejects a token verified for a different number", () => {
    expect(identifierMatches("919999999999", "8888888888")).toBe(false);
  });
  it("accepts the same number with or without country code", () => {
    expect(identifierMatches("918888888888", "8888888888")).toBe(true);
    expect(identifierMatches("+918888888888", "8888888888")).toBe(true);
    expect(identifierMatches("8888888888", "8888888888")).toBe(true);
  });
  it("rejects when no identifier is reported (fail closed)", () => {
    expect(identifierMatches("eyJhbGciOi1234567890abc.def", "8888888888")).toBe(false);
    expect(identifierMatches("OTP verified successfully", "8888888888")).toBe(false);
    expect(identifierMatches(undefined, "8888888888")).toBe(false);
  });
});

describe("new identities get unguessable passwords", () => {
  it("is long, random and never phone-derived", () => {
    const a = randomPassword();
    const b = randomPassword();
    expect(a).toHaveLength(48);
    expect(a).not.toBe(b);
    expect(a).not.toMatch(/pre-launch/);
  });
});
