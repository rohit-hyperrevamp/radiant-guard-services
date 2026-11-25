import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

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

export default defineConfig(({ command, mode }) => {
  const isDevBuild = command === "build" && mode === "development";

  return {
    define,
    ...(isDevBuild
      ? {
          environments: {
            client: { define: { "process.env.NODE_ENV": JSON.stringify("development") } },
          },
          esbuild: { keepNames: true },
        }
      : {}),
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
      ignoreOutdatedRequests: true,
    },
    server: {
      host: "::",
      port: 8080,
      watch: { awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 } },
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      // Server bundle for Vercel (build only, as before).
      ...(command === "build" ? [nitro({ preset: "vercel" })] : []),
      viteReact(),
    ],
  };
});
