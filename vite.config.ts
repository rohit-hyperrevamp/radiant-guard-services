import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// The populated Radiant Supabase Cloud database is the application's single source of truth.
// Vite bakes `import.meta.env.VITE_*` into browser code, so pin the public client
// configuration for both preview and production instead of allowing preview to
// silently connect to a another empty database.
const PRODUCTION_SUPABASE_CLIENT = {
  VITE_SUPABASE_PROJECT_ID: "yimpxawqoarprhtxapie",
  VITE_SUPABASE_URL: "https://yimpxawqoarprhtxapie.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpbXB4YXdxb2FycHJodHhhcGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTgyMzYsImV4cCI6MjEwMzMzNDIzNn0.6MaMS-my38sgzBhVkYJ0-GNT7SMIhy3C61gKNmFKq1o",
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
