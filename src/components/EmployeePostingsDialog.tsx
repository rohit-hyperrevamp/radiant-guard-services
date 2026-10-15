import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Radiant Pune office — payroll home of every non-billable employee. */
export const RADIANT_HOME_UNIT_ID = "92541381-14d3-4be6-ae8c-078b79c2e0f1";

const ORDINALS = ["Primary", "Secondary", "Tertiary", "4th", "5th", "6th", "7th", "8th"];
export function postingLabel(index: number) {
  return ORDINALS[index] ?? `${index + 1}th`;
}

type Posting = {
  id?: string;
  unit_id: string;
  unit_label: string;
  designation_id: string | null;
};

type Employee = {
  id: string;
  full_name: string;
  employee_code: string | null;
  role_key: string | null;
  designation_id: string | null;
  non_billable: boolean | null;
  unit_id: string | null;
};

type Props = {
  candidateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Billable / non-billable switch plus the employee's work postings. Postings
 * after the main one are secondary, tertiary… — each with its own billable
 * designation, so a Field Officer can also be paid as a Security Guard at a
 * client site.
 */
export function EmployeePostingsDialog({ candidateId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [nonBillable, setNonBillable] = useState(false);
  const [roleKey, setRoleKey] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [postings, setPostings] = useState<Posting[]>([]);
  const [original, setOriginal] = useState<Posting[]>([]);
  const [unitQuery, setUnitQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const roles = useQuery({
    queryKey: ["postings-dialog", "roles"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("roles" as never).select("key,name").order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as { key: string; name: string }[];
    },
  });
  const designations = useQuery({
    queryKey: ["postings-dialog", "designations"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designations" as never)
        .select("id,name,billable,enabled")
        .eq("enabled", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; billable: boolean }[];
    },
  });
  const unitSearch = useQuery({
    queryKey: ["postings-dialog", "units", unitQuery.trim()],
    enabled: unitQuery.trim().length >= 2,
    queryFn: async () => {
      const q = unitQuery.trim().replace(/[%,()]/g, " ");
      const { data, error } = await supabase
        .from("units" as never)
        .select("id,code,name,is_billable")
        .or(`code.ilike.%${q}%,name.ilike.%${q}%`)
        .neq("is_billable", false)
        .order("code")
        .limit(15);
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; code: string; name: string }[];
    },
  });

  useEffect(() => {
    if (!open || !candidateId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data: c }, { data: links }] = await Promise.all([
        supabase
          .from("candidates" as never)
          .select("id,full_name,employee_code,role_key,designation_id,non_billable,unit_id")
          .eq("id", candidateId)
          .maybeSingle(),
        supabase
          .from("candidate_units" as never)
          .select("id,unit_id,designation_id,is_primary,sort_order,is_reliever,units(code,name)")
          .eq("candidate_id", candidateId)
          .eq("is_reliever", false)
          .order("is_primary", { ascending: false })
          .order("sort_order"),
      ]);
      if (cancelled) return;
      const e = c as unknown as Employee | null;
      setEmp(e);
      setNonBillable(Boolean(e?.non_billable));
      setRoleKey(e?.role_key ?? "");
      setDesignationId(e?.designation_id ?? "");
      const rows = ((links ?? []) as unknown as Array<{
        id: string;
        unit_id: string;
        designation_id: string | null;
        units: { code: string; name: string } | null;
      }>)
        .filter((l) => l.unit_id !== RADIANT_HOME_UNIT_ID)
        .map((l) => ({
          id: l.id,
          unit_id: l.unit_id,
          designation_id: l.designation_id,
          unit_label: l.units ? `${l.units.code} · ${l.units.name}` : l.unit_id,
        }));
      setPostings(rows);
      setOriginal(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, candidateId]);

  const desigName = useMemo(
    () => new Map((designations.data ?? []).map((d) => [d.id, d.name])),
    [designations.data],
  );
  const billableDesigs = (designations.data ?? []).filter((d) => d.billable);
  const mainDesigOptions = (designations.data ?? []).filter((d) => (nonBillable ? !d.billable : d.billable));

  // Postings index offset: billable staff's first posting is their primary unit;
  // non-billable staff's primary is the Radiant office, so client postings start at Secondary.
  const offset = nonBillable ? 1 : 0;

  const addUnit = (u: { id: string; code: string; name: string }) => {
    if (postings.some((p) => p.unit_id === u.id)) return;
    const defaultDesig =
      billableDesigs.find((d) => /security guard/i.test(d.name))?.id ?? billableDesigs[0]?.id ?? null;
    setPostings((p) => [...p, { unit_id: u.id, unit_label: `${u.code} · ${u.name}`, designation_id: defaultDesig }]);
    setUnitQuery("");
  };

  const save = async () => {
    if (!emp) return;
    if (!roleKey) return toast.error("Pick a role");
    if (!designationId) return toast.error("Pick a main designation");
    if (postings.some((p) => !p.designation_id)) return toast.error("Pick a designation for every posting");
    if (!nonBillable && postings.length === 0)
      return toast.error("A billable employee needs at least one client posting (their primary unit)");
    setSaving(true);
    try {
      const homeUnit = nonBillable ? RADIANT_HOME_UNIT_ID : postings[0].unit_id;
      const before = { non_billable: emp.non_billable, role_key: emp.role_key, designation_id: emp.designation_id, unit_id: emp.unit_id };
      const after = { non_billable: nonBillable, role_key: roleKey, designation_id: designationId, unit_id: homeUnit };
      const { error: cErr } = await supabase
        .from("candidates" as never)
        .update(after as never)
        .eq("id", emp.id);
      if (cErr) throw cErr;

      // Remove dropped postings.
      const keep = new Set(postings.map((p) => p.id).filter(Boolean));
      const dropped = original.filter((o) => o.id && !keep.has(o.id)).map((o) => o.id!);
      if (dropped.length) {
        const { error } = await supabase.from("candidate_units" as never).delete().in("id", dropped);
        if (error) throw error;
      }
      // Clear primary first so the one-primary rule never trips mid-save.
      await supabase
        .from("candidate_units" as never)
        .update({ is_primary: false } as never)
        .eq("candidate_id", emp.id)
        .eq("is_primary", true);

      for (const [i, p] of postings.entries()) {
        const row = {
          designation_id: p.designation_id,
          sort_order: i + offset,
          is_primary: !nonBillable && i === 0,
          is_reliever: false,
        };
        if (p.id) {
          const { error } = await supabase.from("candidate_units" as never).update(row as never).eq("id", p.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("candidate_units" as never)
            .insert({ ...row, candidate_id: emp.id, unit_id: p.unit_id } as never);
          if (error) throw error;
        }
      }
      if (nonBillable) {
        const { data: home } = await supabase
          .from("candidate_units" as never)
          .select("id")
          .eq("candidate_id", emp.id)
          .eq("unit_id", RADIANT_HOME_UNIT_ID)
          .maybeSingle();
        if (!home) {
          await supabase.from("candidate_units" as never).insert({
            candidate_id: emp.id,
            unit_id: RADIANT_HOME_UNIT_ID,
            designation_id: designationId,
            is_primary: true,
            sort_order: 0,
          } as never);
        } else {
          await supabase
            .from("candidate_units" as never)
            .update({ is_primary: true, designation_id: designationId, sort_order: 0 } as never)
            .eq("id", (home as { id: string }).id);
        }
      }

      await logActivity({
        module: "Employees",
        action: "update",
        entityType: "employee",
        entityId: emp.id,
        entityLabel: `${emp.employee_code ?? ""} ${emp.full_name}`.trim(),
        before: { ...before, postings: original.map((p) => `${p.unit_label} / ${desigName.get(p.designation_id ?? "") ?? ""}`) },
        after: { ...after, postings: postings.map((p) => `${p.unit_label} / ${desigName.get(p.designation_id ?? "") ?? ""}`) },
      });
      toast.success("Billing type and postings saved");
      void qc.invalidateQueries();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
      toast.error(`Could not save: ${msg}`);
      await logActivity({ module: "Employees", action: "update", entityId: emp.id, status: "failure", errorMessage: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Billing type & postings</DialogTitle>
          <DialogDescription>
            {emp ? `${emp.employee_code ?? ""} · ${emp.full_name}` : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        {loading || !emp ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">{nonBillable ? "Non-billable" : "Billable"}</div>
                <div className="text-xs text-muted-foreground">
                  {nonBillable
                    ? "Paid from the Radiant Pune office. Client postings below are extra billable work."
                    : "Paid and billed at their primary client unit."}
                </div>
              </div>
              <Switch
                checked={!nonBillable}
                onCheckedChange={(v) => {
                  setNonBillable(!v);
                  setDesignationId("");
                }}
                aria-label="Billable"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-xs text-muted-foreground">Role</span>
                <Select value={roleKey} onValueChange={setRoleKey}>
                  <SelectTrigger><SelectValue placeholder="Pick role" /></SelectTrigger>
                  <SelectContent>
                    {(roles.data ?? []).map((r) => (
                      <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs text-muted-foreground">Main designation</span>
                <Select value={designationId} onValueChange={setDesignationId}>
                  <SelectTrigger><SelectValue placeholder="Pick designation" /></SelectTrigger>
                  <SelectContent>
                    {mainDesigOptions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Postings</div>
              {nonBillable && (
                <div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
                  <span className="font-medium">Primary:</span> Radiant Guards – Pune Office ({desigName.get(designationId) ?? "main designation"})
                </div>
              )}
              {postings.map((p, i) => (
                <div key={p.id ?? p.unit_id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
                  <span className="w-20 text-xs font-medium text-muted-foreground">{postingLabel(i + offset)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{p.unit_label}</span>
                  <Select
                    value={p.designation_id ?? ""}
                    onValueChange={(v) =>
                      setPostings((rows) => rows.map((r, j) => (j === i ? { ...r, designation_id: v } : r)))
                    }
                  >
                    <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Designation" /></SelectTrigger>
                    <SelectContent>
                      {billableDesigs.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Remove posting"
                    onClick={() => setPostings((rows) => rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="relative">
                <Input
                  value={unitQuery}
                  onChange={(e) => setUnitQuery(e.target.value)}
                  placeholder="Add a client unit — search by code (e.g. CLI530) or name"
                />
                {unitQuery.trim().length >= 2 && (
                  <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-md">
                    {unitSearch.isLoading && <div className="p-2 text-xs text-muted-foreground">Searching…</div>}
                    {(unitSearch.data ?? []).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => addUnit(u)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <Plus className="h-3.5 w-3.5" /> {u.code} · {u.name}
                      </button>
                    ))}
                    {unitSearch.data?.length === 0 && <div className="p-2 text-xs text-muted-foreground">No units found</div>}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Each posting shows on that unit's attendance, payroll and invoice in the chosen designation.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading || !emp}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
