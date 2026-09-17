// Notification feed visibility follows RBAC: a notification about a module the
// signed-in role cannot access is never shown (e.g. Finance never sees
// inventory demand / issuance traffic). Mapping is derived from the RBAC
// registry, with explicit entries for notification prefixes that do not match
// a module or sub-module key one-to-one.

import { RBAC_MODULES } from "./rbac-modules";

const KEY_TO_MODULE = new Map<string, string>();
for (const m of RBAC_MODULES) {
  KEY_TO_MODULE.set(m.key, m.key);
  for (const s of m.subModules) KEY_TO_MODULE.set(s.key, m.key);
}

const EXPLICIT: Record<string, string> = {
  inventory: "inventory",
  inventory_demands: "inventory",
  inventory_issuances: "inventory",
  inventory_delivery_challans: "inventory",
  inventory_goods_receipts: "inventory",
  inventory_purchase_orders: "inventory",
  inventory_transfers: "inventory",
  inventory_adjustments: "inventory",
  inventory_stock: "inventory",
  inventory_items: "inventory",
  inventory_vendors: "inventory",
  inventory_warehouses: "inventory",
  contract: "contracts",
  contracts: "contracts",
  contract_resources: "contracts",
  client_contracts: "contracts",
  employees: "employees",
  candidate: "employees",
  rehire: "employees",
  rehire_request: "employees",
  attendance: "attendance",
  payroll: "payroll",
  invoice: "invoice",
  invoice_extra_charges: "invoice",
  clients: "organizations",
  organizations: "organizations",
  unit_manager: "organizations",
  customer_manager: "organizations",
  field_visit: "field_sense",
  field_visits: "field_sense",
};

/** Module key a notification belongs to, or null when it is role-agnostic. */
export function notificationModuleKey(type?: string | null): string | null {
  if (!type) return null;
  const t = type.toLowerCase();
  const head = t.includes(":") ? t.split(":")[0]! : t;
  if (EXPLICIT[head]) return EXPLICIT[head];
  if (KEY_TO_MODULE.has(head)) return KEY_TO_MODULE.get(head)!;
  for (const [k, v] of Object.entries(EXPLICIT)) {
    if (head.startsWith(`${k}_`)) return v;
  }
  for (const [k, v] of KEY_TO_MODULE.entries()) {
    if (head.startsWith(`${k}_`)) return v;
  }
  return null;
}

export function filterNotificationsByAccess<T extends { type: string }>(
  items: T[],
  can: (moduleKey: string) => boolean,
): T[] {
  return items.filter((n) => {
    const moduleKey = notificationModuleKey(n.type);
    return !moduleKey || can(moduleKey);
  });
}
