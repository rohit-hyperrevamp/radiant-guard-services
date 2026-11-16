import { describe, it, expect } from "vitest";
import { documentStatus, documentEvidence, followupRequestText, type DocumentPolicy } from "./document-followup";
const policy: DocumentPolicy = { purpose: "onboarding", required_keys: Array.from({ length: 10 }, (_, i) => `doc${i}`), deadline_days: 10, owner_candidate_id: null };
const person = { id: "1", name: "Person", code: "42", purpose: "onboarding" as const, start: "2026-11-16", received: [] };
describe("required document follow-up", () => {
  it("shows all ten missing when no files exist", () => { expect(documentStatus(person, policy, "2026-11-16").missing).toHaveLength(10); });
  it("shows eight pending when two of ten are received", () => { expect(documentStatus({ ...person, received: ["doc0", "doc1", "doc1"] }, policy, "2026-11-16").missing).toHaveLength(8); });
  it("sets a ten-day deadline without becoming overdue on the due day", () => { const s = documentStatus(person, policy, "2026-11-26"); expect(s.due).toBe("2026-11-26"); expect(s.overdue).toBe(false); expect(documentStatus(person, policy, "2026-11-27").overdue).toBe(true); });
  it("supports a five-day submission policy", () => { expect(documentStatus(person, { ...policy, deadline_days: 5 }, "2026-11-16").due).toBe("2026-11-21"); });
  it("does not treat typed identity numbers as uploaded documents", () => { expect(documentEvidence({ aadhaar_number: "123456789012", pan_number: "ABCDE1234F" })).toEqual([]); });
  it("reuses verified Aadhaar and real exit uploads for rehire", () => { expect(documentEvidence({ other_info: { digilocker_verified: true }, offboarding_details: { exit_documents: [{ key: "resignation_letter", collected: true, file_url: "private" }] } })).toEqual(["aadhaar_front", "aadhaar_back", "resignation"]); });
  it("does not invent a deadline when the lifecycle date is missing", () => { expect(documentStatus({ ...person, start: null }, policy, "2026-11-16").due).toBeNull(); });
  it("request message lists missing details and documents with the deadline", () => { const t = followupRequestText("Ravi", ["pan"], ["bank_ifsc"], "2026-11-26"); expect(t).toContain("- Bank IFSC"); expect(t).toContain("- PAN card (copy)"); expect(t).toContain("2026-11-26"); });
});
