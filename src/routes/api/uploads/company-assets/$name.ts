// Public static-file serving for the company logo (Phase 7). Not sensitive —
// no auth check (must be readable from the login page before any session
// exists), same pattern as package-images — see that route for details.
import { createFileRoute } from "@tanstack/react-router";
import { readUpload } from "@/lib/upload.server";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export const Route = createFileRoute("/api/uploads/company-assets/$name")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const name = params.name;
        if (!name || name.includes("/") || name.includes("..")) {
          return new Response("Not found", { status: 404 });
        }
        const file = await readUpload(`company-assets/${name}`);
        if (!file) return new Response("Not found", { status: 404 });
        const ext = name.slice(name.lastIndexOf("."));
        const bytes = new Uint8Array(file.buffer);
        return new Response(new Blob([bytes]), {
          headers: {
            "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
