import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// The Radiant production database is the application's single source of truth.
// Vite bakes `import.meta.env.VITE_*` into browser code, so pin the public client
// configuration for both preview and production instead of allowing preview to
// silently connect to a separate empty database.
const PRODUCTION_SUPABASE_CLIENT = {
  VITE_SUPABASE_PROJECT_ID: "fglmoiuizgavuniffslm",
  VITE_SUPABASE_URL: "https://fglmoiuizgavuniffslm.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnbG1vaXVpemdhdnVuaWZmc2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MDM2ODgsImV4cCI6MjA5Mzk3OTY4OH0.3foRI1Sla14hwE57ckwXQU_rT8B9rpPiGbH3BZGzV6Y",
};

const define = Object.fromEntries(
  Object.entries(PRODUCTION_SUPABASE_CLIENT).map(([key, value]) => [
    `import.meta.env.${key}`,
    JSON.stringify(value),
  ]),
);

export default defineConfig({
  nitro: { preset: "vercel" },
  // Disables the wrapper's injected preview values so the single binding wins.
  envDefine: false,
  vite: { define },
});
