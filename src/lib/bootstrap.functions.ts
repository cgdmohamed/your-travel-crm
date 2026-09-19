import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function userCount() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
  return data?.users.length ?? 0;
}

/** هل النظام بلا أي حساب بعد؟ (لإنشاء حساب المدير الأول) */
export const needsBootstrap = createServerFn({ method: "GET" }).handler(async () => ({
  needed: (await userCount()) === 0,
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
    if ((await userCount()) > 0) {
      return { ok: false as const, message: "يوجد حساب بالفعل — سجّل الدخول أو اطلب من المدير" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) {
      return { ok: false as const, message: error?.message ?? "تعذر إنشاء الحساب" };
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    return { ok: true as const, message: "تم إنشاء حساب المدير — سجّل الدخول الآن" };
  });
