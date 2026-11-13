import { describe, expect, it } from "vitest";
import { prefillStatutoryForm, missingStatutoryFields } from "./statutory-form-data";
describe("verified statutory form inputs", () => {
  it("maps saved employee insurance and employer insurance separately", () => {
    const v = prefillStatutoryForm("esic37", {full_name: "Test Employee", compliance: {esic_number: "1234567890"}}, {esic_number: "EMPLOYER01"});
    expect(v.esic).toBe("1234567890"); expect(v.employerEsic).toBe("EMPLOYER01");
  });
  it("never invents earlier membership or accident facts", () => {
    const e = {compliance: {pf_enabled: true, eps_enabled: true, uan: "100000000001"}};
    expect(prefillStatutoryForm("epf11", e, {}).previousEpf).toBe("");
    expect(prefillStatutoryForm("accident11", e, {}).injuryDate).toBe("");
  });
  it("resolves saved nominee references rather than exporting contact IDs as names", () => {
    const v = prefillStatutoryForm("pf2", {contacts: [{id: "abc", name: "Jane", relation: "Spouse"}], compliance: {nominees: [{contact: "abc", percent: 100}]}}, {});
    expect(v.nomName0).toBe("Jane"); expect(v.nomShare0).toBe("100"); expect(v.nomDob0).toBe("");
  });
  it("requires exactly 100 percent nomination shares", () => {
    expect(missingStatutoryFields("pf2", {nomName0: "Jane", nomShare0: "99"})).toContain("EPF nominee shares must total 100%");
    expect(missingStatutoryFields("pf2", {nomName0: "Jane", nomShare0: "100"})).not.toContain("EPF nominee shares must total 100%");
  });
});