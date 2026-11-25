import { describe, expect, it } from "vitest";
import {
  INDIAN_STATES_AND_UTS,
  canonicalState,
  guardedStepTarget,
  stateForPincode,
  stateOptions,
  validateOrgStep,
  type OrgWizardFields,
} from "./org-wizard";

const base: OrgWizardFields = {
  code: "ORG1",
  name: "Acme",
  billingName: "Asha",
  billingAddress1: "1 Road",
  billingCity: "Pune",
  billingPincode: "411001",
  shippingSameAsBilling: true,
  shippingAddress1: "",
  shippingCity: "",
  shippingPincode: "",
};

describe("validateOrgStep", () => {
  it("passes a complete form", () => {
    for (const step of ["profile", "contact", "billing", "deployment"]) expect(validateOrgStep(base, step)).toBeNull();
  });
  it("names the missing field on each step", () => {
    expect(validateOrgStep({ ...base, name: " " }, "profile")?.field).toBe("name");
    expect(validateOrgStep({ ...base, billingName: "" }, "contact")?.field).toBe("billingName");
    expect(validateOrgStep({ ...base, billingCity: "" }, "billing")?.field).toBe("billingCity");
    expect(validateOrgStep({ ...base, billingPincode: "4110" }, "billing")?.field).toBe("billingPincode");
    expect(validateOrgStep({ ...base, shippingSameAsBilling: false }, "deployment")?.field).toBe("shippingAddress1");
  });
});

describe("guardedStepTarget", () => {
  const steps = ["a", "b", "c", "d"];
  it("stops forward moves at the first invalid step", () => {
    const res = guardedStepTarget(steps, "a", "d", (s) => (s === "b" ? "bad" : null));
    expect(res).toEqual({ step: "b", blockedBy: "b" });
  });
  it("always allows moving back", () => {
    expect(guardedStepTarget(steps, "c", "a", () => "bad")).toEqual({ step: "a", blockedBy: null });
  });
  it("blocks Next on the current invalid step", () => {
    expect(guardedStepTarget(steps, "a", "b", (s) => (s === "a" ? "bad" : null))).toEqual({ step: "a", blockedBy: "a" });
  });
});

describe("state options", () => {
  it("covers all 36 states and UTs", () => {
    expect(INDIAN_STATES_AND_UTS).toHaveLength(36);
  });
  it("merges master names, dedupes spelling variants and keeps legacy free text", () => {
    const opts = stateOptions(["Tamil Nadu", "TamilNadu", "Maharashtra"], "Bombay Presidency");
    expect(opts.filter((o) => o.replace(/\s/g, "") === "TamilNadu")).toHaveLength(1);
    expect(opts).toContain("Bombay Presidency");
    expect(opts).toContain("Ladakh");
  });
  it("canonicalises a typed state to the option spelling", () => {
    expect(canonicalState("tamil nadu", ["Tamil Nadu"])).toBe("Tamil Nadu");
    expect(canonicalState("Atlantis", ["Tamil Nadu"])).toBe("Atlantis");
  });
});

describe("stateForPincode", () => {
  const ranges = [
    { state: "Maharashtra", range_start: 400000, range_end: 445999, is_excluded: false },
    { state: "Karnataka", range_start: 560000, range_end: 591999, is_excluded: false },
    { state: "Goa", range_start: 403000, range_end: 403999, is_excluded: false },
  ];
  it("returns the single covering state", () => {
    expect(stateForPincode("411001", ranges)).toBe("Maharashtra");
    expect(stateForPincode("560001", ranges)).toBe("Karnataka");
  });
  it("refuses to guess when ambiguous, unknown or invalid", () => {
    expect(stateForPincode("403001", ranges)).toBeNull();
    expect(stateForPincode("110001", ranges)).toBeNull();
    expect(stateForPincode("4110", ranges)).toBeNull();
  });
});
