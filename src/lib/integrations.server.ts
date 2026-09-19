/** قراءة إعدادات التكاملات المحفوظة في قاعدة البيانات (خادم فقط) */
export type IntegrationKey = "meta" | "whatsapp" | "wordpress" | "smtp";

export type SmtpConfig = {
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  fromEmail?: string;
  fromName?: string;
  secure?: string;
};

export type MetaConfig = { pixelId?: string; accessToken?: string; testEventCode?: string };
export type WhatsAppConfig = { apiKey?: string; phoneNumber?: string };
export type WordpressConfig = { siteUrl?: string; username?: string; appPassword?: string };

export async function readConfig<T extends Record<string, unknown>>(
  key: IntegrationKey,
): Promise<T> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("integration_config")
    .select("config")
    .eq("key", key)
    .maybeSingle();
  return ((data?.config as T) ?? ({} as T)) as T;
}

export async function writeConfig(
  key: IntegrationKey,
  patch: Record<string, unknown>,
  updatedBy?: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const current = await readConfig(key);
  const next: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === "") delete next[k];
    else next[k] = v;
  }
  await supabaseAdmin.from("integration_config").upsert({
    key,
    config: next as never,
    updated_by: updatedBy ?? null,
    updated_at: new Date().toISOString(),
  });
}

/** القيمة المحفوظة أولاً ثم متغيّر البيئة */
export const pick = (stored: string | undefined, env: string | undefined) =>
  (stored && stored.trim()) || (env && env.trim()) || undefined;

export async function metaCredentials() {
  const cfg = await readConfig<MetaConfig>("meta");
  return {
    pixelId: pick(cfg.pixelId, process.env["META_PIXEL_ID"]),
    token: pick(cfg.accessToken, process.env["META_CAPI_ACCESS_TOKEN"]),
    testCode: pick(cfg.testEventCode, process.env["META_TEST_EVENT_CODE"]),
  };
}

export async function whatsappCredentials() {
  const cfg = await readConfig<WhatsAppConfig>("whatsapp");
  return {
    apiKey: pick(cfg.apiKey, process.env["WHATSAPP_API_KEY"]),
    lovableKey: process.env["LOVABLE_API_KEY"],
    phoneNumber: cfg.phoneNumber,
  };
}
