import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";

const mask = (v?: string) => (v ? `••••${v.slice(-4)}` : "");

export type IntegrationsStatus = {
  meta: { connected: boolean; pixelId: string; tokenMask: string; testEventCode: string };
  whatsapp: { connected: boolean; phoneNumberId: string; tokenMask: string };
  wordpress: { connected: boolean; siteUrl: string; username: string; passwordMask: string };
  smtp: {
    connected: boolean;
    host: string;
    port: string;
    username: string;
    passwordMask: string;
    fromEmail: string;
    fromName: string;
    secure: boolean;
  };
};

/** حالة كل التكاملات مع إخفاء المفاتيح */
export const getIntegrationsStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<IntegrationsStatus> => {
    const { readConfig, metaCredentials, whatsappCredentials, smtpCredentials } = await import(
      "@/lib/integrations.server"
    );
    const meta = await metaCredentials();
    const wa = await whatsappCredentials();
    const wp = await readConfig<{ siteUrl?: string; username?: string; appPassword?: string }>(
      "wordpress",
    );
    const smtp = await smtpCredentials();
    return {
      meta: {
        connected: Boolean(meta.pixelId && meta.token),
        pixelId: meta.pixelId ?? "",
        tokenMask: mask(meta.token),
        testEventCode: meta.testCode ?? "",
      },
      whatsapp: {
        connected: Boolean(wa.phoneNumberId && wa.accessToken),
        phoneNumberId: wa.phoneNumberId ?? "",
        tokenMask: mask(wa.accessToken),
      },
      wordpress: {
        connected: Boolean(wp.siteUrl && wp.username && wp.appPassword),
        siteUrl: wp.siteUrl ?? "",
        username: wp.username ?? "",
        passwordMask: mask(wp.appPassword),
      },
      smtp: {
        connected: Boolean(smtp.host && smtp.username && smtp.password && smtp.fromEmail),
        host: smtp.host ?? "",
        port: smtp.port ?? "587",
        username: smtp.username ?? "",
        passwordMask: mask(smtp.password),
        fromEmail: smtp.fromEmail ?? "",
        fromName: smtp.fromName ?? "",
        secure: smtp.secure === "true",
      },
    };
  },
);

const saveSchema = z.object({
  key: z.enum(["meta", "whatsapp", "wordpress", "smtp"]),
  values: z.record(z.string(), z.string()),
  updatedBy: z.string().optional(),
});

/** حفظ بيانات ربط تكامل (القيم الفارغة تُهمل، والقيمة "" تحذف المفتاح) */
export const saveIntegration = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { writeConfig } = await import("@/lib/integrations.server");
    await writeConfig(data.key, data.values, data.updatedBy);

    try {
      const { notifyRole } = await import("@/lib/notifications.server");
      await notifyRole(
        "admin",
        {
          type: "integration_change",
          title: "تغيير في التكاملات",
          body: `تم تحديث إعدادات تكامل "${data.key}"`,
          link: "/settings",
        },
        context.userId,
      );
    } catch (err) {
      console.error("notify integration change failed", err);
    }

    return { ok: true as const };
  });

/** حذف بيانات ربط تكامل */
export const disconnectIntegration = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) =>
    z.object({ key: z.enum(["meta", "whatsapp", "wordpress", "smtp"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { query } = await import("@/lib/db.server");
    await query(`delete from integration_config where key = $1`, [data.key]);

    try {
      const { notifyRole } = await import("@/lib/notifications.server");
      await notifyRole(
        "admin",
        {
          type: "integration_change",
          title: "فصل تكامل",
          body: `تم فصل تكامل "${data.key}"`,
          link: "/settings",
        },
        context.userId,
      );
    } catch (err) {
      console.error("notify integration change failed", err);
    }

    return { ok: true as const };
  });

/** إرسال إيميل تجريبي حقيقي عبر SMTP المحفوظ */
export const sendTestEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ to: z.string().email() }).parse(data))
  .handler(async ({ data }) => {
    const { sendEmail } = await import("@/lib/smtp.server");
    return sendEmail({
      to: data.to,
      subject: "بريد تجريبي — نظام إدارة العملاء",
      html: "<p>هذه رسالة تجريبية للتأكد من عمل إعدادات البريد الصادر (SMTP) بنجاح.</p>",
    });
  });

/** اختبار الاتصال الفعلي بكل تكامل */
export const testIntegration = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ key: z.enum(["meta", "whatsapp", "wordpress", "smtp"]) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; message: string }> => {
    const { metaCredentials, whatsappCredentials, readConfig } = await import(
      "@/lib/integrations.server"
    );

    if (data.key === "smtp") {
      const { testSmtpConnection } = await import("@/lib/smtp.server");
      return testSmtpConnection();
    }

    if (data.key === "meta") {
      const { pixelId, token } = await metaCredentials();
      if (!pixelId || !token) return { ok: false, message: "أدخل معرّف البكسل ورمز الوصول أولاً" };
      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${pixelId}?access_token=${encodeURIComponent(token)}`,
        );
        const body = (await res.json().catch(() => ({}))) as {
          name?: string;
          error?: { message?: string };
        };
        return res.ok
          ? { ok: true, message: `تم الاتصال ببكسل ${body.name ?? pixelId}` }
          : { ok: false, message: body.error?.message ?? `فشل الاتصال (${res.status})` };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : "تعذر الاتصال" };
      }
    }

    if (data.key === "whatsapp") {
      // اختبار مباشر مع Meta WhatsApp Cloud API — بدون أي وسيط
      const { phoneNumberId, accessToken } = await whatsappCredentials();
      if (!phoneNumberId || !accessToken) {
        return { ok: false, message: "أدخل معرّف رقم الهاتف ورمز الوصول من Meta أولاً" };
      }
      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${phoneNumberId}?access_token=${encodeURIComponent(accessToken)}`,
        );
        const body = (await res.json().catch(() => ({}))) as {
          display_phone_number?: string;
          error?: { message?: string };
        };
        return res.ok
          ? { ok: true, message: `حساب واتساب متصل: ${body.display_phone_number ?? phoneNumberId}` }
          : { ok: false, message: body.error?.message ?? `فشل الاتصال (${res.status})` };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : "تعذر الاتصال" };
      }
    }

    const wp = await readConfig<{ siteUrl?: string; username?: string; appPassword?: string }>(
      "wordpress",
    );
    if (!wp.siteUrl) return { ok: false, message: "أدخل رابط الموقع أولاً" };
    try {
      const base = wp.siteUrl.replace(/\/+$/, "");
      const headers: Record<string, string> = {};
      if (wp.username && wp.appPassword) {
        headers["Authorization"] =
          `Basic ${Buffer.from(`${wp.username}:${wp.appPassword}`).toString("base64")}`;
      }
      const res = await fetch(`${base}/wp-json/wp/v2/types`, { headers });
      return res.ok
        ? { ok: true, message: "تم الاتصال بموقع ووردبريس" }
        : { ok: false, message: `فشل الاتصال (${res.status})` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "تعذر الاتصال" };
    }
  });
