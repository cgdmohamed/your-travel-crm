// Private attachment file serving (Phase 2). Unlike package images, these
// are customer documents (tickets, hotel confirmations, payment receipts)
// and must never be exposed as a plain static directory — this route checks
// the requesting user's session and, for an "agent" role, that they own the
// customer the attachment belongs to (same owner-scoping rule as the rest
// of the CRM data layer) before returning any bytes.
import { createFileRoute } from "@tanstack/react-router";
import { currentUserFromAccessToken } from "@/lib/auth-server";
import { ACCESS_COOKIE, readCookie } from "@/lib/cookies.server";
import { queryOne } from "@/lib/db.server";
import { readUpload } from "@/lib/upload.functions";
import { isOwnerScoped } from "@/lib/queries/_shared.server";
import type { Role } from "@/lib/permissions";

export const Route = createFileRoute("/api/attachments/$id/file")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const accessToken = readCookie(request, ACCESS_COOKIE);
        const user = await currentUserFromAccessToken(accessToken);
        if (!user) return new Response("Unauthorized", { status: 401 });

        const row = await queryOne<{
          name: string;
          mime: string;
          storage_path: string;
          owner_id: string | null;
        }>(
          `select a.name, a.mime, a.storage_path, c.owner_id
           from attachments a join customers c on c.id = a.customer_id
           where a.id = $1`,
          [params.id],
        );
        if (!row) return new Response("Not found", { status: 404 });

        const scoped = await isOwnerScoped(user.id, user.role as Role);
        if (scoped && row.owner_id !== user.id) {
          return new Response("Forbidden", { status: 403 });
        }

        const file = await readUpload(row.storage_path);
        if (!file) return new Response("Not found", { status: 404 });

        const bytes = new Uint8Array(file.buffer);
        return new Response(new Blob([bytes]), {
          headers: {
            "Content-Type": row.mime || "application/octet-stream",
            "Content-Disposition": `inline; filename="${encodeURIComponent(row.name)}"`,
            "Cache-Control": "private, max-age=0, no-cache",
          },
        });
      },
    },
  },
});
