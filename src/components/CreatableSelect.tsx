import * as React from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SearchSelectOption } from "@/components/SearchSelect";
import { useDropdownSearch } from "@/components/dropdown-search";

/** Searchable dropdown that also lets you add a typed name that isn't in the list. */
export function CreatableSelect({
  value,
  label,
  onChange,
  onCreate,
  options,
  placeholder = "Select or type…",
  disabled,
  className,
}: {
  value: string;
  /** Text to show when value isn't one of the options (e.g. a typed name). */
  label?: string | null;
  onChange: (value: string) => void;
  onCreate: (text: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const filtered = useDropdownSearch(options, query).slice(0, 200);
  const exact = options.some((o) => o.label.toLowerCase() === q);
  const shown = options.find((o) => o.value === value)?.label ?? label ?? "";
  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" disabled={disabled}
          className={cn("h-10 w-full justify-between rounded-md border-input bg-background px-3 font-normal", className)}>
          <span className={cn("truncate text-left", !shown && "text-muted-foreground")}>{shown || placeholder}</span>
          <span className="flex items-center">
            {shown && !disabled && (
              <X className="mr-1 h-3.5 w-3.5 opacity-60 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); onChange(""); }} />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-56 p-0" align="start"
        onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search or type a new name…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-64 overflow-y-auto overscroll-contain">
            {!q && <CommandEmpty>Nothing found.</CommandEmpty>}
            <CommandGroup>
              {q && !exact && (
                <CommandItem value={`__create__${query}`} onSelect={() => { onCreate(query.trim()); setQuery(""); setOpen(false); }}>
                  <Plus className="mr-2 h-4 w-4 text-primary" />
                  <span className="truncate text-sm">Add “{query.trim()}”</span>
                </CommandItem>
              )}
              {filtered.map((o) => (
                <CommandItem key={o.value} value={`${o.label} ${o.hint ?? ""} ${o.value}`}
                  onSelect={() => { onChange(o.value); setQuery(""); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">{o.label}</span>
                    {o.hint && <span className="truncate text-[11px] text-muted-foreground">{o.hint}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
