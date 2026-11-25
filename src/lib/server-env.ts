// Server-side binding for the application's single populated production Supabase database.
//
// The public project values (URL, publishable key) are pinned so every request
// talks to the Radiant database. The service-role key is a secret: it is read
// at runtime from the hosting environment (Vercel → SUPABASE_SERVICE_ROLE_KEY)
// and never committed to source.
//
// Called from `src/server.ts` on every request entry, so it runs ahead of every
// server function and SSR render. Never imported by browser code.
export const PRODUCTION_SUPABASE: Record<string, string> = {
  SUPABASE_PROJECT_ID: "yimpxawqoarprhtxapie",
  SUPABASE_URL: "https://yimpxawqoarprhtxapie.supabase.co",
  SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpbXB4YXdxb2FycHJodHhhcGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTgyMzYsImV4cCI6MjEwMzMzNDIzNn0.6MaMS-my38sgzBhVkYJ0-GNT7SMIhy3C61gKNmFKq1o",
};

/** Service-role key from the runtime environment (bracket access so builds never inline it). */
export function supabaseServiceRoleKey(): string {
  const key = typeof process !== "undefined" ? process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() : "";
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on this deployment.");
  return key;
}

let applied = false;

/**
 * Pins server-side database env vars to the Radiant production project.
 */
export function applyProductionServerEnv(): void {
  if (applied) return;
  applied = true;
  if (typeof process === "undefined" || !process.env) return;
  for (const key of Object.keys(PRODUCTION_SUPABASE)) {
    process.env[key] = PRODUCTION_SUPABASE[key];
  }
}
