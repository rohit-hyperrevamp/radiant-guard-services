import { describe, expect, it } from "vitest";
import { chunkByRowBudget, crossLaneDuplicates, runInLanes, sharedTokenLanes } from "./attendance-import-batch";
import { patchAttendanceEntryRows, replaceCandidateEntryRows } from "./attendance-fetch";

describe("sharedTokenLanes", () => {
  it("keeps rows that share any code/phone/name in one lane, in sheet order", () => {
    const lanes = sharedTokenLanes([
      ["41084", null, "Ramesh Kumar"],
      ["", "98200", "Asha"],
      [null, null, "RAMESH  kumar"],
      ["50001", "98200", "A. Patil"],
      ["60000", null, "Bala"],
    ]);
    expect(lanes).toEqual([[0, 2], [1, 3], [4]]);
  });
  it("chains transitively and ignores blank tokens", () => {
    expect(sharedTokenLanes([["a"], ["b"], ["a", "b"], [""], [null]])).toEqual([[0, 1, 2], [3], [4]]);
  });
});

describe("runInLanes", () => {
  it("runs a lane strictly in order, lanes concurrently up to the limit, results by index", async () => {
    const log: string[] = [];
    let active = 0;
    let peak = 0;
    const out = await runInLanes([[0, 2], [1], [3], [4]], 2, async (i) => {
      active++;
      peak = Math.max(peak, active);
      log.push(`start${i}`);
      await new Promise((r) => setTimeout(r, i === 0 ? 5 : 1));
      log.push(`end${i}`);
      active--;
      return i * 10;
    });
    expect(out).toEqual([0, 10, 20, 30, 40]);
    expect(peak).toBe(2);
    expect(log.indexOf("end0")).toBeLessThan(log.indexOf("start2"));
  });
  it("rejects on the first failure", async () => {
    await expect(runInLanes([[0], [1]], 2, async (i) => {
      if (i === 1) throw new Error("x");
      return i;
    })).rejects.toThrow("x");
  });
});

describe("chunkByRowBudget", () => {
  it("groups consecutive items within the row budget, oversize items alone", () => {
    const chunks = chunkByRowBudget([200, 200, 200, 700, 50, 50], (n) => n, 500);
    expect(chunks).toEqual([[200, 200], [200], [700], [50, 50]]);
    expect(chunkByRowBudget([], (n: number) => n)).toEqual([]);
  });
});

describe("crossLaneDuplicates", () => {
  it("flags only employees reached from more than one lane", () => {
    const ids = ["p1", "p2", "p1", "p3", "p3"];
    const dupes = crossLaneDuplicates([[0], [1], [2], [3, 4]], (i) => ids[i]);
    expect(Array.from(dupes.entries())).toEqual([["p1", [0, 2]]]);
  });
});

describe("attendance cache patching", () => {
  const row = (id: string, cid: string, date: string, code = "P", extra: Record<string, unknown> = {}) => ({
    id, candidate_id: cid, designation_id: "d1", shift_hours: 8, is_reliever: false, entry_date: date, code, ot_hours: 0, ...extra,
  });
  it("patches saved cells by id or cell key and keeps period-read order", () => {
    const cached = [row("b", "c1", "2026-09-01"), row("a", "c2", "2026-09-01"), row("c", "c1", "2026-09-02")]
      .sort((x, y) => x.entry_date.localeCompare(y.entry_date) || x.id.localeCompare(y.id));
    const out = patchAttendanceEntryRows(cached, [
      row("c", "c1", "2026-09-02", "A"),
      row("z", "c2", "2026-09-02"),
      row("new-id", "c1", "2026-09-01", "WO"), // same cell as "b" (re-created)
    ]);
    expect(out.map((r) => `${r.id}:${r.code}`)).toEqual(["a:P", "new-id:WO", "c:A", "z:P"]);
  });
  it("replaces every row of re-read people, leaving others", () => {
    const cached = [row("a", "c1", "2026-09-01"), row("b", "c2", "2026-09-01"), row("c", "c1", "2026-09-03", "P")];
    // The rules moved c1's 3rd into ED and removed nothing else.
    const fresh = [row("a", "c1", "2026-09-01"), row("c", "c1", "2026-09-03", "", { ot_hours: 1 })];
    const out = replaceCandidateEntryRows(cached, ["c1"], fresh);
    expect(out.map((r) => `${r.id}:${r.code}:${r.ot_hours}`)).toEqual(["a:P:0", "b:P:0", "c::1"]);
    // A re-read that returns nothing for a person clears their rows.
    expect(replaceCandidateEntryRows(cached, ["c1"], []).map((r) => r.id)).toEqual(["b"]);
  });
});
