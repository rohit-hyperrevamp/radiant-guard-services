import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarHeart, DatabaseZap, FileBadge, BadgeCheck, Briefcase, Building2, Calculator, CalendarCheck, CalendarDays, CalendarRange, ClipboardList, Clock, Coins, FileSignature, FileSpreadsheet, HandCoins, Languages, LogOut, MapPin, Network, Package, Receipt, ReceiptText, Settings, Shield, ShieldCheck, Workflow, TrendingUp, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/admin/control-center")({
  component: ControlCenterDashboard,
});

type Tile = {
  to: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const tiles: Tile[] = [
  {
    to: "/admin/customers/state-manager",
    label: "States",
    description: "State and statutory details.",
    icon: MapPin,
  },
  {
    to: "/admin/customers/branch-manager",
    label: "Branches",
    description: "Branches and locations.",
    icon: Building2,
  },
  {
    to: "/admin/professional-tax-manager",
    label: "Professional Tax",
    description: "State tax slabs and rates.",
    icon: ReceiptText,
  },
  {
    to: "/admin/lwf-manager",
    label: "Labour Welfare Fund",
    description: "State contribution rules.",
    icon: HandCoins,
  },
  {
    to: "/admin/duty-manager",
    label: "Duty Types",
    description: "Duty hours and shifts.",
    icon: Clock,
  },
  {
    to: "/admin/attendance-code-manager",
    label: "Attendance Codes",
    description: "Daily attendance codes.",
    icon: CalendarCheck,
  },
  {
    to: "/admin/public-holiday-manager",
    label: "Public Holidays",
    description: "Holiday calendar.",
    icon: CalendarHeart,
  },

  {
    to: "/admin/service-type-manager",
    label: "Service Types",
    description: "Security and staffing services.",
    icon: Briefcase,
  },
  {
    to: "/admin/payroll-manager",
    label: "Payroll Cycle",
    description: "Payroll dates and processing day.",
    icon: CalendarRange,
  },
  {
    to: "/admin/payroll-days-manager",
    label: "Payroll Days",
    description: "Salary day rules.",
    icon: CalendarDays,
  },
  {
    to: "/admin/allowance-manager",
    label: "Allowances",
    description: "Payroll earnings.",
    icon: Coins,
  },
  {
    to: "/admin/addition-type-manager",
    label: "Addition Types",
    description: "Bonus and incentive types.",
    icon: TrendingUp,
  },
  {
    to: "/admin/deduction-type-manager",
    label: "Deduction Types",
    description: "Advance and deduction types.",
    icon: TrendingDown,
  },
  {
    to: "/admin/billing-type-manager",
    label: "Billing Types",
    description: "Hours, days and monthly billing.",
    icon: Receipt,
  },
  {
    to: "/admin/designation-manager",
    label: "Designations",
    description: "Employee roles and posts.",
    icon: BadgeCheck,
  },
  {
    to: "/admin/platform-settings",
    label: "Platform Settings",
    description: "Sign-in and app controls.",
    icon: Settings,
  },
  {
    to: "/admin/department-manager",
    label: "Departments",
    description: "Company departments.",
    icon: Network,
  },

  {
    to: "/admin/cost-component-manager",
    label: "Cost Components",
    description: "EPF, ESI, bonus and more.",
    icon: Calculator,
  },
  {
    to: "/admin/ex-service-manager",
    label: "Ex-Service Ranks",
    description: "Service branch and rank.",
    icon: Shield,
  },
  {
    to: "/admin/offboarding-reason-manager",
    label: "Offboarding Reasons",
    description: "Exit reasons.",
    icon: LogOut,
  },
  {
    to: "/admin/esic-branch-manager",
    label: "ESIC Branches",
    description: "Branch codes and zones.",
    icon: Building2,
  },
  {
    to: "/admin/asset-manager",
    label: "Asset Types",
    description: "Uniforms, IDs and devices.",
    icon: Package,
  },
  {
    to: "/admin/language-manager",
    label: "Languages",
    description: "Profile languages.",
    icon: Languages,
  },
  {
    to: "/admin/company-documents",
    label: "Company Documents",
    description: "NDA and appointment templates.",
    icon: FileSignature,
  },
  {
    to: "/admin/policy-manager",
    label: "Policies",
    description: "Insurance and company policies.",
    icon: FileBadge,
  },
  {
    to: "/admin/roles-manager",
    label: "Roles",
    description: "Create and edit roles.",
    icon: ShieldCheck,
  },

  {
    to: "/admin/rbac",
    label: "Access Control",
    description: "Role permissions.",
    icon: ShieldCheck,
  },
  {
    to: "/admin/workflow-manager",
    label: "Workflows",
    description: "Approval steps and roles.",
    icon: Workflow,
  },
  {
    to: "/admin/migration-utility",
    label: "Data Migration",
    description: "Import attendance files.",
    icon: DatabaseZap,
  },
  {
    to: "/admin/org-settings",
    label: "Company Settings",
    description: "Company, tax and bank details.",
    icon: Building2,
  },
  {
    to: "/admin/mis-manager",
    label: "MIS Sheets",
    description: "Client-wise MIS formats.",
    icon: FileSpreadsheet,
  },


];

function ControlCenterDashboard() {
  return (
    <div>
      <div className="relative">
        <PageHeader
          title="Control Center"
          description="App settings and rules."
          crumbs={[{ label: "Control Center" }]}
        />
        <Link
          to="/admin/system-logs"
          aria-label="System Logs"
          title="System Logs"
          className="group absolute right-0 top-0 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground/80 transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
        >
          <Settings className="h-4 w-4 transition-transform group-hover:rotate-45" />
          <span className="hidden sm:inline">System Logs</span>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.to}
            to={tile.to}
            className="group relative flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent/40 hover:bg-accent/5"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <tile.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-base font-bold tracking-tight text-foreground">
                {tile.label}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{tile.description}</p>
            </div>
            <div className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-accent">
              Open
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
