import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type AccountRow = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  confirmed: boolean;
  lastSignIn: string | null;
  createdAt: string;
};

async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("هذه العملية متاحة لمدير الشركة فقط");
}

/** قائمة حسابات الدخول (للمدير فقط) */
export const listAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountRow[]> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const users = data?.users ?? [];
    const ids = users.map((u) => u.id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);
    return users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      fullName: profiles?.find((p) => p.id === u.id)?.full_name || (u.email ?? ""),
      role: roles?.find((r) => r.user_id === u.id)?.role ?? "agent",
      confirmed: Boolean(u.email_confirmed_at),
      lastSignIn: u.last_sign_in_at ?? null,
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
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, role: data.role },
    });
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, message: "تم إنشاء الحساب" };
  });

/** تعطيل أو حذف حساب دخول (للمدير فقط) */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.id === (context as { userId: string }).userId) {
      return { ok: false as const, message: "لا يمكنك حذف حسابك الحالي" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, message: "تم حذف الحساب" };
  });

/** تغيير دور موظف (للمدير فقط) */
export const setAccountRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.id, role: data.role });
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, message: "تم تحديث الدور" };
  });
