import { query, queryOne } from "@/lib/db.server";

/** يحدّث (أو ينشئ) سجل المحادثة لرقم واتساب */
export async function touchThread(opts: {
  phone: string;
  body: string | null;
  direction: "in" | "out";
  at?: string;
  customerId?: string | null;
  contactName?: string | null;
}) {
  const at = opts.at ?? new Date().toISOString();
  const existing = await queryOne<{
    customer_id: string | null;
    unread: number;
    contact_name: string | null;
  }>(`select customer_id, unread, contact_name from whatsapp_threads where phone = $1`, [
    opts.phone,
  ]);

  const unread =
    opts.direction === "in" ? (existing?.unread ?? 0) + 1 : (existing?.unread ?? 0);

  await query(
    `insert into whatsapp_threads
       (phone, customer_id, contact_name, last_message, last_message_at, last_direction, unread, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())
     on conflict (phone) do update set
       customer_id = excluded.customer_id,
       contact_name = excluded.contact_name,
       last_message = excluded.last_message,
       last_message_at = excluded.last_message_at,
       last_direction = excluded.last_direction,
       unread = excluded.unread,
       updated_at = now()`,
    [
      opts.phone,
      opts.customerId ?? existing?.customer_id ?? null,
      opts.contactName ?? existing?.contact_name ?? null,
      (opts.body ?? "").slice(0, 300),
      at,
      opts.direction,
      opts.direction === "out" ? 0 : unread,
    ],
  );
}

export type Intent = "interested" | "inquiry" | "unknown";

/** تصنيف ذكي للمحادثة عبر OpenAI مباشرة (بدل بوابة Lovable AI) */
export async function classifyThread(
  phone: string,
): Promise<{ intent: Intent; reason: string; confidence: number } | null> {
  const { openaiCredentials } = await import("@/lib/integrations.server");
  const key = (await openaiCredentials()).apiKey;
  if (!key) return null;

  const { rows } = await query<{ direction: "in" | "out"; body: string | null }>(
    `select direction, body from whatsapp_messages where phone = $1
     order by created_at desc limit 25`,
    [phone],
  );

  const messages = rows.slice().reverse();
  if (messages.length === 0) return null;

  const transcript = messages
    .map((m) => `${m.direction === "in" ? "العميل" : "الشركة"}: ${m.body ?? ""}`)
    .join("\n")
    .slice(0, 6000);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
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

  await query(
    `update whatsapp_threads
     set ai_intent = $1, ai_reason = $2, ai_confidence = $3, ai_updated_at = now()
     where phone = $4`,
    [result.intent, result.reason, result.confidence, phone],
  );

  return result;
}
