import { useUnitDesignations } from "@/lib/unit-designations";
import { SearchSelect } from "@/components/SearchSelect";

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
      <SearchSelect
        value={value ?? ""}
        onChange={(next) => onChange(next || null)}
        disabled={disabled || q.isLoading || options.length === 0}
        className="w-full text-xs"
        placeholder={q.isLoading
            ? "Loading designations…"
            : options.length === 0
              ? "No enabled designations available"
              : "Select designation…"}
        options={[
          { value: "", label: "Select designation…" },
          ...options.filter((d) => d.inContract).map((d) => ({ value: d.id, label: d.name, hint: "On this unit's contract" })),
          ...options.filter((d) => !d.inContract).map((d) => ({ value: d.id, label: d.name, hint: "Not on contract — contract follow-up" })),
        ]}
      />
      {!q.isLoading && value && options.some((d) => d.id === value && !d.inContract) && (
        <p className="mt-1 text-[10px] font-medium text-amber-600">
          This designation is not yet in the unit contract. It will be followed up with Finance for seven days.
        </p>
      )}
    </div>
  );
}
