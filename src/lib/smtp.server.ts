/** إرسال بريد فعلي + اختبار اتصال خادم البريد الصادر SMTP (خادم فقط) */
import nodemailer from "nodemailer";
import { readConfig, type SmtpConfig } from "@/lib/integrations.server";

/** يرسل بريدًا حقيقيًا عبر إعدادات SMTP المحفوظة في integration_config. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; message: string }> {
  const cfg = await readConfig<SmtpConfig>("smtp");
  const host = cfg.host?.trim();
  const port = Number(cfg.port ?? "587");
  if (!host || !cfg.username || !cfg.password || !cfg.fromEmail) {
    return { ok: false, message: "إعدادات SMTP غير مكتملة — راجع الإعدادات ← التكاملات" };
  }
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: cfg.secure === "true",
      auth: { user: cfg.username, pass: cfg.password },
    });
    await transporter.sendMail({
      from: cfg.fromName ? `"${cfg.fromName}" <${cfg.fromEmail}>` : cfg.fromEmail,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
    });
    return { ok: true, message: "تم إرسال البريد" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "تعذر إرسال البريد" };
  }
}

export async function testSmtpConnection(): Promise<{ ok: boolean; message: string }> {
  const cfg = await readConfig<SmtpConfig>("smtp");
  const host = cfg.host?.trim();
  const port = Number(cfg.port ?? "587");
  if (!host) return { ok: false, message: "أدخل عنوان خادم البريد أولاً" };
  if (!cfg.username || !cfg.password) {
    return { ok: false, message: "أدخل اسم المستخدم وكلمة المرور أولاً" };
  }
  if (!cfg.fromEmail) return { ok: false, message: "أدخل بريد المُرسِل أولاً" };

  try {
    const net = await import("node:net");
    const greeting = await new Promise<string>((resolve, reject) => {
      const socket = net.connect({ host, port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error("انتهت مهلة الاتصال"));
      }, 8000);
      socket.once("data", (chunk: Buffer) => {
        clearTimeout(timer);
        const text = chunk.toString("utf8");
        socket.end();
        resolve(text);
      });
      socket.once("error", (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    if (greeting.startsWith("220")) {
      return { ok: true, message: `استجاب خادم البريد ${host} على المنفذ ${port}` };
    }
    return { ok: false, message: `رد غير متوقع من الخادم: ${greeting.slice(0, 60)}` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? `تعذر الوصول للخادم: ${err.message}` : "تعذر الاتصال",
    };
  }
}
