import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { hashPassword } from "@/lib/auth-server";
import { query, queryOne } from "@/lib/db.server";

export type AccountRow = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  active: boolean;
  createdAt: string;
};

async function assertAdmin(context: { role: string }) {
  if (context.role !== "admin") throw new Error("هذه العملية متاحة لمدير الشركة فقط");
}

/** قائمة حسابات الدخول (للمدير فقط) */
export const listAccounts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<AccountRow[]> => {
    await assertAdmin(context as never);
    const { rows } = await query<{
      id: string;
      email: string;
      name: string;
      role: string;
      active: boolean;
      created_at: string;
    }>(`select id, email, name, role, active, created_at from users order by created_at asc`);
    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.name,
      role: u.role,
      active: u.active,
      createdAt: u.created_at,
    }));
  });

const createSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["admin", "sales_manager", "agent", "accountant"]),
});

/** إنشاء حساب دخول لموظف (للمدير فقط) */
export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const email = data.email.trim().toLowerCase();
    const existing = await queryOne(`select id from users where email = $1`, [email]);
    if (existing) return { ok: false as const, message: "البريد الإلكتروني مستخدم بالفعل" };
    const passwordHash = await hashPassword(data.password);
    await query(
      `insert into users (email, password_hash, name, role) values ($1, $2, $3, $4)`,
      [email, passwordHash, data.fullName, data.role],
    );
    return { ok: true as const, message: "تم إنشاء الحساب" };
  });

/** تعطيل حساب دخول (للمدير فقط) — لا يُحذف الحساب فعلياً حفاظاً على مرجعية السجلات */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.id === (context as { userId: string }).userId) {
      return { ok: false as const, message: "لا يمكنك تعطيل حسابك الحالي" };
    }
    await query(`update users set active = false where id = $1`, [data.id]);
    await query(`update refresh_tokens set revoked = true where user_id = $1`, [data.id]);
    return { ok: true as const, message: "تم تعطيل الحساب" };
  });

/** إعادة تعيين كلمة مرور موظف مباشرة (للمدير فقط) — لا يوجد بريد استعادة تلقائي بعد */
export const resetAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), newPassword: z.string().min(8) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const passwordHash = await hashPassword(data.newPassword);
    await query(`update users set password_hash = $1 where id = $2`, [passwordHash, data.id]);
    await query(`update refresh_tokens set revoked = true where user_id = $1`, [data.id]);
    return { ok: true as const, message: "تم تعيين كلمة مرور جديدة" };
  });

/** تغيير دور موظف (للمدير فقط) */
export const setAccountRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        role: z.enum(["admin", "sales_manager", "agent", "accountant"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    await query(`update users set role = $1 where id = $2`, [data.role, data.id]);
    return { ok: true as const, message: "تم تحديث الدور" };
  });

const PERMISSION_VALUES = [
  "packages.view",
  "packages.edit",
  "customers.view",
  "customers.edit",
  "bookings.view",
  "bookings.edit",
  "pipeline.view",
  "pipeline.edit",
  "team.view",
  "team.edit",
  "reports.view",
  "reports.all",
] as const;

const updateSettingsSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["admin", "sales_manager", "agent", "accountant"]).optional(),
  active: z.boolean().optional(),
  /** null = إعادة الصلاحيات لصلاحيات الدور الافتراضية (يمسح التخصيص) */
  permissions: z.array(z.enum(PERMISSION_VALUES)).nullable().optional(),
});

/**
 * تعديل بيانات موظف (الدور/الحالة/الصلاحيات المخصّصة) — للمدير فقط.
 * تُستخدم من شاشة "الموظفون والصلاحيات" (team.tsx عبر useCrm().updateEmployee).
 */
export const updateEmployeeSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => updateSettingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (data.role !== undefined) {
      sets.push(`role = $${i++}`);
      params.push(data.role);
    }
    if (data.active !== undefined) {
      sets.push(`active = $${i++}`);
      params.push(data.active);
    }
    if (data.permissions !== undefined) {
      sets.push(`permissions = $${i++}`);
      params.push(data.permissions); // null clears the override
    }
    if (sets.length === 0) return { ok: true as const, message: "لا يوجد تغيير" };
    params.push(data.id);
    await query(`update users set ${sets.join(", ")} where id = $${i}`, params);
    return { ok: true as const, message: "تم تحديث بيانات الموظف" };
  });
