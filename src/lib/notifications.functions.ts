import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { query, queryOne } from "@/lib/db.server";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

/** آخر 50 إشعارًا للمستخدم الحالي، الأحدث أولاً، مع العدد غير المقروء الفعلي */
export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<{ items: NotificationRow[]; unreadCount: number }> => {
    const { rows } = await query<{
      id: string;
      type: string;
      title: string;
      body: string;
      link: string | null;
      read_at: string | null;
      created_at: string;
    }>(
      `select id, type, title, body, link, read_at, created_at
       from notifications where user_id = $1
       order by created_at desc limit 50`,
      [context.userId],
    );
    const countRow = await queryOne<{ count: string }>(
      `select count(*)::text as count from notifications where user_id = $1 and read_at is null`,
      [context.userId],
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        link: r.link,
        readAt: r.read_at,
        createdAt: r.created_at,
      })),
      unreadCount: Number(countRow?.count ?? 0),
    };
  });

/** تعليم إشعار واحد كمقروء (لصاحبه فقط) */
export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await query(
      `update notifications set read_at = now()
       where id = $1 and user_id = $2 and read_at is null`,
      [data.id, context.userId],
    );
    return { ok: true as const };
  });

/** تعليم كل إشعارات المستخدم الحالي كمقروءة */
export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await query(
      `update notifications set read_at = now() where user_id = $1 and read_at is null`,
      [context.userId],
    );
    return { ok: true as const };
  });
