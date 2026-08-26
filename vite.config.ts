import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Production builds are pinned to the external "Radiant" Supabase project.
// `.env` is platform-managed and still points at the Lovable preview backend,
// and Vite bakes `import.meta.env.VITE_*` in at build time — so the values are
// forced here instead of relying on host-configured environment variables.
const PRODUCTION_SUPABASE_CLIENT = {
  VITE_SUPABASE_PROJECT_ID: "yimpxawqoarprhtxapie",
  VITE_SUPABASE_URL: "https://yimpxawqoarprhtxapie.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpbXB4YXdxb2FycHJodHhhcGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTgyMzYsImV4cCI6MjEwMzMzNDIzNn0.6MaMS-my38sgzBhVkYJ0-GNT7SMIhy3C61gKNmFKq1o",
} as const;

export default defineConfig(({ command }) => {
  const isBuild = command === "build";

  return {
    nitro: { preset: "vercel" },
    vite: {
      define: isBuild
        ? Object.fromEntries(
            Object.entries(PRODUCTION_SUPABASE_CLIENT).map(([key, value]) => [
              `import.meta.env.${key}`,
              JSON.stringify(value),
            ]),
          )
        : {},
    },
  };
});
