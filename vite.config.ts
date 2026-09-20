import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

// Plain Vite config — no @lovable.dev/vite-tanstack-config dependency.
// This version of @tanstack/react-start does not go through Nitro at all: it
// emits `dist/server/server.js`, a plain Web-standard `{ fetch }` handler
// (runtime-agnostic — Node/Bun/Deno/Cloudflare all accept this shape), plus
// `dist/client/` static assets. `server-entry.mjs` at the repo root serves
// that handler with Bun's native HTTP server for the Docker image (Phase 9).
// Previously the removed Lovable package silently defaulted this build to a
// Cloudflare-flavored Nitro preset; there is no Nitro preset to set anymore.
export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
  ],
});
