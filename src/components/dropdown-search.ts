import { useDeferredValue, useMemo } from "react";
import { buildSearchHay, compileSearch } from "@/lib/search-match";

export type DropdownOption = { value: string; label: string; hint?: string };

/** Index once per option list; searching never changes the source list or order. */
export function indexDropdownOptions<T extends DropdownOption>(options: T[]) {
  return options.map((option) => ({ option, hay: buildSearchHay([option.label, option.hint, option.value]) }));
}

export function filterDropdownOptions<T extends DropdownOption>(indexed: Array<{ option: T; hay: ReturnType<typeof buildSearchHay> }>, query: string): T[] {
  const test = compileSearch(query);
  return indexed.filter(({ hay }) => !test || test(hay)).map(({ option }) => option);
}

export function useDropdownSearch<T extends DropdownOption>(options: T[], query: string): T[] {
  const deferredQuery = useDeferredValue(query);
  const indexed = useMemo(() => indexDropdownOptions(options), [options]);
  return useMemo(() => filterDropdownOptions(indexed, deferredQuery), [indexed, deferredQuery]);
}