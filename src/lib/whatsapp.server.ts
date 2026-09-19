import type { supabaseAdmin as AdminClient } from "@/integrations/supabase/client.server";

type Admin = typeof AdminClient;

/** يحدّث (أو ينشئ) سجل المحادثة لرقم واتساب */
export async function touchThread(
  admin: Admin,
  opts: {
    phone: string;
    body: string | null;
    direction: "in" | "out";
    at?: string;
    customerId?: string | null;
    contactName?: string | null;
  },
) {
  const at = opts.at ?? new Date().toISOString();
  const { data: existing } = await admin
    .from("whatsapp_threads")
    .select("phone, customer_id, unread, contact_name")
    .eq("phone", opts.phone)
    .maybeSingle();

  const unread =
    opts.direction === "in" ? (existing?.unread ?? 0) + 1 : (existing?.unread ?? 0);

  await admin.from("whatsapp_threads").upsert(
    {
      phone: opts.phone,
      customer_id: opts.customerId ?? existing?.customer_id ?? null,
      contact_name: opts.contactName ?? existing?.contact_name ?? null,
      last_message: (opts.body ?? "").slice(0, 300),
      last_message_at: at,
      last_direction: opts.direction,
      unread: opts.direction === "out" ? 0 : unread,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "phone" },
  );
}

export type Intent = "interested" | "inquiry" | "unknown";

/** تصنيف ذكي للمحادثة: عميل مهتم أم استفسار فقط */
export async function classifyThread(
  admin: Admin,
  phone: string,
): Promise<{ intent: Intent; reason: string; confidence: number } | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;

  const { data: rows } = await admin
    .from("whatsapp_messages")
    .select("direction, body, created_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(25);

  const messages = (rows ?? []).reverse();
  if (messages.length === 0) return null;

  const transcript = messages
    .map((m) => `${m.direction === "in" ? "العميل" : "الشركة"}: ${m.body ?? ""}`)
    .join("\n")
    .slice(0, 6000);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.8-flash",
      messages: [
        {
          role: "system",
          content:
            "أنت مساعد لشركة سياحة مصرية. صنّف محادثة واتساب مع عميل إلى: " +
            "interested (عميل مهتم فعلاً: يطلب حجزاً أو سعراً لرحلة محددة أو تواريخ أو يبدي نية شراء) " +
            "أو inquiry (استفسار عام فقط بدون نية حجز واضحة) " +
            "أو unknown (لا توجد معلومات كافية). أجب بـ JSON فقط.",
        },
        {
          role: "user",
          content: `المحادثة:\n${transcript}\n\nأعد JSON بالشكل: {"intent":"interested|inquiry|unknown","reason":"سبب قصير بالعربية","confidence":0.0}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`AI classify failed [${response.status}]: ${body}`);
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  let parsed: { intent?: string; reason?: string; confidence?: number };
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const intent: Intent =
    parsed.intent === "interested" || parsed.intent === "inquiry" ? parsed.intent : "unknown";
  const result = {
    intent,
    reason: (parsed.reason ?? "").slice(0, 300),
    confidence: Number(parsed.confidence ?? 0) || 0,
  };

  await admin
    .from("whatsapp_threads")
    .update({
      ai_intent: result.intent,
      ai_reason: result.reason,
      ai_confidence: result.confidence,
      ai_updated_at: new Date().toISOString(),
    })
    .eq("phone", phone);

  return result;
}
