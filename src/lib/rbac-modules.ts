// Single source of truth for the RBAC module/sub-module registry.
// Both the editor (admin.rbac.tsx) and any future enforcement helpers
// import from here so module keys stay consistent.

import {
  BadgeCheck,
  Bell,
  Boxes,
  Briefcase,
  Building2,
  Calculator,
  CalendarDays,
  CalendarHeart,
  CalendarRange,
  Car,
  ClipboardList,
  Clock,
  Coins,
  CreditCard,
  DatabaseZap,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Files,
  Fuel,
  HandCoins,
  LayoutDashboard,
  Languages,
  LogOut,
  MapPin,
  PackageOpen,
  Receipt,
  ReceiptText,
  Shield,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  Warehouse,
  Wind,
  Wrench,
} from "lucide-react";

export type SubModuleDef = {
  key: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type ModuleDef = {
  key: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  subModules: SubModuleDef[];
};

export const RBAC_MODULES: ModuleDef[] = [
  {
    key: "organizations",
    label: "Organizations",
    path: "/admin/customers",
    icon: LayoutDashboard,
    subModules: [
      { key: "state_manager",        label: "State Manager",        path: "/admin/customers/state-manager",    icon: MapPin },
      { key: "branch_manager",       label: "Branch Manager",       path: "/admin/customers/branch-manager",   icon: Building2 },
      { key: "organization_manager", label: "Organizations", path: "/admin/customers/customer-manager", icon: Users },
      { key: "unit_manager",         label: "Clients",         path: "/admin/customers/unit-manager",     icon: Warehouse },
    ],
  },
  {
    key: "contracts",
    label: "Contracts",
    path: "/admin/contracts/client-contracts",
    icon: Files,
    subModules: [
      { key: "client_contracts", label: "Client Contracts (view / edit / delete contract)", path: "/admin/contracts/client-contracts", icon: FileText },
      { key: "create", label: "Create / Copy Contracts", path: "/admin/contracts/client-contracts#create", icon: FileText },
      { key: "resources", label: "Manage Resources (add / copy / remove)", path: "/admin/contracts/client-contracts#resources", icon: FileText },
      { key: "rate_revision", label: "Revise Rates (Copy as revised rate)", path: "/admin/contracts/client-contracts#rate-revision", icon: FileText },
      { key: "edit_existing_rates", label: "Edit Existing Contract Rates", path: "/admin/contracts/client-contracts#edit-existing-rates", icon: FileText },
    ],
  },
  {
    key: "sales_marketing",
    label: "Sales & Marketing",
    path: "/admin/sales/dashboard",
    icon: Sparkles,
    subModules: [
      { key: "dashboard", label: "Sales Dashboard", path: "/admin/sales/dashboard", icon: LayoutDashboard },
      { key: "prospects", label: "Prospects (add / edit / delete / convert)", path: "/admin/sales/prospects", icon: Users },
      { key: "quotes",    label: "Quotes", path: "/admin/sales/quotes", icon: FileText },
    ],
  },
  {
    key: "recruitment",
    label: "Recruitment",
    path: "/admin/hr/recruitment/dashboard",
    icon: Sparkles,
    subModules: [
      { key: "dashboard",  label: "Recruitment Dashboard", path: "/admin/hr/recruitment/dashboard", icon: LayoutDashboard },
      { key: "candidates", label: "Candidates", path: "/admin/hr/recruitment/candidates", icon: Users },
      { key: "openings",   label: "Openings", path: "/admin/hr/recruitment/openings", icon: FileText },
      { key: "interviews", label: "Interviews", path: "/admin/hr/recruitment/interviews", icon: Clock },
      { key: "onboarding", label: "Onboarding Requests", path: "/admin/hr/recruitment/onboarding", icon: UserPlus },
    ],
  },
  {
    key: "employees",
    label: "Employees",
    path: "/admin/employees",
    icon: UserPlus,
    subModules: [
      { key: "create",    label: "Add / onboard employees (Edit)",   path: "/admin/employees#create",    icon: UserPlus },
      { key: "edit",      label: "Edit employee details (Edit)",     path: "/admin/employees#edit",      icon: Users },
      { key: "wages",     label: "Salary / wages (View / Edit)",     path: "/admin/employees#wages",     icon: Wallet },
      { key: "offboard",  label: "Offboard employees (Edit)",        path: "/admin/employees#offboard",  icon: LogOut },
      { key: "approvals", label: "Approve onboarding (Approve)",     path: "/admin/employees#approvals", icon: BadgeCheck },
      { key: "mapping",   label: "Manage unit / designation / manager mapping (Edit)", path: "/admin/employees#mapping", icon: Users },
    ],
  },
  {
    key: "training",
    label: "Training Center",
    path: "/admin/training",
    icon: FileSignature,
    subModules: [],
  },
  {
    key: "vehicles",
    label: "Vehicles",
    path: "/admin/vehicles",
    icon: Briefcase,
    subModules: [
      { key: "vehicle_inventory",  label: "Vehicle Inventory",   path: "/admin/vehicles/inventory",  icon: Briefcase },
      { key: "fastag_manager",     label: "FastTag Manager",     path: "/admin/vehicles/fastags",    icon: Briefcase },
      { key: "insurance_manager",  label: "Insurance Manager",   path: "/admin/vehicles/insurances", icon: ShieldCheck },
      { key: "puc_manager",        label: "PUC Manager",         path: "/admin/vehicles/pucs",       icon: Briefcase },
      { key: "service_manager",    label: "Service Manager",     path: "/admin/vehicles/service-manager", icon: Wrench },
      { key: "expense_manager",    label: "Expense Manager",     path: "/admin/vehicles/expense-manager", icon: Fuel },
    ],
  },
  {
    key: "assets",
    label: "Assets",
    path: "/admin/assets",
    icon: Building2,
    subModules: [
      { key: "asset_inventory", label: "Asset Inventory", path: "/admin/assets/inventory",        icon: Building2 },
      { key: "loan_manager",    label: "Loan Manager",    path: "/admin/assets/loan-manager",     icon: HandCoins },
      { key: "expense_manager", label: "Expense Manager", path: "/admin/assets/expense-manager",  icon: ReceiptText },
    ],
  },
  {
    key: "inventory",
    label: "Uniform Manager",
    path: "/admin/inventory",
    icon: Boxes,
    subModules: [
      { key: "inventory_dashboard", label: "Uniform Dashboard", path: "/admin/inventory/dashboard",       icon: LayoutDashboard },
      { key: "inventory_workflows", label: "Uniform Workflows", path: "/admin/inventory/workflows",       icon: Sparkles },
      { key: "item_master",       label: "Products",          path: "/admin/inventory/items",           icon: PackageOpen },
      { key: "vendors",           label: "Vendors",           path: "/admin/inventory/vendors",         icon: ShoppingBag },
      { key: "warehouses",        label: "Warehouses",        path: "/admin/inventory/warehouses",      icon: Warehouse },
      { key: "purchase_orders",   label: "Purchase Orders",   path: "/admin/inventory/purchase-orders", icon: FileText },
      { key: "goods_receipts",    label: "Delivery Challans", path: "/admin/inventory/goods-receipts",  icon: ClipboardList },
      { key: "demands",           label: "Demands",           path: "/admin/inventory/demands",         icon: ClipboardList },
      { key: "transfers",         label: "Transfers",         path: "/admin/inventory/transfers",       icon: Boxes },
      { key: "issuances",         label: "Issuances",         path: "/admin/inventory/issuances",       icon: UserPlus },
      { key: "collections",       label: "Collections",       path: "/admin/inventory/collections",     icon: UserPlus },
      { key: "inventory_caps",    label: "Uniform Caps",      path: "/admin/inventory/caps",            icon: ShieldCheck },
      { key: "my_inventory",      label: "My Uniform",        path: "/admin/my-inventory",              icon: PackageOpen },
      { key: "field_dashboard",   label: "Field Dashboard",   path: "/admin/field-dashboard",           icon: LayoutDashboard },

      { key: "stock_report",      label: "Stock Report",      path: "/admin/inventory/stock",           icon: Wallet },
      { key: "stock_ledger",      label: "Stock Ledger",      path: "/admin/inventory/stock-ledger",    icon: Wallet },
      { key: "rate_cards",        label: "Vendor Rate Cards", path: "/admin/inventory/rate-cards",      icon: FileText },
    ],

  },
  {
    key: "attendance",
    label: "Attendance",
    path: "/admin/attendance",
    icon: ClipboardList,
    subModules: [
      { key: "mark",    label: "Mark / edit attendance (Edit)",          path: "/admin/attendance#mark",    icon: ClipboardList },
      { key: "upload",  label: "Upload attendance sheet (Edit)",         path: "/admin/attendance#upload",  icon: FileSpreadsheet },
      { key: "submit",  label: "Submit for approval (Edit)",             path: "/admin/attendance#submit",  icon: FileText },
      { key: "approve", label: "Approve / reject attendance (Approve)",  path: "/admin/attendance#approve", icon: BadgeCheck },
      { key: "reopen",  label: "Reopen approved attendance (Approve)",   path: "/admin/attendance#reopen",  icon: ClipboardList },
      { key: "amend",   label: "Amend after payroll paid (Approve)",     path: "/admin/attendance#amend",   icon: ClipboardList },
      { key: "all_units", label: "Work on all units — otherwise only mapped units (View)", path: "/admin/attendance#all-units", icon: Building2 },
    ],
  },
  {
    key: "payroll",
    label: "Payroll",
    path: "/admin/payroll",
    icon: Wallet,
    subModules: [
      { key: "submit",  label: "Submit payroll for approval (Edit)",                        path: "/admin/payroll#submit",  icon: FileText },
      { key: "approve", label: "Approve / reject payroll (Approve) — plus Workflow approvers", path: "/admin/payroll#approve", icon: BadgeCheck },
      { key: "process", label: "Process payroll & bank file (Edit) — plus Workflow processors", path: "/admin/payroll#process", icon: Wallet },
      { key: "reopen",  label: "Reopen approved payroll (Approve)",                         path: "/admin/payroll#reopen",  icon: Wallet },
    ],
  },
  {
    key: "invoice",
    label: "Invoice",
    path: "/admin/invoice",
    icon: Receipt,
    subModules: [
      { key: "finalise",     label: "Finalise invoices (Edit)",     path: "/admin/invoice#finalise",     icon: Receipt },
      { key: "upload_tally", label: "Upload Tally invoice (Edit)", path: "/admin/invoice#upload-tally", icon: FileText },
    ],
  },
  {
    key: "control_center",
    label: "Control Center",
    path: "/admin/control-center",
    icon: SlidersHorizontal,
    subModules: [
      { key: "professional_tax_manager", label: "Professional Tax Manager", path: "/admin/professional-tax-manager", icon: ReceiptText },
      { key: "lwf_manager",              label: "Labour Welfare Fund",      path: "/admin/lwf-manager",              icon: HandCoins },
      { key: "duty_manager",             label: "Duty Manager",             path: "/admin/duty-manager",             icon: Clock },
      { key: "attendance_code_manager",  label: "Attendance Code Manager",  path: "/admin/attendance-code-manager",  icon: CalendarDays },
      { key: "public_holiday_manager",    label: "Public Holiday Manager",    path: "/admin/public-holiday-manager",    icon: CalendarHeart },
      { key: "service_type_manager",     label: "Service Type Manager",     path: "/admin/service-type-manager",     icon: Briefcase },
      { key: "payroll_manager",          label: "Payroll Manager",          path: "/admin/payroll-manager",          icon: CalendarRange },
      { key: "payroll_days_manager",     label: "Payroll Days Manager",     path: "/admin/payroll-days-manager",     icon: CalendarDays },
      { key: "allowance_manager",        label: "Allowance Manager",        path: "/admin/allowance-manager",        icon: Coins },
      { key: "addition_type_manager",    label: "Addition Type Manager",    path: "/admin/addition-type-manager",    icon: HandCoins },
      { key: "deduction_type_manager",   label: "Deduction Type Manager",   path: "/admin/deduction-type-manager",   icon: HandCoins },
      { key: "billing_type_manager",     label: "Billing Type Manager",     path: "/admin/billing-type-manager",     icon: Receipt },
      { key: "designation_manager",      label: "Designation Manager",      path: "/admin/designation-manager",      icon: BadgeCheck },
      { key: "department_manager",       label: "Department Manager",       path: "/admin/department-manager",       icon: BadgeCheck },
      { key: "platform_settings",        label: "Platform Settings",        path: "/admin/platform-settings",        icon: SlidersHorizontal },
      { key: "cost_component_manager",   label: "Cost Component Manager",   path: "/admin/cost-component-manager",   icon: Calculator },
      { key: "ex_service_manager",       label: "Ex-Service Manager",       path: "/admin/ex-service-manager",       icon: Shield },
      { key: "offboarding_reason_manager", label: "Offboarding Reason Manager", path: "/admin/offboarding-reason-manager", icon: LogOut },
      { key: "esic_branch_manager",      label: "ESIC Branch Manager",      path: "/admin/esic-branch-manager",      icon: Building2 },
      { key: "invoice_numbering",        label: "Invoice Numbering",        path: "/admin/invoice-numbering",        icon: Receipt },
      { key: "mis_manager",              label: "MIS Manager",              path: "/admin/mis-manager",              icon: FileSpreadsheet },
      { key: "asset_manager",            label: "Asset Manager",            path: "/admin/asset-manager",            icon: PackageOpen },
      { key: "language_manager",         label: "Language Manager",         path: "/admin/language-manager",         icon: Languages },
      { key: "company_documents",        label: "Company Documents",        path: "/admin/company-documents",        icon: FileSignature },
      { key: "policy_manager",           label: "Policy Manager",           path: "/admin/policy-manager",           icon: FileSignature },
      { key: "roles_manager",            label: "Roles Manager",            path: "/admin/roles-manager",            icon: ShieldCheck },
      { key: "workflows",                label: "Workflow Manager",         path: "/admin/workflow-manager",         icon: Sparkles },
      { key: "system_logs",              label: "System Logs",              path: "/admin/system-logs",              icon: ClipboardList },
      { key: "migration_utility",         label: "Data Migration",           path: "/admin/migration-utility",         icon: DatabaseZap },
      { key: "org_settings",              label: "Company Settings",         path: "/admin/org-settings",              icon: Building2 },

    ],
  },

  {
    key: "field_sense",
    label: "Radar",
    path: "/admin/field-sense",
    icon: MapPin,
    subModules: [
      { key: "dashboard",       label: "Dashboard",       path: "/admin/field-sense",          icon: LayoutDashboard },
      { key: "day_patrol",      label: "Day Patrol",      path: "/admin/field-sense/team",     icon: Users },
      { key: "expense_manager", label: "Expense Manager", path: "/admin/field-sense/expenses", icon: Wallet },
      { key: "reports",         label: "Reports",         path: "/admin/field-sense/reports",  icon: FileText },
    ],
  },
  {
    key: "notification_center",
    label: "Notification Center",
    path: "/admin/notifications",
    icon: Bell,
    subModules: [],
  },
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/admin/dashboard",
    icon: LayoutDashboard,
    // Dashboard widgets. No row = visible (subject to the data module);
    // an explicit row from role/department/designation/employee decides.
    subModules: [
      { key: "w_readiness", label: "Readiness: attendance / payroll / invoices approved vs open", path: "", icon: LayoutDashboard },
      { key: "w_live_people", label: "Live now: field officers & staff", path: "", icon: LayoutDashboard },
      { key: "w_orgs", label: "Organizations tile", path: "", icon: LayoutDashboard },
      { key: "w_units", label: "Clients tile", path: "", icon: LayoutDashboard },
      { key: "w_contracts", label: "Contracts tile", path: "", icon: LayoutDashboard },
      { key: "w_contract_designations", label: "Contract designation follow-up", path: "", icon: LayoutDashboard },
      { key: "w_emp", label: "Employees tile", path: "", icon: LayoutDashboard },
      { key: "w_uan", label: "UAN follow-up", path: "", icon: LayoutDashboard },
      { key: "w_veh", label: "Vehicles tile", path: "", icon: LayoutDashboard },
      { key: "w_inv", label: "Inventory tile", path: "", icon: LayoutDashboard },
      { key: "w_att", label: "Attendance tile", path: "", icon: LayoutDashboard },
      { key: "w_pay", label: "Payroll tile", path: "", icon: LayoutDashboard },
      { key: "w_inv2", label: "Invoicing tile", path: "", icon: LayoutDashboard },
      { key: "w_onb", label: "Pending onboarding tile", path: "", icon: LayoutDashboard },
      { key: "w_fo", label: "Field officers tiles", path: "", icon: LayoutDashboard },
      { key: "w_people_insights", label: "Birthdays & anniversaries", path: "", icon: LayoutDashboard },
      { key: "w_employee_insights", label: "Employee insights", path: "", icon: LayoutDashboard },
      { key: "w_contract_portfolio", label: "Client contract portfolio", path: "", icon: LayoutDashboard },
      { key: "w_payroll_coverage", label: "Payroll coverage", path: "", icon: LayoutDashboard },
      { key: "w_invoice_coverage", label: "Invoice coverage", path: "", icon: LayoutDashboard },
      { key: "w_profitability", label: "Profitability", path: "", icon: LayoutDashboard },
      { key: "w_radar", label: "Radar & visits", path: "", icon: LayoutDashboard },
      { key: "w_org_tree", label: "Organization tree", path: "", icon: LayoutDashboard },
    ],
  },
  {
    key: "my_attendance",
    label: "My Attendance",
    path: "/admin/my-attendance",
    icon: ClipboardList,
    subModules: [],
  },
  {
    key: "profile",
    label: "Profile",
    path: "/admin/profile",
    icon: BadgeCheck,
    subModules: [],
  },
  {
    key: "rbac",
    label: "Role-Based Access Control",
    path: "/admin/rbac",
    icon: ShieldCheck,
    subModules: [],
  },
];

