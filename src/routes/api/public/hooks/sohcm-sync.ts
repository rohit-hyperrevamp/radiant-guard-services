import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

// Nightly SmartApp (sohcm.com, cloud RGSPVLALFA) -> attendance sync for Alfa Laval (pg_cron, 02:00 IST).
// Downloads the previous day's attendance-log CSV, matches people by employee code to guards posted
// at the client's units, and inserts attendance: P per day; Extra Duty (shift-days) = hours beyond 8 / 8;
// relievers ED-only. Punches under 4h or without an out-punch are skipped. Never overwrites existing entries.

const BASE = "https://sohcm.com/SmartApp";
const CLOUD = "RGSPVLALFA";
const CUSTOMER_ID = "04f3c69b-ea28-45cd-8631-7228c71f56cf"; // Alfa Laval India Pvt Ltd
const REPORT: Record<string, unknown> = {"IsFilterEmployee": false, "EmployeeCode": "", "IsExact": false, "EmployeeName": "", "CategoryId": "0", "DesignationText": "0", "LocationId": "0", "EmploymentTypeText": "0", "IsCustomFilter": false, "CompanyIds": "", "DepartmentIds": "", "IsRecalculateAttendance": false, "IsShowHeader": true, "IsHHmmFormat": false, "IsSendInAutoMailer": false, "PrefixDigits": "1", "PrefixText": "", "AttendanceDateFormat": "dd-MMM-yyyy", "InDateTimeFormat": "dd-MM-yyyy HH:mm:ss", "OutDateTimeFormat": "dd-MM-yyyy HH:mm:ss", "SlNoStartFrom": "0", "FileExtension": "csv", "Separator": "Comma", "Fields": [{"SequenceNo": 1, "IsChecked": false, "ReportValue": "SerialNumber", "ReportHeader": "Sl No", "SequenceHeader": 1}, {"SequenceNo": 2, "IsChecked": true, "ReportValue": "AttendanceDate", "ReportHeader": "Attendance Date", "SequenceHeader": 2}, {"SequenceNo": 3, "IsChecked": true, "ReportValue": "EmployeeCode", "ReportHeader": "Employee Code", "SequenceHeader": 3}, {"SequenceNo": 4, "IsChecked": true, "ReportValue": "EmployeeName", "ReportHeader": "Employee Name", "SequenceHeader": 4}, {"SequenceNo": 5, "IsChecked": true, "ReportValue": "DepartmentSName", "ReportHeader": "Department", "SequenceHeader": 5}, {"SequenceNo": 6, "IsChecked": true, "ReportValue": "Designation", "ReportHeader": "Designation", "SequenceHeader": 6}, {"SequenceNo": 7, "IsChecked": false, "ReportValue": "DOJ", "ReportHeader": "DOJ", "SequenceHeader": 7}, {"SequenceNo": 8, "IsChecked": false, "ReportValue": "DOR", "ReportHeader": "DOR", "SequenceHeader": 8}, {"SequenceNo": 9, "IsChecked": false, "ReportValue": "EmployementType", "ReportHeader": "EmployementType", "SequenceHeader": 9}, {"SequenceNo": 10, "IsChecked": true, "ReportValue": "Location", "ReportHeader": "Location", "SequenceHeader": 10}, {"SequenceNo": 11, "IsChecked": false, "ReportValue": "Grade", "ReportHeader": "Grade", "SequenceHeader": 11}, {"SequenceNo": 12, "IsChecked": false, "ReportValue": "Team", "ReportHeader": "Team", "SequenceHeader": 12}, {"SequenceNo": 13, "IsChecked": false, "ReportValue": "ShiftName", "ReportHeader": "Shift Name", "SequenceHeader": 13}, {"SequenceNo": 14, "IsChecked": true, "ReportValue": "ShiftCode", "ReportHeader": "Shift Code", "SequenceHeader": 14}, {"SequenceNo": 15, "IsChecked": true, "ReportValue": "BeginTime", "ReportHeader": "Begin Time", "SequenceHeader": 15}, {"SequenceNo": 16, "IsChecked": true, "ReportValue": "EndTime", "ReportHeader": "End Time", "SequenceHeader": 16}, {"SequenceNo": 17, "IsChecked": true, "ReportValue": "InTime", "ReportHeader": "In Time", "SequenceHeader": 17}, {"SequenceNo": 18, "IsChecked": true, "ReportValue": "OutTime", "ReportHeader": "Out Time", "SequenceHeader": 18}, {"SequenceNo": 19, "IsChecked": true, "ReportValue": "Duration", "ReportHeader": "Duration", "SequenceHeader": 19}, {"SequenceNo": 20, "IsChecked": true, "ReportValue": "LateBy", "ReportHeader": "LateBy", "SequenceHeader": 20}, {"SequenceNo": 21, "IsChecked": true, "ReportValue": "EarlyBy", "ReportHeader": "EarlyBy", "SequenceHeader": 21}, {"SequenceNo": 22, "IsChecked": false, "ReportValue": "LeaveType", "ReportHeader": "LeaveType", "SequenceHeader": 22}, {"SequenceNo": 23, "IsChecked": false, "ReportValue": "LeaveStatus", "ReportHeader": "Leave Status", "SequenceHeader": 23}, {"SequenceNo": 24, "IsChecked": false, "ReportValue": "LeaveRemarks", "ReportHeader": "Leave Remarks", "SequenceHeader": 24}, {"SequenceNo": 25, "IsChecked": false, "ReportValue": "IsonSpecialOff", "ReportHeader": "IsonSpecialOff", "SequenceHeader": 25}, {"SequenceNo": 26, "IsChecked": false, "ReportValue": "ReportPunchRecords", "ReportHeader": "Punch Records", "SequenceHeader": 26}, {"SequenceNo": 27, "IsChecked": false, "ReportValue": "P1Status", "ReportHeader": "P1Status", "SequenceHeader": 27}, {"SequenceNo": 28, "IsChecked": false, "ReportValue": "P2Status", "ReportHeader": "P2Status", "SequenceHeader": 28}, {"SequenceNo": 29, "IsChecked": false, "ReportValue": "P3Status", "ReportHeader": "P3Status", "SequenceHeader": 29}, {"SequenceNo": 30, "IsChecked": true, "ReportValue": "OverTime", "ReportHeader": "Over Time", "SequenceHeader": 30}, {"SequenceNo": 31, "IsChecked": true, "ReportValue": "AttStatus", "ReportHeader": "Att Status", "SequenceHeader": 31}, {"SequenceNo": 32, "IsChecked": true, "ReportValue": "StatusCode", "ReportHeader": "Status Code", "SequenceHeader": 32}, {"SequenceNo": 33, "IsChecked": false, "ReportValue": "EarlyIN", "ReportHeader": "Early IN", "SequenceHeader": 33}, {"SequenceNo": 34, "IsChecked": false, "ReportValue": "InDeviceName", "ReportHeader": "InDeviceName", "SequenceHeader": 34}, {"SequenceNo": 35, "IsChecked": false, "ReportValue": "InDeviceLocation", "ReportHeader": "InDeviceLocation", "SequenceHeader": 35}, {"SequenceNo": 36, "IsChecked": false, "ReportValue": "OutDeviceName", "ReportHeader": "OutDeviceName", "SequenceHeader": 36}, {"SequenceNo": 37, "IsChecked": false, "ReportValue": "OutDeviceLocation", "ReportHeader": "OutDeviceLocation", "SequenceHeader": 37}, {"SequenceNo": 38, "IsChecked": false, "ReportValue": "InTimeDateTime", "ReportHeader": "InTimeDateTime", "SequenceHeader": 38}, {"SequenceNo": 39, "IsChecked": false, "ReportValue": "OutTimeDateTime", "ReportHeader": "OutTimeDateTime", "SequenceHeader": 39}, {"SequenceNo": 40, "IsChecked": false, "ReportValue": "OverTime1", "ReportHeader": "OverTime1", "SequenceHeader": 40}, {"SequenceNo": 41, "IsChecked": false, "ReportValue": "OverTime2", "ReportHeader": "OverTime2", "SequenceHeader": 41}, {"SequenceNo": 42, "IsChecked": false, "ReportValue": "TotalDuration", "ReportHeader": "TotalDuration", "SequenceHeader": 42}, {"SequenceNo": 43, "IsChecked": false, "ReportValue": "ShiftBeginDateTime", "ReportHeader": "ShiftBeginDateTime", "SequenceHeader": 43}, {"SequenceNo": 44, "IsChecked": false, "ReportValue": "ShiftEndDateTime", "ReportHeader": "ShiftEndDateTime", "SequenceHeader": 44}, {"SequenceNo": 45, "IsChecked": false, "ReportValue": "CardNumber", "ReportHeader": "CardNumber", "SequenceHeader": 45}, {"SequenceNo": 46, "IsChecked": false, "ReportValue": "ShiftHours", "ReportHeader": "ShiftHours", "SequenceHeader": 46}, {"SequenceNo": 47, "IsChecked": false, "ReportValue": "ReservedField", "ReportHeader": "Header^Value", "SequenceHeader": 47}]};

