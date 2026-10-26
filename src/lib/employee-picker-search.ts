import { serverSearchWords } from "./search-match";

/** Numeric input may be an employee ID or a phone number, never phone-only. */
export function employeePickerSearchFilters(term: string): string[] {
  const digits = term.replace(/\D/g, "");
  if (digits.length >= 4 && /^[\d\s+()-]+$/.test(term.trim())) {
    const phone = digits.length > 10 && digits.startsWith("91") ? digits.slice(-10) : digits;
    return [`employee_code.ilike.%${digits}%,mobile.ilike.%${phone}%`];
  }
  return serverSearchWords(term).map(
    (word) => `full_name.ilike.%${word}%,employee_code.ilike.%${word}%,mobile.ilike.%${word}%`,
  );
}