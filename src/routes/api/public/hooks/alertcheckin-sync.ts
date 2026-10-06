import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

// Nightly AlertCheckin -> attendance sync (called by pg_cron at 02:00 IST).
// Reads the previous day's check-in export, maps sites via alertcheckin_site_map,
// matches staff by name to guards posted at that unit, and inserts attendance:
// P per day, Extra Duty (stored in shift-days) = hours beyond 8 / 8; relievers ED-only.
// Never overwrites existing entries; unmatched rows go to alertcheckin_unmatched.

const BASE = "https://alertcheckin.com";
const STOP = new Set(["poonawalla", "fincorp", "limited", "ltd", "road", "rd", "the"]);
const toks = (s: string) =>
  new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t)));
function nameScore(a: string, b: string) {
  const A = toks(a), B = toks(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  A.forEach((t) => { if (B.has(t)) n++; });
  return n / Math.min(A.size, B.size);
}

function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); out.push(row); row = []; cur = "";
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out;
}

class Jar {
  c = new Map<string, string>();
  take(res: Response) {
    const list = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const s of list) { const [kv] = s.split(";"); const i = kv.indexOf("="); this.c.set(kv.slice(0, i), kv.slice(i + 1)); }
  }
  header() { return Array.from(this.c, ([k, v]) => `${k}=${v}`).join("; "); }
}

async function fetchExport(date: string, creds: { email: string; password: string }): Promise<string> {
  const jar = new Jar();
  const r1 = await fetch(`${BASE}/login`, { redirect: "manual" });
  jar.take(r1);
  const html = await r1.text();
  const token = html.match(/name="_token" value="([^"]+)"/)?.[1];
  if (!token) throw new Error("AlertCheckin login page changed");
  const body = new URLSearchParams({ _token: token, email: creds.email, password: creds.password });
  const r2 = await fetch(`${BASE}/login`, { method: "POST", body, redirect: "manual", headers: { cookie: jar.header(), "content-type": "application/x-www-form-urlencoded" } });
  jar.take(r2);
  if (!(r2.headers.get("location") ?? "").includes("/dashboard")) throw new Error(`AlertCheckin sign-in failed (status ${r2.status}, cookies ${jar.c.size}, creds ${creds.email ? "set" : "missing"})`);
  const r3 = await fetch(`${BASE}/dashboard/export?date=${date}&group_id=all&client_id=all`, { headers: { cookie: jar.header() } });
  if (!r3.ok) throw new Error(`AlertCheckin export failed (${r3.status})`);
  return await r3.text();
}