function parseCsv(text: string): string[][] {
  return text.split(/\r?\n/).filter(Boolean).map((l) => l.split(","));
}
class Jar {
  c = new Map<string, string>();
  take(res: Response) {
    const list = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const s of list) { const [kv] = s.split(";"); const i = kv.indexOf("="); this.c.set(kv.slice(0, i), kv.slice(i + 1)); }
  }
  header() { return Array.from(this.c, ([k, v]) => `${k}=${v}`).join("; "); }
}
async function fetchExport(date: string, password: string): Promise<string> {
  const jar = new Jar();
  const r1 = await fetch(`${BASE}/Login/LoginClick`, {
    method: "POST", redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ LoginName: CLOUD, Password: password, CompanyName: CLOUD }),
  });
  jar.take(r1);
  const j1 = (await r1.json().catch(() => ({}))) as { success?: boolean };
  if (!j1.success) throw new Error("SmartApp sign-in failed");
  const r2 = await fetch(`${BASE}/AttendanceReport/GenerateExportAttendanceLogs`, {
    method: "POST", headers: { cookie: jar.header(), "content-type": "application/json" },
    body: JSON.stringify({ ...REPORT, FromDate: date, ToDate: date }),
  });
  jar.take(r2);
  const j2 = (await r2.json().catch(() => ({}))) as { success?: boolean; fileName?: string };
  if (!j2.success || !j2.fileName) throw new Error("SmartApp export failed");
  const r3 = await fetch(`${BASE}/AttendanceReport/DownloadExportAttendanceLogs?fileName=${encodeURIComponent(j2.fileName)}`, { headers: { cookie: jar.header() } });
  if (!r3.ok) throw new Error(`SmartApp download failed (${r3.status})`);
  return await r3.text();
}
function istYesterday(): string {
  const now = new Date(Date.now() + 5.5 * 3600_000);
  now.setUTCDate(now.getUTCDate() - 1);
  return now.toISOString().slice(0, 10);
}
function workedHours(inT: string, outT: string): number {
  const s = (t: string) => { const m = t.trim().slice(-8).split(":").map(Number); return (m[0] ?? 0) + (m[1] ?? 0) / 60 + (m[2] ?? 0) / 3600; };
  const d = s(outT) - s(inT);
  return d < 0 ? d + 24 : d;
}

