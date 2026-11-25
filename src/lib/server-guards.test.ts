import { describe, expect, it } from "vitest";
import { createRateLimiter, escapeLike, hookSecretOk, safeEqual } from "./server-guards";
import { pushRecipientsForCaller } from "./push-permissions";

const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });
const SECRET = "s3cret-value-long-enough";

describe("hookSecretOk", () => {
  it("fails closed when the secret is not configured or too short", () => {
    expect(hookSecretOk(headers({ "x-hook-secret": "" }), undefined)).toBe(false);
    expect(hookSecretOk(headers({ "x-hook-secret": "short" }), "short")).toBe(false);
  });
  it("accepts the header or a bearer token", () => {
    expect(hookSecretOk(headers({ "x-hook-secret": SECRET }), SECRET)).toBe(true);
    expect(hookSecretOk(headers({ authorization: `Bearer ${SECRET}` }), SECRET)).toBe(true);
  });
  it("rejects wrong or missing values", () => {
    expect(hookSecretOk(headers({}), SECRET)).toBe(false);
    expect(hookSecretOk(headers({ "x-hook-secret": `${SECRET}x` }), SECRET)).toBe(false);
  });
  it("safeEqual compares exactly", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });
});

describe("createRateLimiter", () => {
  it("allows up to the limit per window then recovers", () => {
    const rl = createRateLimiter(2, 1000);
    expect(rl.take("u", 0)).toBe(true);
    expect(rl.take("u", 10)).toBe(true);
    expect(rl.take("u", 20)).toBe(false);
    expect(rl.take("other", 20)).toBe(true);
    expect(rl.take("u", 1011)).toBe(true);
  });
});

describe("escapeLike", () => {
  it("escapes wildcards", () => {
    expect(escapeLike("a_b%c@x.com")).toBe("a\\_b\\%c@x.com");
  });
});

describe("pushRecipientsForCaller", () => {
  it("only allows users with a matching notification", () => {
    const rows = [
      { user_id: "u1", title: "Leave approved", message: "Your leave is approved" },
      { user_id: "u2", title: "Leave approved", message: "Different text" },
    ];
    expect(pushRecipientsForCaller(rows, "Leave approved", "Your leave is approved")).toEqual(["u1"]);
    expect(pushRecipientsForCaller(rows, "Spoof", "Pay now")).toEqual([]);
  });
});
