import { Link, useLocation } from "@tanstack/react-router";
import { CalendarDays, TrendingUp, TrendingDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/admin/payroll", label: "Payroll", icon: CalendarDays },
  { to: "/admin/additions", label: "Additions", icon: TrendingUp },
  { to: "/admin/deductions", label: "Deductions", icon: TrendingDown },
  { to: "/admin/employer-contributions", label: "Employer Contributions", icon: Building2 },
];

export function PayrollTabs() {
  const location = useLocation();

  return (
    <div className="scrollbar-hide flex w-full items-center gap-1 overflow-x-auto rounded-xl bg-secondary/55 p-1 sm:rounded-2xl">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = location.pathname === tab.to || location.pathname.startsWith(tab.to + "/");
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all sm:h-10 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-sm",
              active
                ? "bg-gradient-to-br from-white to-accent/[0.08] text-foreground ring-1 ring-inset ring-accent/25 shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_6px_16px_-10px_color-mix(in_oklab,var(--accent)_45%,transparent)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