function istYesterday(): string {
  const now = new Date(Date.now() + 5.5 * 3600_000);
  now.setUTCDate(now.getUTCDate() - 1);
  return now.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/api/public/hooks/alertcheckin-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/lib/radiant-admin.server");
        const db = supabaseAdmin as unknown as { from: (t: string) => any };
        const key = request.headers.get("x-sync-key") ?? "";
        const hash = createHash("sha256").update(key).digest("hex");
        const { data: k } = await db.from("alertcheckin_cron_keys").select("key_hash").eq("key_hash", hash).maybeSingle();
        if (!key || !k) return new Response("Unauthorized", { status: 401 });

        let date = istYesterday();
        try { const b = (await request.json()) as { date?: string }; if (b?.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) date = b.date; } catch { /* empty body */ }

        const { data: run } = await db.from("alertcheckin_sync_runs").insert({ sync_date: date }).select("id").single();
        const stats = { rows_read: 0, inserted: 0, skipped: 0, unmatched: 0 };
        try {
          let creds = { email: process.env["ALERTCHECKIN_EMAIL"] ?? "", password: process.env["ALERTCHECKIN_PASSWORD"] ?? "" };
          if (!creds.email || !creds.password) {
            const { data: c } = await db.from("alertcheckin_credentials").select("email,password").eq("id", 1).maybeSingle();
            if (c) creds = { email: c.email, password: c.password };
          }
          const rows = parseCsv(await fetchExport(date, creds)).slice(7).filter((r) => r.length >= 9 && r[0]);
          const { data: maps } = await db.from("alertcheckin_site_map").select("ac_site_name,unit_id");
          const siteMap = new Map<string, string>((maps ?? []).map((m: any) => [m.ac_site_name, m.unit_id]));
          const mapped = rows.filter((r) => siteMap.has(r[2]));
          stats.rows_read = mapped.length;
          const unitIds = Array.from(new Set(mapped.map((r) => siteMap.get(r[2])!)));
          const posts: any[] = [];
          for (let i = 0; i < unitIds.length; i += 100) {
            // No FK from candidate_units to candidates, so join in code.
            const { data, error } = await db.from("candidate_units")
              .select("unit_id,candidate_id,designation_id,is_reliever,shift_hours")
              .in("unit_id", unitIds.slice(i, i + 100));
            if (error) throw new Error(`Postings read failed: ${error.message}`);
            posts.push(...(data ?? []));
          }
          const candIds = Array.from(new Set(posts.map((p) => p.candidate_id)));
          const people = new Map<string, any>();
          for (let i = 0; i < candIds.length; i += 200) {
            const { data, error } = await db.from("candidates").select("id,full_name,role_key,non_billable").in("id", candIds.slice(i, i + 200));
            if (error) throw new Error(`Guards read failed: ${error.message}`);
            for (const c of data ?? []) people.set(c.id, c);
          }
          for (const p of posts) p.candidates = people.get(p.candidate_id) ?? { full_name: "", role_key: "", non_billable: true };
          const guards = posts.filter((p) => p.candidates.role_key !== "field_officer" && !p.candidates.non_billable);
          const agg = new Map<string, { unit_id: string; candidate_id: string; designation_id: string | null; rel: boolean; hrs: number; shift: number }>();
          const unmatched: any[] = [];
          const { data: aliases } = await db.from("alertcheckin_staff_map").select("ac_site_name,staff_name,candidate_id");
          const alias = new Map<string, string>((aliases ?? []).map((a: any) => [`${a.ac_site_name}|${a.staff_name}`, a.candidate_id]));
          for (const r of mapped) {
            const unit = siteMap.get(r[2])!;
            let best: any = null, bs = 0;
            const aliasId = alias.get(`${r[2]}|${r[0]}`);
            if (aliasId) { best = guards.find((g) => g.unit_id === unit && g.candidate_id === aliasId) ?? null; bs = best ? 1 : 0; }
            if (!best) for (const g of guards) if (g.unit_id === unit) { const s = nameScore(r[0], g.candidates.full_name); if (s > bs) { bs = s; best = g; } }
            const hrs = r[4] && r[5] ? Number(r[5]) || 0 : 0;
            if (!best || bs < 0.5) { unmatched.push({ sync_date: date, ac_site_name: r[2], staff_name: r[0], unit_id: unit, reason: "No matching guard posted at this site", hours: hrs }); continue; }
            const kk = `${unit}|${best.candidate_id}`;
            const a = agg.get(kk) ?? { unit_id: unit, candidate_id: best.candidate_id, designation_id: best.designation_id, rel: !!best.is_reliever, hrs: 0, shift: [8, 12].includes(Number(best.shift_hours)) ? Number(best.shift_hours) : 0 };
            a.hrs += hrs; agg.set(kk, a);
          }
          for (const a of agg.values()) {
            const { data: ex } = await db.from("attendance_entries").select("id").eq("unit_id", a.unit_id).eq("candidate_id", a.candidate_id).eq("entry_date", date).limit(1);
            if (ex?.length) { stats.skipped++; continue; }
            const ed = a.rel ? Math.max(a.hrs, 8) / 8 : Math.max(0, a.hrs - 8) / 8;
            const { error } = await db.from("attendance_entries").insert({
              unit_id: a.unit_id, candidate_id: a.candidate_id, entry_date: date, code: a.rel ? "" : "P",
              ot_hours: Math.round(ed * 10000) / 10000, designation_id: a.designation_id, shift_hours: a.shift, is_reliever: a.rel,
            });
            if (error) { stats.skipped++; unmatched.push({ sync_date: date, ac_site_name: "", staff_name: a.candidate_id, unit_id: a.unit_id, reason: error.message, hours: a.hrs }); }
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
