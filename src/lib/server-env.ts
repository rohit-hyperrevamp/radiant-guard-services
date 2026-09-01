// Server-side backend binding for production deployments.
//
// The platform-managed `.env` in this repo points at the Lovable preview
// backend, and the deployment host may have no Supabase variables set at all.
// To make production self-configuring (no host dashboard steps), the external
// "Radiant" Supabase project is baked in here and applied to `process.env`
// before any server code reads it.
//
// Called from `src/server.ts` on every request entry, so it runs ahead of every
// server function and SSR render. Never imported by browser code.
const PRODUCTION_SUPABASE: Record<string, string> = {
  SUPABASE_PROJECT_ID: "yimpxawqoarprhtxapie",
  SUPABASE_URL: "https://yimpxawqoarprhtxapie.supabase.co",
  SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpbXB4YXdxb2FycHJodHhhcGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTgyMzYsImV4cCI6MjEwMzMzNDIzNn0.6MaMS-my38sgzBhVkYJ0-GNT7SMIhy3C61gKNmFKq1o",
  SUPABASE_SERVICE_ROLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpbXB4YXdxb2FycHJodHhhcGllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzc1ODIzNiwiZXhwIjoyMTAzMzM0MjM2fQ.bKutUzXNVuFCZA2erF79oII_cwTzMvh3vrLwsne25Xw",
  // Surepass (Aadhaar validation + DigiLocker). Sandbox token, valid to 01 Oct 2026.
  SUREPASS_BASE_URL: "https://sandbox.surepass.io",
  SUREPASS_TOKEN:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc4ODI2Mjg3MSwianRpIjoiNWJjZTVmYTctMDZlMi00Njk5LWE2MTMtZDAwZTdjMmY3ZjQ0IiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoiZGV2LmhoeXBlcnJldmFtcEBzdXJlcGFzcy5pbyIsIm5iZiI6MTc4ODI2Mjg3MSwiZXhwIjoxNzkwODU0ODcxLCJlbWFpbCI6ImhoeXBlcnJldmFtcEBzdXJlcGFzcy5pbyIsInRlbmFudF9pZCI6Im1haW4iLCJ1c2VyX2NsYWltcyI6eyJzY29wZXMiOlsidXNlciJdfX0.S7FMqvifH7hLN1fczXrrGhlupU45y2Lq85wY4ebVJoc",
};


let applied = false;

/**
 * Pins server-side Supabase env vars to the external production project.
 * No-op in development, so the in-editor preview keeps its injected values.
 */
export function applyProductionServerEnv(): void {
  if (applied) return;
  applied = true;
  if (!import.meta.env.PROD) return;
  if (typeof process === "undefined" || !process.env) return;
  for (const key of Object.keys(PRODUCTION_SUPABASE)) {
    process.env[key] = PRODUCTION_SUPABASE[key];
  }
}
