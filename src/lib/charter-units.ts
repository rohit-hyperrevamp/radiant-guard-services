import { supabase } from "@/integrations/supabase/client";
import { fetchActiveClientIds } from "@/lib/active-clients";
import { visibleClientRows } from "@/lib/client-visibility";

/**
 * Shared unit roster used by the Attendance / Invoice / Payroll charters.
 *
 * This used to pull `units`, `candidates`, `candidate_units`,
 * `employee_scope_assignments`, `customers`, `designations` and
 * `client_contracts` page by page and join them in the browser. With ~4000
 * units that meant a dozen round trips through row-level policies, so the page
 * either crawled or timed out ("Could not load attendance units right now").
 *
 * It now reads one pre-joined payload from `get_attendance_charter_units()`
 * (~300ms server-side) and derives the small lookups locally. The last good
 * payload is kept in localStorage so the charter paints instantly on revisit
 * and refreshes quietly behind it.
 */

export type EmployeeRef = { id: string; name: string };

export type ClientEmployee = {
  id: string;
  name: string;
  designation: string;
  unit_id: string;
  unit_name: string;
  unit_code: string;
};

export type CharterUnitRow = {
  id: string;
  code: string;
  name: string;
  location: string;
  branch_id: string | null;
  customer_id: string;
  customer_name: string;
  customer_code: string;
  billing_state: string | null;
  billing_city: string | null;
  /** Client Detail state/city (falls back to billing server-side). Drives filters. */
  client_state?: string | null;
  client_city?: string | null;
  contract_codes: string[];
  contract_end: string | null;
  active_employee_count: number;
  security_guards: EmployeeRef[];
};

export type CharterPageData = {
  units: CharterUnitRow[];
  organizations: { id: string; name: string; code: string }[];
  employeesByCustomer: Record<string, ClientEmployee[]>;
  summary: { organizations: number; units: number; activeEmployees: number };
};

export const CHARTER_UNITS_QK = ["charter-units-v3-active"] as const;

const SNAPSHOT_PREFIX = "radiant:charter-units";
const SNAPSHOT_VERSION = "v4";

/**
 * The fallback snapshot is owned by the signed-in user (keyed by auth id),
 * never carries guard names, and every other user's or older unkeyed copy
 * is removed on write and on sign-out — a shared device must not show the
 * previous person's roster.
 */
export function charterSnapshotKey(owner: string): string {
  return `${SNAPSHOT_PREFIX}:${SNAPSHOT_VERSION}:${owner}`;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Remove charter snapshots that don't belong to `keepOwner` (all when null). */
export function clearCharterSnapshots(keepOwner: string | null = null) {
  const store = storage();
  if (!store) return;
  try {
    const keep = keepOwner ? charterSnapshotKey(keepOwner) : null;
    const stale: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && key.startsWith(SNAPSHOT_PREFIX) && key !== keep) stale.push(key);
    }
    for (const key of stale) store.removeItem(key);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

let authWatch = false;
function watchIdentity() {
  if (authWatch || typeof window === "undefined") return;
  authWatch = true;
  try {
    supabase.auth.onAuthStateChange((_event, session) => {
      clearCharterSnapshots(session?.user.id ?? null);
    });
  } catch {
    authWatch = false;
  }
}

async function currentOwner(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

function readSnapshot(owner: string | null): CharterPageData | null {
  const store = storage();
  if (!store || !owner) return null;
  try {
    const raw = store.getItem(charterSnapshotKey(owner));
    if (!raw) return null;
    const rows = JSON.parse(raw) as CharterUnitRow[];
    if (!Array.isArray(rows)) return null;
    return buildPageData(rows);
  } catch {
    return null;
  }
}

function writeSnapshot(owner: string | null, rows: CharterUnitRow[]) {
  const store = storage();
  if (!store) return;
  clearCharterSnapshots(owner);
  if (!owner) return;
  try {
    // Unit facts only: employee names stay out of persistent storage.
    const slim = rows.map((row) => ({ ...row, security_guards: [] }));
    store.setItem(charterSnapshotKey(owner), JSON.stringify(slim));
  } catch {
    /* storage full or unavailable — cache is optional */
  }
}

export function readCharterUnitsSnapshot(): CharterPageData | null {
  // Browser snapshots cannot establish the current client status.
  return null;
}

function buildPageData(rows: CharterUnitRow[]): CharterPageData {
  const units = rows.map((u) => ({
    ...u,
    location: u.location || "",
    billing_city: u.billing_city ?? null,
    customer_id: u.customer_id || "",
    customer_name: u.customer_name || "—",
    customer_code: u.customer_code || "",
    contract_codes: u.contract_codes ?? [],
    security_guards: u.security_guards ?? [],
    active_employee_count: Number(u.active_employee_count ?? 0),
  }));

  const organizations = Array.from(
    new Map(
      units.map((r) => [
        r.customer_id || r.customer_name,
        { id: r.customer_id || r.customer_name, name: r.customer_name, code: r.customer_code },
      ]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const employeesByCustomer: Record<string, ClientEmployee[]> = {};
  for (const r of units) {
    const key = r.customer_id || r.customer_name;
    for (const sg of r.security_guards) {
      if (!employeesByCustomer[key]) employeesByCustomer[key] = [];
      if (!employeesByCustomer[key].some((e) => e.id === sg.id && e.unit_id === r.id)) {
        employeesByCustomer[key].push({
          id: sg.id,
          name: sg.name,
          designation: "",
          unit_id: r.id,
          unit_name: r.name || r.code,
          unit_code: r.code,
        });
      }
    }
  }
  for (const key of Object.keys(employeesByCustomer)) {
    employeesByCustomer[key].sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    units,
    organizations,
    employeesByCustomer,
    summary: {
      organizations: organizations.length,
      units: units.length,
      activeEmployees: units.reduce((s, r) => s + r.active_employee_count, 0),
    },
  };
}

export async function fetchCharterUnits(): Promise<CharterPageData> {
  watchIdentity();
  const [activeIds, owner] = await Promise.all([fetchActiveClientIds(), currentOwner()]);
  const { data, error } = await supabase.rpc("get_attendance_charter_units" as never);
  if (error) {
    const cached = readSnapshot(owner);
    if (cached) return buildPageData(visibleClientRows(cached.units, activeIds));
    throw error;
  }
  const payload = (data ?? {}) as { units?: CharterUnitRow[] };
  const rows = visibleClientRows(payload.units ?? [], activeIds);
  writeSnapshot(owner, rows);
  return buildPageData(rows);
}
