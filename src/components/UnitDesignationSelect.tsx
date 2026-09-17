import { useUnitDesignations } from "@/lib/unit-designations";

/**
 * Choose which contracted designation (role slot) a person fills at a unit.
 * Contracted options come first; all other enabled designations remain selectable.
 */
export function UnitDesignationSelect({
  unitId,
  value,
  onChange,
  disabled,
  className = "",
}: {
  unitId: string;
  value: string | null;
  onChange: (designationId: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const q = useUnitDesignations(unitId);
  const options = q.data ?? [];

  return (
    <div className={className}>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled || q.isLoading || options.length === 0}
        className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-[12px] disabled:opacity-60"
      >
        <option value="">
          {q.isLoading
            ? "Loading designations…"
            : options.length === 0
              ? "No enabled designations available"
              : "Select designation…"}
        </option>
        {options.some((d) => d.inContract) && <optgroup label="On this unit's contract">{options.filter((d) => d.inContract).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>}
        {options.some((d) => !d.inContract) && <optgroup label="Other designations — contract follow-up">{options.filter((d) => !d.inContract).map((d) => <option key={d.id} value={d.id}>{d.name} — not on contract</option>)}</optgroup>}
      </select>
      {!q.isLoading && value && options.some((d) => d.id === value && !d.inContract) && (
        <p className="mt-1 text-[10px] font-medium text-amber-600">
          This designation is not yet in the unit contract. It will be followed up with Finance for seven days.
        </p>
      )}
    </div>
  );
}
