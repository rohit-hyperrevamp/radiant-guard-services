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
  // Note: SUPABASE_SERVICE_ROLE_KEY is not hard-coded here; it is supplied by the
  // Lovable Cloud runtime when a server function legitimately needs admin access.
  // Surepass (Aadhaar validation + DigiLocker). Sandbox token, valid to 01 Oct 2026.
  SUREPASS_BASE_URL: "https://sandbox.surepass.io",
  SUREPASS_TOKEN:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc4ODI2Mjg3MSwianRpIjoiNWJjZTVmYTctMDZlMi00Njk5LWE2MTMtZDAwZTdjMmY3ZjQ0IiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoiZGV2LmhoeXBlcnJldmFtcEBzdXJlcGFzcy5pbyIsIm5iZiI6MTc4ODI2Mjg3MSwiZXhwIjoxNzkwODU0ODcxLCJlbWFpbCI6ImhoeXBlcnJldmFtcEBzdXJlcGFzcy5pbyIsInRlbmFudF9pZCI6Im1haW4iLCJ1c2VyX2NsYWltcyI6eyJzY29wZXMiOlsidXNlciJdfX0.S7FMqvifH7hLN1fczXrrGhlupU45y2Lq85wY4ebVJoc",
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