// Export permission: every data module gets an "export" switch (View = may
// download XLS/PDF/CSV). No explicit row = follows the module's View access.
export const EXPORT_CAPABLE_MODULES = [
  "organizations", "contracts", "sales_marketing", "recruitment", "employees", "vehicles",
  "assets", "inventory", "attendance", "payroll", "invoice", "control_center", "field_sense",
];
for (const m of RBAC_MODULES) {
  if (!EXPORT_CAPABLE_MODULES.includes(m.key)) continue;
  if (m.key === "contracts") {
    m.subModules.push({
      key: "expiry_alerts",
      label: "Contract expiry alerts (View = receive 15/10/5/3/2/1-day notices)",
      path: `${m.path}#expiry-alerts`,
      icon: m.icon,
    });
  }
  m.subModules.push({ key: "export", label: "Export data (View = can download)", path: `${m.path}#export`, icon: m.icon });
}

/** Module whose page is at this pathname (longest prefix wins). */
export function moduleForPath(pathname: string): string | null {
  let best: { key: string; len: number } | null = null;
  for (const m of RBAC_MODULES) {
    const paths = [m.path, ...m.subModules.map((s) => s.path.split("#")[0])];
    for (const p of paths) {
      if (!p) continue;
      const base = p.replace(/\/[^/]*$/, "") || p; // module section, e.g. /admin/inventory
      for (const cand of [p, base]) {
        if ((pathname === cand || pathname.startsWith(cand + "/")) && (!best || cand.length > best.len)) {
          best = { key: m.key, len: cand.length };
        }
      }
    }
  }
  return best?.key ?? null;
}

export type PermissionAction = "view" | "edit" | "delete" | "approve";
export const PERMISSION_ACTIONS: PermissionAction[] = ["view", "edit", "delete", "approve"];

// Modules where the "approve" permission is meaningful. Add module keys here
// when introducing other approval-gated workflows (e.g. write-offs, payroll runs).
// Keep this list as the single source of truth — the RBAC editor reads it to
// decide which rows show the Approve checkbox, and runtime checks call
// `moduleSupportsApprove` before evaluating an approval permission.
export const APPROVE_CAPABLE_MODULES: ReadonlySet<string> = new Set(["contracts", "attendance", "payroll", "invoice", "employees", "control_center", "recruitment", "inventory"]);

export function moduleSupportsApprove(moduleKey: string): boolean {
  return APPROVE_CAPABLE_MODULES.has(moduleKey);
}
