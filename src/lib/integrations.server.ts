/** قراءة إعدادات التكاملات المحفوظة في قاعدة البيانات (خادم فقط) — PostgreSQL عادي */
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
/** واتساب بيزنس عبر Meta WhatsApp Cloud API الرسمية مباشرة (بدون أي وسيط) */
export type WhatsAppConfig = { phoneNumberId?: string; accessToken?: string; appSecret?: string };
export type WordpressConfig = { siteUrl?: string; username?: string; appPassword?: string };

export async function readConfig<T extends Record<string, unknown>>(
  key: IntegrationKey,
): Promise<T> {
  const { queryOne } = await import("@/lib/db.server");
  const row = await queryOne<{ config: T }>(
    `select config from integration_config where key = $1`,
    [key],
  );
  return row?.config ?? ({} as T);
}

export async function writeConfig(
  key: IntegrationKey,
  patch: Record<string, unknown>,
  updatedBy?: string,
): Promise<void> {
  const { query } = await import("@/lib/db.server");
  const current = await readConfig(key);
  const next: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === "") delete next[k];
    else next[k] = v;
  }
  await query(
    `insert into integration_config (key, config, updated_by, updated_at)
     values ($1, $2::jsonb, $3, now())
     on conflict (key) do update set config = $2::jsonb, updated_by = $3, updated_at = now()`,
    [key, JSON.stringify(next), updatedBy ?? null],
  );
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

/** بيانات اتصال WhatsApp Cloud API الرسمية (Meta مباشرة) */
export async function whatsappCredentials() {
  const cfg = await readConfig<WhatsAppConfig>("whatsapp");
  return {
    phoneNumberId: pick(cfg.phoneNumberId, process.env["WHATSAPP_PHONE_NUMBER_ID"]),
    accessToken: pick(cfg.accessToken, process.env["WHATSAPP_ACCESS_TOKEN"]),
    appSecret: pick(cfg.appSecret, process.env["WHATSAPP_APP_SECRET"]),
  };
}

/** إعدادات SMTP: القيمة المحفوظة في القاعدة أولاً، ثم متغيّرات البيئة كـfallback */
export async function smtpCredentials() {
  const cfg = await readConfig<SmtpConfig>("smtp");
  return {
    host: pick(cfg.host, process.env["SMTP_HOST"]),
    port: pick(cfg.port, process.env["SMTP_PORT"]),
    username: pick(cfg.username, process.env["SMTP_USERNAME"]),
    password: pick(cfg.password, process.env["SMTP_PASSWORD"]),
    fromEmail: pick(cfg.fromEmail, process.env["SMTP_FROM_EMAIL"]),
    fromName: pick(cfg.fromName, process.env["SMTP_FROM_NAME"]),
    secure: pick(cfg.secure, process.env["SMTP_SECURE"]),
  };
}
