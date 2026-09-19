import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookRequest } from "@lovable.dev/webhooks-js";
import { statusRank } from "@/lib/whatsapp.functions";

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

async function processEvent(
  supabaseAdmin: Awaited<
    typeof import("@/integrations/supabase/client.server")
  >["supabaseAdmin"],
  event: string,
  payload: any,
) {
  const value: MetaValue = payload?.entry?.[0]?.changes?.[0]?.value ?? {};

  // رسائل واردة من العملاء
  for (const msg of value.messages ?? []) {
    if (!msg.id) continue;
    const phone = (msg.from ?? "").replace(/[^\d]/g, "");
    const { data: existingCustomer } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("customer_id")
      .eq("phone", phone)
      .not("customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabaseAdmin
      .from("whatsapp_messages")
      .upsert(
        {
          customer_id: existingCustomer?.customer_id ?? null,
          phone,
          direction: "in",
          body: msg.text?.body ?? `[${msg.type ?? "media"}]`,
          wa_message_id: msg.id,
          status: "received",
          status_at: metaTimestamp(msg.timestamp),
        },
        { onConflict: "wa_message_id" },
      );

    const { touchThread } = await import("@/lib/whatsapp.server");
    await touchThread(supabaseAdmin, {
      phone,
      body: msg.text?.body ?? `[${msg.type ?? "media"}]`,
      direction: "in",
      at: metaTimestamp(msg.timestamp),
      customerId: existingCustomer?.customer_id ?? null,
    });

    // تصنيف ذكي تلقائي للمحادثة بعد كل رسالة واردة
    try {
      const { classifyThread } = await import("@/lib/whatsapp.server");
      await classifyThread(supabaseAdmin, phone);
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

    const { data: existing } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("id, status")
      .eq("wa_message_id", st.id)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin
        .from("whatsapp_pending_statuses")
        .upsert(
          { wa_message_id: st.id, status: st.status, error: errorText, status_at: statusAt },
          { onConflict: "wa_message_id,status" },
        );
      continue;
    }

    if (statusRank(st.status) >= statusRank(existing.status)) {
      await supabaseAdmin
        .from("whatsapp_messages")
        .update({ status: st.status, error: errorText, status_at: statusAt })
        .eq("id", existing.id);
    }
  }

  if (event === "whatsapp.message_error") {
    console.error("WhatsApp account error notice:", JSON.stringify(payload?.entry?.[0]?.changes?.[0]?.value));
  }
}

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["WHATSAPP_API_KEY"];
        if (!secret) return new Response("WhatsApp not configured", { status: 503 });

        const deliveryId = request.headers.get("X-Lovable-Delivery");
        const event = request.headers.get("X-Lovable-Event");
        if (!deliveryId || !event) return new Response("Missing delivery headers", { status: 400 });

        let payload: unknown;
        try {
          const verified = await verifyWebhookRequest({
            req: request,
            secret,
            maxBodyBytes: 4 * 1024 * 1024,
          });
          payload = verified.payload;
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) تخزين الحدث قبل المعالجة
        const { data: row, error: storeError } = await supabaseAdmin
          .from("whatsapp_webhook_events")
          .upsert(
            { delivery_id: deliveryId, event, payload: payload as any },
            { onConflict: "delivery_id", ignoreDuplicates: false },
          )
          .select("id, processed_at")
          .single();
        if (storeError || !row) {
          console.error("WhatsApp webhook store failed:", storeError?.message);
          return new Response("Storage error", { status: 500 });
        }
        if (row.processed_at) return new Response("ok");

        // 2) المعالجة
        try {
          await processEvent(supabaseAdmin, event, payload);
          await supabaseAdmin
            .from("whatsapp_webhook_events")
            .update({ processed_at: new Date().toISOString(), processing_error: null })
            .eq("id", row.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : "processing failed";
          console.error("WhatsApp webhook processing failed:", message);
          await supabaseAdmin
            .from("whatsapp_webhook_events")
            .update({
              processing_error: message.slice(0, 1000),
              next_attempt_at: new Date(Date.now() + 60000).toISOString(),
            })
            .eq("id", row.id);
          return new Response("Processing error", { status: 500 });
        }

        // 3) إعادة محاولة الأحداث المعلّقة السابقة (عدد محدود)
        try {
          const { data: pendingRows } = await supabaseAdmin
            .from("whatsapp_webhook_events")
            .select("id, event, payload, attempts")
            .is("processed_at", null)
            .lte("next_attempt_at", new Date().toISOString())
            .order("next_attempt_at", { ascending: true })
            .limit(5);
          for (const pending of pendingRows ?? []) {
            try {
              await processEvent(supabaseAdmin, pending.event, pending.payload);
              await supabaseAdmin
                .from("whatsapp_webhook_events")
                .update({ processed_at: new Date().toISOString(), processing_error: null })
                .eq("id", pending.id);
            } catch (err) {
              const attempts = (pending.attempts ?? 0) + 1;
              await supabaseAdmin
                .from("whatsapp_webhook_events")
                .update({
                  attempts,
                  processing_error: (err instanceof Error ? err.message : "retry failed").slice(0, 1000),
                  next_attempt_at: new Date(Date.now() + attempts * 300000).toISOString(),
                })
                .eq("id", pending.id);
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
