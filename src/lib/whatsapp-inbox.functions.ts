import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizePhone, type WhatsAppMessageRow } from "@/lib/whatsapp.functions";

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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("whatsapp_threads")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return { threads: (data ?? []) as ThreadRow[] };
});

/** رسائل محادثة واحدة */
export const listThreadMessages = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ phone: z.string().min(5) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = normalizePhone(data.phone);
    const { data: rows, error } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("*")
      .eq("phone", phone)
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("whatsapp_threads").update({ unread: 0 }).eq("phone", phone);
    return { messages: (rows ?? []) as WhatsAppMessageRow[] };
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = normalizePhone(data.phone);
    await supabaseAdmin.from("whatsapp_threads").upsert(
      {
        phone,
        customer_id: data.customerId,
        contact_name: data.contactName ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone" },
    );
    await supabaseAdmin
      .from("whatsapp_messages")
      .update({ customer_id: data.customerId })
      .eq("phone", phone);
    return { ok: true as const };
  });

/** تصنيف ذكي لمحادثة واحدة أو لكل المحادثات غير المصنّفة */
export const classifyThreads = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ phone: z.string().optional(), all: z.boolean().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { classifyThread } = await import("@/lib/whatsapp.server");

    if (!process.env["LOVABLE_API_KEY"]) {
      return { ok: false as const, error: "التصنيف الذكي غير متاح حالياً.", classified: 0 };
    }

    let phones: string[] = [];
    if (data.phone) {
      phones = [normalizePhone(data.phone)];
    } else {
      const { data: rows } = await supabaseAdmin
        .from("whatsapp_threads")
        .select("phone, ai_updated_at, last_message_at")
        .order("last_message_at", { ascending: false })
        .limit(40);
      phones = (rows ?? [])
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
        const res = await classifyThread(supabaseAdmin, phone);
        if (res) classified += 1;
      } catch (err) {
        console.error("classify failed", phone, err);
      }
    }
    return { ok: true as const, classified };
  });

/** رسائل تجريبية لتجربة الشاشة قبل ربط الحساب */
export const seedDemoInbox = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
      texts: [
        ["in", "عايزة أحجز شرم الشيخ 4 أفراد في إجازة نص السنة، متاح فندق 5 نجوم؟"],
      ],
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
      await supabaseAdmin.from("whatsapp_messages").insert({
        phone: thread.phone,
        direction,
        body,
        status: direction === "in" ? "received" : "delivered",
        status_at: at,
        created_at: at,
      });
      await touchThread(supabaseAdmin, {
        phone: thread.phone,
        body,
        direction,
        at,
        contactName: thread.name,
      });
      i += 1;
    }
  }
  return { ok: true as const };
});
