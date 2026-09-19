import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizePhone } from "@/lib/whatsapp.functions";

const GRAPH_VERSION = "v21.0";

export type MetaEventRow = {
  id: string;
  event_name: string;
  event_id: string;
  customer_id: string | null;
  customer_name: string | null;
  value: number | null;
  currency: string;
  status: string;
  error: string | null;
  events_received: number | null;
  sent_by: string | null;
  test_event: boolean;
  created_at: string;
};

/** تجزئة SHA-256 كما تشترط Meta لبيانات العميل */
async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** هل تم ضبط بيانات Meta؟ */
export const getMetaCapiStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { metaCredentials } = await import("@/lib/integrations.server");
  const { pixelId, token, testCode } = await metaCredentials();
  return { connected: Boolean(pixelId && token), hasTestCode: Boolean(testCode) };
});

const eventInput = z.object({
  eventName: z.enum(["Lead", "Purchase", "Contact", "InitiateCheckout", "Schedule"]),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  city: z.string().optional(),
  value: z.number().optional(),
  currency: z.string().default("EGP"),
  sentBy: z.string().optional(),
  test: z.boolean().optional(),
});

/** إرسال حدث تحويل إلى Meta Conversions API مع حفظه في السجل */
export const sendMetaEvent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => eventInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { metaCredentials } = await import("@/lib/integrations.server");
    const { pixelId, token, testCode } = await metaCredentials();
    const eventId = `${data.eventName}-${crypto.randomUUID()}`;

    const log = async (status: string, error?: string, received?: number) => {
      await supabaseAdmin.from("meta_capi_events").insert({
        event_name: data.eventName,
        event_id: eventId,
        customer_id: data.customerId ?? null,
        customer_name: data.customerName ?? null,
        value: data.value ?? null,
        currency: data.currency,
        status,
        error: error ?? null,
        events_received: received ?? null,
        sent_by: data.sentBy ?? null,
        test_event: Boolean(data.test),
      });
    };

    if (!pixelId || !token) {
      await log("not_configured", "لم يتم ضبط معرّف البكسل أو رمز الوصول");
      return { ok: false as const, reason: "not_configured" as const, eventId };
    }

    const userData: Record<string, string[]> = {};
    if (data.phone) userData["ph"] = [await sha256(normalizePhone(data.phone))];
    if (data.email) userData["em"] = [await sha256(data.email.trim().toLowerCase())];
    if (data.customerName) {
      const parts = data.customerName.trim().split(/\s+/);
      userData["fn"] = [await sha256(parts[0]!.toLowerCase())];
      if (parts.length > 1) userData["ln"] = [await sha256(parts[parts.length - 1]!.toLowerCase())];
    }
    if (data.city) userData["ct"] = [await sha256(data.city.replace(/\s+/g, "").toLowerCase())];
    userData["country"] = [await sha256("eg")];

    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: data.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: "system_generated",
          user_data: userData,
          custom_data:
            data.value != null ? { value: data.value, currency: data.currency } : undefined,
        },
      ],
    };
    if (testCode) payload["test_event_code"] = testCode;

    try {
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        events_received?: number;
        error?: { message?: string };
      };
      if (!res.ok) {
        const msg = body.error?.message ?? `HTTP ${res.status}`;
        await log("failed", msg);
        return { ok: false as const, reason: "api_error" as const, error: msg, eventId };
      }
      await log("sent", undefined, body.events_received ?? 1);
      return { ok: true as const, eventId, received: body.events_received ?? 1 };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذّر الاتصال بـ Meta";
      await log("failed", msg);
      return { ok: false as const, reason: "network" as const, error: msg, eventId };
    }
  });

/** آخر أحداث أُرسلت إلى Meta */
export const listMetaEvents = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("meta_capi_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as MetaEventRow[];
});
