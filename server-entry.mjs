// Production entry point for the built app (dist/server/server.js).
// TanStack Start's build output here is a plain Web-standard `{ fetch }`
// handler (not a self-listening Node server), so this thin wrapper serves it
// with Bun's native HTTP server — matching this project's existing Bun usage
// (bun.lock) and avoiding an extra Node-only HTTP adapter dependency.
import handler from "./dist/server/server.js";

const port = Number(process.env.PORT || 3000);

Bun.serve({
  port,
  hostname: "0.0.0.0",
  fetch: (request) => handler.fetch(request, {}, {}),
});

console.log(`Your Travel CRM listening on :${port}`);
