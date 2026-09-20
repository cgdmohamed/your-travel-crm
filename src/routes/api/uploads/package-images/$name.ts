// Public static-file serving for package images (Phase 2). Not sensitive —
// no auth check, unlike src/routes/api/attachments/$id/file.ts. Long cache
// headers are safe because filenames are content-addressed uuids that never
// get reused for different bytes (see src/lib/upload.functions.ts).
import { createFileRoute } from "@tanstack/react-router";
import { readUpload } from "@/lib/upload.functions";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export const Route = createFileRoute("/api/uploads/package-images/$name")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const name = params.name;
        if (!name || name.includes("/") || name.includes("..")) {
          return new Response("Not found", { status: 404 });
        }
        const file = await readUpload(`package-images/${name}`);
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
