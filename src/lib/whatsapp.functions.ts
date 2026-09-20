import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { query, queryOne } from "@/lib/db.server";

/** يحوّل الرقم المصري المحلي (01xxxxxxxxx) إلى صيغة دولية بالأرقام فقط */
export function normalizePhone(raw: string): string {
  let digits = (raw || "").replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = "20" + digits.slice(1);
  return digits;
}

export type WhatsAppMessageRow = {
  id: string;
  customer_id: string | null;
  phone: string;
  direction: "out" | "in";
  body: string | null;
  wa_message_id: string | null;
  status: string;
  error: string | null;
  template_name: string | null;
  sent_by: string | null;
  status_at: string | null;
  created_at: string;
};

/** هل تم ربط حساب واتساب بيزنس بالمشروع؟ (Meta Cloud API الرسمية مباشرة) */
export const getWhatsAppStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { whatsappCredentials } = await import("@/lib/integrations.server");
  const { phoneNumberId, accessToken } = await whatsappCredentials();
  return { connected: Boolean(phoneNumberId && accessToken) };
});

/** سجل محادثة عميل واحد */
export const listWhatsAppMessages = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ customerId: z.string().min(1), phone: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const phone = data.phone ? normalizePhone(data.phone) : null;
    const { rows } = await query<WhatsAppMessageRow>(
      phone
        ? `select * from whatsapp_messages where customer_id = $1 or phone = $2
           order by created_at asc limit 200`
        : `select * from whatsapp_messages where customer_id = $1
           order by created_at asc limit 200`,
      phone ? [data.customerId, phone] : [data.customerId],
    );
    return { messages: rows };
  });

/** آخر الرسائل عبر كل العملاء (لصفحة واتساب) */
export const listRecentWhatsAppMessages = createServerFn({ method: "GET" }).handler(async () => {
  const { rows } = await query<WhatsAppMessageRow>(
    `select * from whatsapp_messages order by created_at desc limit 100`,
  );
  return { messages: rows };
});

const sendSchema = z.object({
  customerId: z.string().optional(),
  phone: z.string().min(6),
  body: z.string().min(1).max(4000),
  sentBy: z.string().optional(),
});

/** إرسال رسالة نصية عبر WhatsApp Cloud API الرسمية من Meta (اتصال مباشر) وحفظها في السجل */
export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => sendSchema.parse(data))
  .handler(async ({ data }) => {
    const { whatsappCredentials } = await import("@/lib/integrations.server");
    const { phoneNumberId, accessToken } = await whatsappCredentials();
    if (!phoneNumberId || !accessToken) {
      return {
        ok: false as const,
        error: "حساب واتساب بيزنس غير مربوط بعد. اربط الحساب من الإعدادات ثم أعد المحاولة.",
      };
    }

    const to = normalizePhone(data.phone);

    let response: Response;
    let responseBody = "";
    try {
      response = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: data.body },
          }),
        },
      );
      responseBody = await response.text();
    } catch (err) {
      const message = err instanceof Error ? err.message : "تعذر الاتصال بواتساب";
      await query(
        `insert into whatsapp_messages (customer_id, phone, direction, body, status, error, sent_by, status_at)
         values ($1, $2, 'out', $3, 'failed', $4, $5, now())`,
        [data.customerId ?? null, to, data.body, message, data.sentBy ?? null],
      );
      return { ok: false as const, error: message };
    }

    if (!response.ok) {
      console.error(`WhatsApp send failed [${response.status}]: ${responseBody}`);
      await query(
        `insert into whatsapp_messages (customer_id, phone, direction, body, status, error, sent_by, status_at)
         values ($1, $2, 'out', $3, 'failed', $4, $5, now())`,
        [
          data.customerId ?? null,
          to,
          data.body,
          `${response.status}: ${responseBody}`.slice(0, 1000),
          data.sentBy ?? null,
        ],
      );
      return {
        ok: false as const,
        error: `تعذر إرسال الرسالة (${response.status}): ${responseBody}`.slice(0, 500),
      };
    }

    let waMessageId: string | null = null;
    try {
      const parsed = JSON.parse(responseBody) as { messages?: Array<{ id?: string }> };
      waMessageId = parsed.messages?.[0]?.id ?? null;
    } catch {
      waMessageId = null;
    }

    const inserted = await queryOne<WhatsAppMessageRow>(
      `insert into whatsapp_messages (customer_id, phone, direction, body, wa_message_id, status, sent_by)
       values ($1, $2, 'out', $3, $4, 'accepted', $5)
       returning *`,
      [data.customerId ?? null, to, data.body, waMessageId, data.sentBy ?? null],
    );
    if (!inserted) throw new Error("تعذر حفظ الرسالة");

    const { touchThread } = await import("@/lib/whatsapp.server");
    await touchThread({
      phone: to,
      body: data.body,
      direction: "out",
      customerId: data.customerId ?? null,
    });

    // مطابقة أي إشعارات حالة وصلت قبل حفظ الرسالة
    if (waMessageId) {
      const { rows: pending } = await query<{
        wa_message_id: string;
        status: string;
        error: string | null;
        status_at: string;
      }>(`select * from whatsapp_pending_statuses where wa_message_id = $1`, [waMessageId]);
      if (pending.length > 0) {
        const best = pending.sort((a, b) => statusRank(b.status) - statusRank(a.status))[0]!;
        await query(
          `update whatsapp_messages set status = $1, error = $2, status_at = $3
           where wa_message_id = $4`,
          [best.status, best.error, best.status_at, waMessageId],
        );
        await query(`delete from whatsapp_pending_statuses where wa_message_id = $1`, [
          waMessageId,
        ]);
      }
    }

    return { ok: true as const, message: inserted };
  });

export function statusRank(status: string): number {
  switch (status) {
    case "failed":
      return 5;
    case "read":
      return 4;
    case "delivered":
      return 3;
    case "sent":
      return 2;
    case "accepted":
      return 1;
    default:
      return 0;
  }
}
