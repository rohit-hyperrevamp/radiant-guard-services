import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * useState that survives leaving and coming back to a page in the same tab
 * (e.g. open a unit, then press Back). Stored in sessionStorage under `key`.
 */
export function useSessionState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const fallback = typeof initial === "function" ? (initial as () => T)() : initial;
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.sessionStorage.getItem(`filters:${key}`);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      window.sessionStorage.setItem(`filters:${key}`, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  }, [key, value]);
  return [value, setValue];
}
