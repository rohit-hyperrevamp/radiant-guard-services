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

// The build host injects `process.env.*` defines whose values are fallback
// expressions (e.g. `(globalThis.process.env.X ?? ("..."))`). esbuild rejects
// non-literal define values, so drop them and let the server read env at runtime.
const isLiteral = (v: unknown) => {
  if (typeof v !== "string") return true;
  const t = v.trim();
  if (/^(undefined|null|true|false|-?\d+(\.\d+)?)$/.test(t)) return true;
  if (/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(t)) return true;
  try { JSON.parse(t); return true; } catch { return false; }
};
const sanitize = (d?: Record<string, unknown>) => {
  if (!d) return;
  for (const k of Object.keys(d)) if (!isLiteral(d[k])) delete d[k];
};
const sanitizeDefines = {
  name: "sanitize-env-defines",
  enforce: "post" as const,
  configResolved(config: any) {
    sanitize(config.define);
    for (const env of Object.values(config.environments ?? {}) as any[]) sanitize(env?.define);
  },
  configEnvironment(_name: string, config: any) {
    sanitize(config.define);
  },
};

export default defineConfig({
  nitro: { preset: "vercel" },
  // Disables the wrapper's injected preview values so the single binding wins.
  envDefine: false,
  vite: { define, plugins: [sanitizeDefines] },
});
