import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizePhone, type WhatsAppMessageRow } from "@/lib/whatsapp.functions";
import { query } from "@/lib/db.server";
import { requireAuth } from "@/lib/auth-middleware";

export type ThreadRow = {
  phone: string;
  customer_id: string | null;
  contact_name: string | null;
  ai_intent: "interested" | "inquiry" | "unknown";
  ai_reason: string | null;
  ai_confidence: number | null;
  ai_updated_at: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_direction: string | null;
  unread: number;
  archived: boolean;
};

/** كل محادثات واتساب مرتّبة بالأحدث */
export const listThreads = createServerFn({ method: "GET" }).handler(async () => {
  const { rows } = await query<ThreadRow>(
    `select * from whatsapp_threads order by last_message_at desc nulls last limit 300`,
  );
  return { threads: rows };
});

/** رسائل محادثة واحدة */
export const listThreadMessages = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ phone: z.string().min(5) }).parse(data))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    const { rows } = await query<WhatsAppMessageRow>(
      `select * from whatsapp_messages where phone = $1 order by created_at asc limit 300`,
      [phone],
    );
    await query(`update whatsapp_threads set unread = 0 where phone = $1`, [phone]);
    return { messages: rows };
  });

/** ربط محادثة بعميل في النظام */
export const linkThreadToCustomer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        phone: z.string().min(5),
        customerId: z.string().min(1),
        contactName: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    await query(
      `insert into whatsapp_threads (phone, customer_id, contact_name, updated_at)
       values ($1, $2, $3, now())
       on conflict (phone) do update set
         customer_id = excluded.customer_id,
         contact_name = coalesce(excluded.contact_name, whatsapp_threads.contact_name),
         updated_at = now()`,
      [phone, data.customerId, data.contactName ?? null],
    );
    await query(`update whatsapp_messages set customer_id = $1 where phone = $2`, [
      data.customerId,
      phone,
    ]);
    return { ok: true as const };
  });

/** تصنيف ذكي لمحادثة واحدة أو لكل المحادثات غير المصنّفة (عبر OpenAI مباشرة) */
export const classifyThreads = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ phone: z.string().optional(), all: z.boolean().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { classifyThread } = await import("@/lib/whatsapp.server");
    const { openaiCredentials } = await import("@/lib/integrations.server");

    if (!(await openaiCredentials()).apiKey) {
      return { ok: false as const, error: "التصنيف الذكي غير متاح حالياً.", classified: 0 };
    }

    let phones: string[] = [];
    if (data.phone) {
      phones = [normalizePhone(data.phone)];
    } else {
      const { rows } = await query<{
        phone: string;
        ai_updated_at: string | null;
        last_message_at: string | null;
      }>(
        `select phone, ai_updated_at, last_message_at from whatsapp_threads
         order by last_message_at desc nulls last limit 40`,
      );
      phones = rows
        .filter(
          (r) =>
            data.all ||
            !r.ai_updated_at ||
            (r.last_message_at && r.last_message_at > r.ai_updated_at),
        )
        .map((r) => r.phone);
    }

    let classified = 0;
    for (const phone of phones.slice(0, 20)) {
      try {
        const res = await classifyThread(phone);
        if (res) classified += 1;
      } catch (err) {
        console.error("classify failed", phone, err);
      }
    }
    return { ok: true as const, classified };
  });

/**
 * رسائل تجريبية لتجربة الشاشة قبل ربط الحساب — للمدير فقط وخارج بيئة الإنتاج،
 * حتى لا تُلوّث بيانات عميل حقيقي بمحادثات وهمية.
 */
export const seedDemoInbox = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (process.env["NODE_ENV"] === "production") {
      return { ok: false as const, error: "هذه الميزة غير متاحة في بيئة الإنتاج" };
    }
    if ((context as { role: string }).role !== "admin") {
      return { ok: false as const, error: "هذه العملية متاحة لمدير الشركة فقط" };
    }
    const { touchThread } = await import("@/lib/whatsapp.server");

    const now = Date.now();
    const demo: Array<{ phone: string; name: string; texts: Array<[("in" | "out"), string]> }> = [
      {
        phone: "201001234567",
        name: "هدى مصطفى",
        texts: [
          ["in", "السلام عليكم، عايزة أعرف سعر عمرة رجب لشخصين وتواريخ الرحلات المتاحة"],
          ["out", "وعليكم السلام، أهلاً بحضرتك. برنامج رجب 10 أيام يبدأ من 62,000 ج.م للفرد."],
          ["in", "تمام، ممكن نحجز الأسبوع الجاي؟ محتاجة أعرف المقدم المطلوب"],
        ],
      },
      {
        phone: "201115559988",
        name: "كريم الشاذلي",
        texts: [
          ["in", "مساء الخير، بتنظموا رحلات لتركيا؟"],
          ["out", "مساء النور، أيوه عندنا برامج إسطنبول وطرابزون."],
          ["in", "شكراً، بس أنا بسأل بس دلوقتي مش هسافر قريب"],
        ],
      },
      {
        phone: "201223334455",
        name: "منى عبد الله",
        texts: [["in", "عايزة أحجز شرم الشيخ 4 أفراد في إجازة نص السنة، متاح فندق 5 نجوم؟"]],
      },
      {
        phone: "201556667788",
        name: "أحمد سامي",
        texts: [["in", "عندكم فروع في الإسكندرية؟"]],
      },
    ];

    for (const thread of demo) {
      let i = 0;
      for (const [direction, body] of thread.texts) {
        const at = new Date(now - (thread.texts.length - i) * 3600000).toISOString();
        await query(
          `insert into whatsapp_messages (phone, direction, body, status, status_at, created_at)
           values ($1, $2, $3, $4, $5, $5)`,
          [thread.phone, direction, body, direction === "in" ? "received" : "delivered", at],
        );
        await touchThread({ phone: thread.phone, body, direction, at, contactName: thread.name });
        i += 1;
      }
    }
    return { ok: true as const };
  });
