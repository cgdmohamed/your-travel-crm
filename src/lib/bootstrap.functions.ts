import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hasZeroUsers, hashPassword } from "@/lib/auth-server";
import { query } from "@/lib/db.server";

/** هل النظام بلا أي حساب بعد؟ (لإنشاء حساب المدير الأول) */
export const needsBootstrap = createServerFn({ method: "GET" }).handler(async () => ({
  needed: await hasZeroUsers(),
}));

const schema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(8),
});

/** إنشاء حساب المدير الأول — متاح فقط عندما لا يوجد أي حساب */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    if (!(await hasZeroUsers())) {
      return { ok: false as const, message: "يوجد حساب بالفعل — سجّل الدخول أو اطلب من المدير" };
    }
    const passwordHash = await hashPassword(data.password);
    await query(
      `insert into users (email, password_hash, name, role) values ($1, $2, $3, 'admin')`,
      [data.email.trim().toLowerCase(), passwordHash, data.fullName],
    );
    return { ok: true as const, message: "تم إنشاء حساب المدير — سجّل الدخول الآن" };
  });