export const Route = createFileRoute("/api/public/hooks/sohcm-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as unknown as { from: (t: string) => any };
        const key = request.headers.get("x-sync-key") ?? "";
        const hash = createHash("sha256").update(key).digest("hex");
        const { data: k } = await db.from("alertcheckin_cron_keys").select("key_hash").eq("key_hash", hash).maybeSingle();
        if (!key || !k) return new Response("Unauthorized", { status: 401 });

        let date = istYesterday();
        try { const b = (await request.json()) as { date?: string }; if (b?.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) date = b.date; } catch { /* empty body */ }

        const { data: run } = await db.from("alertcheckin_sync_runs").insert({ sync_date: date, source: "sohcm" }).select("id").single();
        const stats = { rows_read: 0, inserted: 0, skipped: 0, unmatched: 0 };
        try {
          const rows = parseCsv(await fetchExport(date));
          const h = rows.shift() ?? [];
          const col = (n: string) => h.indexOf(n);
          const cCode = col("Employee Code"), cName = col("Employee Name"), cLoc = col("Location"), cIn = col("In Time"), cOut = col("Out Time");
          if (cCode < 0 || cIn < 0 || cOut < 0) throw new Error("SmartApp export format changed");
          const punched = rows.filter((r) => r[cIn] && r[cOut]);
          stats.rows_read = punched.length;

          const { data: units } = await db.from("units").select("id").eq("customer_id", CUSTOMER_ID);
          const unitIds = (units ?? []).map((u: any) => u.id);
          const { data: posts } = await db.from("candidate_units")
            .select("unit_id,candidate_id,designation_id,is_reliever,shift_hours,candidates!inner(employee_code,role_key,non_billable)")
            .in("unit_id", unitIds);
          const byCode = new Map<string, any>();
          for (const p of (posts ?? []) as any[]) {
            if (p.candidates.role_key === "field_officer" || p.candidates.non_billable) continue;
            const c = String(p.candidates.employee_code ?? "");
            const cur = byCode.get(c);
            if (!cur || (cur.is_reliever && !p.is_reliever)) byCode.set(c, p);
          }
          const unmatched: any[] = [];
          const done = new Set<string>();
          for (const r of punched) {
            const hrs = workedHours(r[cIn], r[cOut]);
            const p = byCode.get(r[cCode]);
            const site = cLoc >= 0 ? r[cLoc] : "";
            if (!p) { unmatched.push({ sync_date: date, source: "sohcm", ac_site_name: site, staff_name: `${r[cCode]} ${r[cName] ?? ""}`.trim(), reason: "Employee code not posted at an Alfa site", hours: hrs }); continue; }
            if (hrs < 4) { stats.skipped++; continue; }
            const kk = `${p.unit_id}|${p.candidate_id}`;
            if (done.has(kk)) continue;
            done.add(kk);
            const { data: ex } = await db.from("attendance_entries").select("id").eq("unit_id", p.unit_id).eq("candidate_id", p.candidate_id).eq("entry_date", date).limit(1);
            if (ex?.length) { stats.skipped++; continue; }
            const rel = !!p.is_reliever;
            const ed = rel ? Math.max(hrs, 8) / 8 : Math.max(0, hrs - 8) / 8;
            const sh = [8, 12].includes(Number(p.shift_hours)) ? Number(p.shift_hours) : 0;
            const { error } = await db.from("attendance_entries").insert({
              unit_id: p.unit_id, candidate_id: p.candidate_id, entry_date: date, code: rel ? "" : "P",
              ot_hours: Math.round(ed * 10000) / 10000, designation_id: p.designation_id, shift_hours: sh, is_reliever: rel,
            });
            if (error) { stats.skipped++; unmatched.push({ sync_date: date, source: "sohcm", ac_site_name: site, staff_name: r[cCode], unit_id: p.unit_id, reason: error.message, hours: hrs }); }
            else stats.inserted++;
          }
          stats.unmatched = unmatched.length;
          if (unmatched.length) await db.from("alertcheckin_unmatched").upsert(unmatched, { onConflict: "sync_date,ac_site_name,staff_name", ignoreDuplicates: true });
          await db.from("alertcheckin_sync_runs").update({ ...stats, finished_at: new Date().toISOString() }).eq("id", run?.id);
          return Response.json({ date, ...stats });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await db.from("alertcheckin_sync_runs").update({ ...stats, error: msg, finished_at: new Date().toISOString() }).eq("id", run?.id);
          return Response.json({ date, error: msg }, { status: 500 });
        }
      },
    },
  },
});
