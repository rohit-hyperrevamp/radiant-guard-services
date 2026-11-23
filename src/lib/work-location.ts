export type WorkPerson = { id: string; full_name: string; employee_code: string | null; kind: 'field_officer' | 'guard' | 'driver'; present: boolean; check_in_at: string | null; check_out_at: string | null; lat: number | null; lng: number | null; accuracy: number | null; located_at: string | null; location_source: 'check_in' | 'telemetry'; unit_name: string | null };
export type WorkPeople = { total: number; present: number; onDuty: number; rows: WorkPerson[] };
export function indiaDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function locationFreshness(person: Pick<WorkPerson,'located_at'|'location_source'>, now = Date.now()) {
  if (!person.located_at) return 'unavailable';
  if (person.location_source === 'check_in') return 'check_in';
  return now - new Date(person.located_at).getTime() <= 120_000 ? 'recent' : 'stale';
}
export function trackingEligible(role: string | null, designation: string) { return role === 'field_officer' || (role === 'transport' && /\bdriver\b/i.test(designation)); }
export function usableLocationFix(timestamp: number, accuracy: number | null, now = Date.now()) { return Number.isFinite(timestamp) && now - timestamp <= 60_000 && timestamp <= now + 5_000 && accuracy != null && accuracy >= 0 && accuracy <= 100; }
export function validWorkCoordinates(lat: number | null, lng: number | null) {
  return lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
}
export function previousIndiaDate(date = indiaDate()) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}