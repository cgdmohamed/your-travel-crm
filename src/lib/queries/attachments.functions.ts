import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { query, queryOne } from "@/lib/db.server";
import { toDateStr } from "@/lib/queries/_shared.server";
import type { Attachment } from "@/lib/crm-data";

type AttachmentRow = {
  id: string;
  customer_id: string;
  kind: Attachment["kind"];
  ref_id: string | null;
  name: string;
  mime: string;
  size: number;
  storage_path: string;
  uploaded_at: string | Date;
  uploaded_by_name: string | null;
};

function toAttachment(r: AttachmentRow): Attachment {
  return {
    id: r.id,
    customerId: r.customer_id,
    kind: r.kind,
    refId: r.ref_id ?? undefined,
    name: r.name,
    mime: r.mime,
    size: r.size,
    url: `/api/attachments/${r.id}/file`,
    uploadedAt: toDateStr(r.uploaded_at),
    uploadedBy: r.uploaded_by_name ?? "—",
  };
}

const COLS = `a.id, a.customer_id, a.kind, a.ref_id, a.name, a.mime, a.size, a.storage_path,
              a.uploaded_at, u.name as uploaded_by_name`;

export const listAttachments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<Attachment[]> => {
    const { rows } = await query<AttachmentRow>(
      `select ${COLS} from attachments a left join users u on u.id = a.uploaded_by
       order by a.uploaded_at desc`,
    );
    return rows.map(toAttachment);
  });

const attachmentInput = z.object({
  customerId: z.string().uuid(),
  kind: z.enum(["ticket", "hotel", "payment", "other"]),
  refId: z.string().uuid().optional(),
  name: z.string().min(1),
  mime: z.string().min(1),
  size: z.number().int().min(0),
  dataUrl: z.string().min(1),
});

export const createAttachment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => attachmentInput.parse(data))
  .handler(async ({ data, context }): Promise<Attachment> => {
    const { writeUpload, ATTACHMENT_UPLOAD_OPTS } = await import("@/lib/upload.server");
    const { relativePath, mime, size } = await writeUpload(
      "attachments",
      data.dataUrl,
      data.name,
      ATTACHMENT_UPLOAD_OPTS,
    );
    const row = await queryOne<AttachmentRow>(
      `with ins as (
         insert into attachments (customer_id, kind, ref_id, name, mime, size, storage_path, uploaded_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning id, customer_id, kind, ref_id, name, mime, size, storage_path, uploaded_at, uploaded_by
       )
       select ins.id, ins.customer_id, ins.kind, ins.ref_id, ins.name, ins.mime, ins.size,
              ins.storage_path, ins.uploaded_at, u.name as uploaded_by_name
       from ins left join users u on u.id = ins.uploaded_by`,
      [data.customerId, data.kind, data.refId ?? null, data.name, mime, size, relativePath, context.userId],
    );
    return toAttachment(row!);
  });

export const removeAttachment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const row = await queryOne<{ storage_path: string }>(
      `delete from attachments where id = $1 returning storage_path`,
      [data.id],
    );
    if (row) {
      const { deleteUpload } = await import("@/lib/upload.server");
      await deleteUpload(row.storage_path);
    }
    return { ok: true };
  });
