import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";
import { statusRank } from "@/lib/whatsapp.functions";
import { query, queryOne } from "@/lib/db.server";

type MetaValue = {
  messages?: Array<{
    id?: string;
    from?: string;
    timestamp?: string;
    type?: string;
    text?: { body?: string };
  }>;
  statuses?: Array<{
    id?: string;
    status?: string;
    timestamp?: string;
    recipient_id?: string;
    errors?: Array<{ title?: string; message?: string; code?: number }>;
  }>;
};

function metaTimestamp(ts?: string): string {
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString();
}

async function processEvent(payload: { entry?: Array<{ changes?: Array<{ value?: MetaValue }> }> }) {
  const value: MetaValue = payload?.entry?.[0]?.changes?.[0]?.value ?? {};

  // رسائل واردة من العملاء
  for (const msg of value.messages ?? []) {
    if (!msg.id) continue;
    const phone = (msg.from ?? "").replace(/[^\d]/g, "");
    const body = msg.text?.body ?? `[${msg.type ?? "media"}]`;
    const at = metaTimestamp(msg.timestamp);

    const existingCustomer = await queryOne<{ customer_id: string | null }>(
      `select customer_id from whatsapp_messages
       where phone = $1 and customer_id is not null
       order by created_at desc limit 1`,
      [phone],
    );

    await query(
      `insert into whatsapp_messages (customer_id, phone, direction, body, wa_message_id, status, status_at)
       values ($1, $2, 'in', $3, $4, 'received', $5)
       on conflict (wa_message_id) do nothing`,
      [existingCustomer?.customer_id ?? null, phone, body, msg.id, at],
    );

    const { touchThread, classifyThread } = await import("@/lib/whatsapp.server");
    await touchThread({
      phone,
      body,
      direction: "in",
      at,
      customerId: existingCustomer?.customer_id ?? null,
    });

    // تصنيف ذكي تلقائي للمحادثة بعد كل رسالة واردة (عبر OpenAI مباشرة)
    try {
      await classifyThread(phone);
    } catch (err) {
      console.error("auto classify failed", err);
    }
  }

  // حالات تسليم الرسائل الصادرة
  for (const st of value.statuses ?? []) {
    if (!st.id || !st.status) continue;
    const statusAt = metaTimestamp(st.timestamp);
    const errorText = st.errors?.length
      ? st.errors.map((e) => `${e.code ?? ""} ${e.title ?? ""} ${e.message ?? ""}`.trim()).join(" | ")
      : null;

    const existing = await queryOne<{ id: string; status: string }>(
      `select id, status from whatsapp_messages where wa_message_id = $1`,
      [st.id],
    );

    if (!existing) {
      await query(
        `insert into whatsapp_pending_statuses (wa_message_id, status, error, status_at)
         values ($1, $2, $3, $4)
         on conflict (wa_message_id, status) do update set error = excluded.error, status_at = excluded.status_at`,
        [st.id, st.status, errorText, statusAt],
      );
      continue;
    }

    if (statusRank(st.status) >= statusRank(existing.status)) {
      await query(
        `update whatsapp_messages set status = $1, error = $2, status_at = $3 where id = $4`,
        [st.status, errorText, statusAt, existing.id],
      );
    }
  }
}

/** يتحقق من توقيع Meta الرسمي HMAC-SHA256 على الـpayload الخام باستخدام App Secret */
function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string) {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      // خطوة تحقق Meta عند ربط الـwebhook: hub.mode / hub.verify_token / hub.challenge
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const verifyToken = process.env["WHATSAPP_VERIFY_TOKEN"];
        if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const { whatsappCredentials } = await import("@/lib/integrations.server");
        const { appSecret } = await whatsappCredentials();
        if (!appSecret) return new Response("WhatsApp not configured", { status: 503 });

        const rawBody = await request.text();
        const signature = request.headers.get("x-hub-signature-256");
        if (!verifyMetaSignature(rawBody, signature, appSecret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: { entry?: Array<{ id?: string; changes?: Array<{ value?: MetaValue }> }> };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        // معرّف الحدث الخاص بـMeta لمنع معالجة نفس الإشعار مرتين عند إعادة الإرسال
        const deliveryId =
          request.headers.get("x-fb-request-id") ??
          `${payload.entry?.[0]?.id ?? "unknown"}-${crypto.createHash("sha1").update(rawBody).digest("hex")}`;

        const row = await queryOne<{ id: string; processed_at: string | null }>(
          `insert into whatsapp_webhook_events (delivery_id, event, payload)
           values ($1, 'whatsapp.webhook', $2::jsonb)
           on conflict (delivery_id) do update set payload = excluded.payload
           returning id, processed_at`,
          [deliveryId, JSON.stringify(payload)],
        );
        if (!row) return new Response("Storage error", { status: 500 });
        if (row.processed_at) return new Response("ok");

        try {
          await processEvent(payload);
          await query(
            `update whatsapp_webhook_events set processed_at = now(), processing_error = null where id = $1`,
            [row.id],
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "processing failed";
          console.error("WhatsApp webhook processing failed:", message);
          await query(
            `update whatsapp_webhook_events
             set processing_error = $1, next_attempt_at = now() + interval '60 seconds'
             where id = $2`,
            [message.slice(0, 1000), row.id],
          );
          return new Response("Processing error", { status: 500 });
        }

        // إعادة محاولة الأحداث المعلّقة السابقة (عدد محدود)
        try {
          const { rows: pendingRows } = await query<{
            id: string;
            payload: { entry?: Array<{ changes?: Array<{ value?: MetaValue }> }> };
            attempts: number;
          }>(
            `select id, payload, attempts from whatsapp_webhook_events
             where processed_at is null and next_attempt_at <= now()
             order by next_attempt_at asc limit 5`,
          );
          for (const pending of pendingRows) {
            try {
              await processEvent(pending.payload);
              await query(
                `update whatsapp_webhook_events set processed_at = now(), processing_error = null where id = $1`,
                [pending.id],
              );
            } catch (err) {
              const attempts = (pending.attempts ?? 0) + 1;
              await query(
                `update whatsapp_webhook_events
                 set attempts = $1, processing_error = $2, next_attempt_at = now() + ($3 || ' minutes')::interval
                 where id = $4`,
                [
                  attempts,
                  (err instanceof Error ? err.message : "retry failed").slice(0, 1000),
                  attempts * 5,
                  pending.id,
                ],
              );
            }
          }
        } catch (err) {
          console.error("WhatsApp pending sweep failed:", err);
        }

        return new Response("ok");
      },
    },
  },
});
