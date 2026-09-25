import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Emp = { id: string; full_name: string | null; employee_code: string | null };

/** Searchable single-employee picker (by name or employee ID). Empty value = none. */
export function EmployeePicker({
  value,
  onChange,
  placeholder = "Select employee",
  roleKey,
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** When set, only employees with this role_key are listed. */
  roleKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const selectedQ = useQuery({
    queryKey: ["employee-picker-one", value],
    enabled: Boolean(value),
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase.from("candidates").select("id,full_name,employee_code").eq("id", value).maybeSingle();
      return (data ?? null) as Emp | null;
    },
  });

  const listQ = useQuery({
    queryKey: ["employee-picker-search", term, roleKey ?? ""],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("candidates")
        .select("id,full_name,employee_code")
        .not("employee_code", "is", null)
        .order("full_name", { ascending: true })
        .limit(30);
      if (roleKey) q = q.eq("role_key", roleKey);
      if (term) {
        const safe = term.replace(/[%,()]/g, " ");
        q = q.or(`full_name.ilike.%${safe}%,employee_code.ilike.%${safe}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Emp[];
    },
  });

  const label = (e: Emp) => `${e.full_name ?? "Unnamed"}${e.employee_code ? ` (${e.employee_code})` : ""}`;
  const current = value ? selectedQ.data : null;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-10 w-full justify-between rounded-xl px-3 text-left text-sm font-normal", !current && "text-muted-foreground")}
        >
          <span className="truncate">{current ? label(current) : placeholder}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-1rem))] p-0">
        <div className="border-b border-border/60 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or employee ID…" className="h-8 pl-8 text-sm" autoFocus />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {listQ.isLoading ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">Searching…</p>
          ) : (listQ.data ?? []).length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">No matches.</p>
          ) : (
            (listQ.data ?? []).map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => { onChange(e.id); setOpen(false); }}
                className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-secondary/60"
              >
                <Check className={cn("h-4 w-4 shrink-0", e.id === value ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{label(e)}</span>
              </button>
            ))
          )}
        </div>
        {value && (
          <div className="border-t border-border/60 px-2 py-1.5">
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { onChange(""); setOpen(false); }}>
              <X className="h-3 w-3" /> Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
