/**
 * Fan-out notification writes (server-only). One row per recipient, written
 * at creation time (not a broadcast join computed at read time).
 *
 * Server-only module — import it dynamically (`await import(...)`) inside a
 * createServerFn/route handler, never as a static top-level import from
 * client-bundled code. Same pattern as `whatsapp.server.ts`/`upload.server.ts`
 * (see `src/routes/api/public/whatsapp/webhook.ts` for a live example).
 */
import { query } from "@/lib/db.server";
import type { Role } from "@/lib/permissions";

export type NotificationInput = {
  type: string;
  title: string;
  body: string;
  link?: string;
};

/** Inserts a single notification row for one recipient. */
export async function notifyUser(userId: string, input: NotificationInput): Promise<void> {
  await query(
    `insert into notifications (user_id, type, title, body, link) values ($1, $2, $3, $4, $5)`,
    [userId, input.type, input.title, input.body, input.link ?? null],
  );
}

/**
 * Inserts one notification row for every active user with the given role,
 * optionally skipping the acting user so they don't get notified about
 * their own action.
 */
export async function notifyRole(
  role: Role,
  input: NotificationInput,
  excludeUserId?: string,
): Promise<void> {
  const params: unknown[] = [role];
  let sql = `select id from users where role = $1 and active = true`;
  if (excludeUserId) {
    params.push(excludeUserId);
    sql += ` and id <> $2`;
  }
  const { rows } = await query<{ id: string }>(sql, params);
  if (rows.length === 0) return;

  const valueClauses: string[] = [];
  const insertParams: unknown[] = [];
  let i = 1;
  for (const r of rows) {
    valueClauses.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
    insertParams.push(r.id, input.type, input.title, input.body, input.link ?? null);
  }
  await query(
    `insert into notifications (user_id, type, title, body, link) values ${valueClauses.join(", ")}`,
    insertParams,
  );
}
