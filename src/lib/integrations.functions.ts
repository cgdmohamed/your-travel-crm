import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const mask = (v?: string) => (v ? `••••${v.slice(-4)}` : "");

export type IntegrationsStatus = {
  meta: { connected: boolean; pixelId: string; tokenMask: string; testEventCode: string };
  whatsapp: { connected: boolean; keyMask: string; phoneNumber: string; gatewayReady: boolean };
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
    const { readConfig, metaCredentials, whatsappCredentials } = await import(
      "@/lib/integrations.server"
    );
    const meta = await metaCredentials();
    const wa = await whatsappCredentials();
    const wp = await readConfig<{ siteUrl?: string; username?: string; appPassword?: string }>(
      "wordpress",
    );
    const smtp = await readConfig<import("@/lib/integrations.server").SmtpConfig>("smtp");
    return {
      meta: {
        connected: Boolean(meta.pixelId && meta.token),
        pixelId: meta.pixelId ?? "",
        tokenMask: mask(meta.token),
        testEventCode: meta.testCode ?? "",
      },
      whatsapp: {
        connected: Boolean(wa.apiKey && wa.lovableKey),
        keyMask: mask(wa.apiKey),
        phoneNumber: wa.phoneNumber ?? "",
        gatewayReady: Boolean(wa.lovableKey),
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
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data }) => {
    const { writeConfig } = await import("@/lib/integrations.server");
    await writeConfig(data.key, data.values, data.updatedBy);
    return { ok: true as const };
  });

/** حذف بيانات ربط تكامل */
export const disconnectIntegration = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ key: z.enum(["meta", "whatsapp", "wordpress", "smtp"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("integration_config").delete().eq("key", data.key);
    return { ok: true as const };
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
      const { apiKey, lovableKey } = await whatsappCredentials();
      if (!apiKey) return { ok: false, message: "أدخل مفتاح واتساب بيزنس أولاً" };
      if (!lovableKey) return { ok: false, message: "بوابة الاتصال غير جاهزة على الخادم" };
      try {
        const res = await fetch("https://connector-gateway.lovable.dev/whatsapp/health", {
          headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": apiKey },
        });
        return res.ok
          ? { ok: true, message: "حساب واتساب بيزنس متصل" }
          : { ok: false, message: `فشل الاتصال (${res.status})` };
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
        headers["Authorization"] = `Basic ${btoa(`${wp.username}:${wp.appPassword}`)}`;
      }
      const res = await fetch(`${base}/wp-json/wp/v2/types`, { headers });
      return res.ok
        ? { ok: true, message: "تم الاتصال بموقع ووردبريس" }
        : { ok: false, message: `فشل الاتصال (${res.status})` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "تعذر الاتصال" };
    }
  });
