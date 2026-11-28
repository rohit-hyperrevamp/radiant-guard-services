import { describe, expect, it } from "vitest";
import {
  clientHolidaysFromRows,
  holidayMapForDates,
  type PublicHoliday,
} from "@/lib/public-holidays";

const global: PublicHoliday[] = [
  { id: "g", name: "Gandhi Jayanti", month: 10, day: 2, enabled: true, sortOrder: 0 },
];
const client = clientHolidaysFromRows([
  {
    id: "c1",
    holiday_date: "2026-09-14",
    name: "Ganesh Chaturthi",
    unit_ids: ["ace"],
    enabled: true,
  },
  { id: "c2", holiday_date: "2026-09-15", name: "Disabled", unit_ids: ["ace"], enabled: false },
]);
const dates = ["2026-09-13", "2026-09-14", "2026-09-15", "2026-10-02"];

describe("holidayMapForDates with client holidays", () => {
  it("adds a site's own dated holiday on top of the global list", () => {
    const m = holidayMapForDates(dates, global, client, "ace");
    expect([...m.keys()]).toEqual(["2026-09-14", "2026-10-02"]);
    expect(m.get("2026-09-14")).toBe("Ganesh Chaturthi");
  });
  it("never applies one client's holiday to another site", () => {
    expect([...holidayMapForDates(dates, global, client, "other").keys()]).toEqual(["2026-10-02"]);
  });
  it("keeps the global-only behaviour when no site is given", () => {
    expect([...holidayMapForDates(dates, global).keys()]).toEqual(["2026-10-02"]);
  });
  it("is exact to the year", () => {
    expect(holidayMapForDates(["2027-09-14"], global, client, "ace").size).toBe(0);
  });
});
