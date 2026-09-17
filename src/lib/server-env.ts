// Server-side binding for the application's single populated production Supabase database.
//
// Platform-managed preview variables can point at a separate empty database.
// Apply the Radiant binding before server code reads the environment so preview
// and deployed requests cannot diverge.
//
// Called from `src/server.ts` on every request entry, so it runs ahead of every
// server function and SSR render. Never imported by browser code.
const PRODUCTION_SUPABASE: Record<string, string> = {
  SUPABASE_PROJECT_ID: "yimpxawqoarprhtxapie",
  SUPABASE_URL: "https://yimpxawqoarprhtxapie.supabase.co",
  SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpbXB4YXdxb2FycHJodHhhcGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTgyMzYsImV4cCI6MjEwMzMzNDIzNn0.6MaMS-my38sgzBhVkYJ0-GNT7SMIhy3C61gKNmFKq1o",
  // Radiant production service-role key (server-only; never bundled to the browser).
  SUPABASE_SERVICE_ROLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpbXB4YXdxb2FycHJodHhhcGllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzc1ODIzNiwiZXhwIjoyMTAzMzM0MjM2fQ.bKutUzXNVuFCZA2erF79oII_cwTzMvh3vrLwsne25Xw",
  // Surepass credentials are NOT pinned here: they rotate, so they live only in
  // the encrypted secret store (SUREPASS_API_KEY, SUREPASS_BASE_URL).
};


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
