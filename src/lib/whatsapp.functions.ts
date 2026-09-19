import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/whatsapp";

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

/** هل تم ربط حساب واتساب بيزنس بالمشروع؟ */
export const getWhatsAppStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { whatsappCredentials } = await import("@/lib/integrations.server");
  const { apiKey, lovableKey } = await whatsappCredentials();
  return { connected: Boolean(apiKey && lovableKey) };
});

/** سجل محادثة عميل واحد */
export const listWhatsAppMessages = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ customerId: z.string().min(1), phone: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.phone ? normalizePhone(data.phone) : null;
    const filter = phone
      ? `customer_id.eq.${data.customerId},phone.eq.${phone}`
      : `customer_id.eq.${data.customerId}`;
    const { data: rows, error } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("*")
      .or(filter)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return { messages: (rows ?? []) as WhatsAppMessageRow[] };
  });

/** آخر الرسائل عبر كل العملاء (لصفحة واتساب) */
export const listRecentWhatsAppMessages = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return { messages: (rows ?? []) as WhatsAppMessageRow[] };
});

const sendSchema = z.object({
  customerId: z.string().optional(),
  phone: z.string().min(6),
  body: z.string().min(1).max(4000),
  sentBy: z.string().optional(),
});

/** إرسال رسالة نصية عبر واتساب بيزنس وحفظها في السجل */
export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => sendSchema.parse(data))
  .handler(async ({ data }) => {
    const { whatsappCredentials } = await import("@/lib/integrations.server");
    const { apiKey: waKey, lovableKey } = await whatsappCredentials();
    if (!lovableKey || !waKey) {
      return {
        ok: false as const,
        error: "حساب واتساب بيزنس غير مربوط بعد. اربط الحساب من الإعدادات ثم أعد المحاولة.",
      };
    }

    const to = normalizePhone(data.phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let response: Response;
    let responseBody = "";
    try {
      response = await fetch(`${GATEWAY_URL}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": waKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: data.body },
        }),
      });
      responseBody = await response.text();
    } catch (err) {
      const message = err instanceof Error ? err.message : "تعذر الاتصال بواتساب";
      await supabaseAdmin.from("whatsapp_messages").insert({
        customer_id: data.customerId ?? null,
        phone: to,
        direction: "out",
        body: data.body,
        status: "failed",
        error: message,
        sent_by: data.sentBy ?? null,
        status_at: new Date().toISOString(),
      });
      return { ok: false as const, error: message };
    }

    if (!response.ok) {
      console.error(`WhatsApp send failed [${response.status}]: ${responseBody}`);
      await supabaseAdmin.from("whatsapp_messages").insert({
        customer_id: data.customerId ?? null,
        phone: to,
        direction: "out",
        body: data.body,
        status: "failed",
        error: `${response.status}: ${responseBody}`.slice(0, 1000),
        sent_by: data.sentBy ?? null,
        status_at: new Date().toISOString(),
      });
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

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        customer_id: data.customerId ?? null,
        phone: to,
        direction: "out",
        body: data.body,
        wa_message_id: waMessageId,
        status: "accepted",
        sent_by: data.sentBy ?? null,
      })
      .select("*")
      .single();
    if (insertError) throw new Error(insertError.message);

    const { touchThread } = await import("@/lib/whatsapp.server");
    await touchThread(supabaseAdmin, {
      phone: to,
      body: data.body,
      direction: "out",
      customerId: data.customerId ?? null,
    });

    // مطابقة أي إشعارات حالة وصلت قبل حفظ الرسالة
    if (waMessageId) {
      const { data: pending } = await supabaseAdmin
        .from("whatsapp_pending_statuses")
        .select("*")
        .eq("wa_message_id", waMessageId);
      if (pending && pending.length > 0) {
        const best = pending.sort(
          (a, b) => statusRank(b.status) - statusRank(a.status),
        )[0]!;
        await supabaseAdmin
          .from("whatsapp_messages")
          .update({ status: best.status, error: best.error, status_at: best.status_at })
          .eq("wa_message_id", waMessageId);
        await supabaseAdmin
          .from("whatsapp_pending_statuses")
          .delete()
          .eq("wa_message_id", waMessageId);
      }
    }

    return { ok: true as const, message: inserted as WhatsAppMessageRow };
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
