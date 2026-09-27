// Production entry point for the built app (dist/server/server.js).
// TanStack Start's build output here is a plain Web-standard `{ fetch }`
// handler (not a self-listening Node server), so this thin wrapper serves it
// with Bun's native HTTP server — matching this project's existing Bun usage
// (bun.lock) and avoiding an extra Node-only HTTP adapter dependency.
//
// Without Nitro, nothing else serves the built static assets
// (dist/client/assets/*.js|css, favicon.ico, robots.txt) — the SSR handler
// only knows about page/API routes and returns its own 404 page for anything
// else. So this entry must serve dist/client itself, falling back to the SSR
// handler for everything that isn't a real file on disk.
import { resolve, join, sep } from "node:path";
import handler from "./dist/server/server.js";

const port = Number(process.env.PORT || 3000);
const clientDir = resolve(new URL("./dist/client", import.meta.url).pathname);

async function serveStatic(pathname) {
  if (pathname === "/") return null; // no index.html in an SSR-only build

  const decoded = decodeURIComponent(pathname);
  const candidate = resolve(join(clientDir, decoded));
  // Path-traversal guard: resolved path must stay inside clientDir.
  if (candidate !== clientDir && !candidate.startsWith(clientDir + sep)) {
    return null;
  }

  const file = Bun.file(candidate);
  if (!(await file.exists())) return null;

  const isHashedAsset = decoded.startsWith("/assets/");
  return new Response(file, {
    headers: {
      "Cache-Control": isHashedAsset
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600",
    },
  });
}

Bun.serve({
  port,
  hostname: "0.0.0.0",
  async fetch(request) {
    if (request.method === "GET" || request.method === "HEAD") {
      const { pathname } = new URL(request.url);
      const staticResponse = await serveStatic(pathname);
      if (staticResponse) return staticResponse;
    }
    return handler.fetch(request, {}, {});
  },
});

console.log(`Your Travel CRM listening on :${port}`);
