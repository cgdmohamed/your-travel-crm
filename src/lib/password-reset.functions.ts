/**
 * Self-service password reset — public routes (no requireAuth), same
 * pattern as bootstrap.functions.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";
import { hashPassword } from "@/lib/auth-server";
import { query, queryOne } from "@/lib/db.server";

const RESET_TOKEN_TTL_MINUTES = 60;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** Best-effort origin for building the reset link — falls back to a relative link if unknown. */
async function requestOrigin(): Promise<string | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const host = request?.headers.get("x-forwarded-host") ?? request?.headers.get("host");
    if (!host) return null;
    const proto = request?.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  } catch {
    return null;
  }
}

const requestSchema = z.object({ email: z.string().email() });

const GENERIC_MESSAGE =
  "إذا كان البريد الإلكتروني مسجلاً لدينا، ستصلك رسالة تحتوي على رابط لإعادة تعيين كلمة المرور.";

/**
 * يبحث عن المستخدم، ويولّد رابط استعادة إن وُجد، ويرسله بالبريد — لكن
 * يرجّع دائمًا نفس رسالة النجاح بغض النظر عن وجود الحساب من عدمه، لمنع
 * اكتشاف الحسابات المسجلة (account enumeration).
 */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => requestSchema.parse(data))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const user = await queryOne<{ id: string; name: string }>(
      `select id, name from users where email = $1 and active = true`,
      [email],
    );

    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = sha256(rawToken);
      await query(
        `insert into password_reset_tokens (user_id, token_hash, expires_at)
         values ($1, $2, now() + interval '${RESET_TOKEN_TTL_MINUTES} minutes')`,
        [user.id, tokenHash],
      );

      const origin = await requestOrigin();
      const link = `${origin ?? ""}/reset-password?token=${rawToken}`;

      try {
        const { sendEmail } = await import("@/lib/smtp.server");
        const result = await sendEmail({
          to: email,
          subject: "إعادة تعيين كلمة المرور",
          html: `
            <p>مرحبًا ${user.name}،</p>
            <p>وصلنا طلب لإعادة تعيين كلمة مرور حسابك. اضغط على الرابط التالي خلال ساعة واحدة:</p>
            <p><a href="${link}">${link}</a></p>
            <p>إذا لم تطلب هذا، يمكنك تجاهل هذه الرسالة بأمان.</p>
          `,
        });
        if (!result.ok) {
          console.error("password reset email send failed:", result.message);
        }
      } catch (err) {
        // إعدادات SMTP غير مكتملة أو فشل الإرسال — يُسجَّل الخطأ فقط، والرد للعميل يبقى نفس رسالة النجاح
        console.error("password reset email send threw:", err);
      }
    }

    return { ok: true as const, message: GENERIC_MESSAGE };
  });

const resetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

/** يتحقق من صلاحية التوكن، يحدّث كلمة المرور، ويُبطل كل جلسات المستخدم (تسجيل خروج من كل الأجهزة) */
export const resetPasswordWithToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => resetSchema.parse(data))
  .handler(async ({ data }) => {
    const tokenHash = sha256(data.token);
    const row = await queryOne<{ id: string; user_id: string; expires_at: string; used: boolean }>(
      `select id, user_id, expires_at, used from password_reset_tokens where token_hash = $1`,
      [tokenHash],
    );
    if (!row || row.used || new Date(row.expires_at) < new Date()) {
      return { ok: false as const, message: "رابط إعادة التعيين غير صالح أو منتهي الصلاحية" };
    }

    const passwordHash = await hashPassword(data.newPassword);
    await query(`update users set password_hash = $1 where id = $2`, [passwordHash, row.user_id]);
    await query(`update password_reset_tokens set used = true where id = $1`, [row.id]);
    await query(`update refresh_tokens set revoked = true where user_id = $1`, [row.user_id]);

    return { ok: true as const, message: "تم تعيين كلمة المرور الجديدة — سجّل الدخول الآن" };
  });
