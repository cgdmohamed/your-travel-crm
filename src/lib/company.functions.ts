/**
 * هوية الشركة (branding) لهذا التنصيب — Phase 7. صف واحد في `company_settings`
 * (اسم/شعار/لون مميز/تواصل)، قراءته عامة (تظهر في صفحة الدخول قبل أي جلسة)
 * وتعديله للمدير فقط.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";

export type CompanySettingsRow = {
  companyName: string;
  logoUrl: string | null;
  accentColor: string;
  contactPhone: string | null;
  contactEmail: string | null;
};

async function assertAdmin(context: { role: string }) {
  if (context.role !== "admin") throw new Error("هذه العملية متاحة لمدير الشركة فقط");
}

/** بيانات هوية الشركة — عامة بدون تسجيل دخول (تُستخدم في صفحة الدخول) */
export const getCompanySettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<CompanySettingsRow> => {
    const { queryOne } = await import("@/lib/db.server");
    const row = await queryOne<{
      company_name: string;
      logo_url: string | null;
      accent_color: string;
      contact_phone: string | null;
      contact_email: string | null;
    }>(
      `select company_name, logo_url, accent_color, contact_phone, contact_email
       from company_settings where id = true`,
    );
    return {
      companyName: row?.company_name ?? "Your Travel",
      logoUrl: row?.logo_url ?? null,
      accentColor: row?.accent_color ?? "#2563eb",
      contactPhone: row?.contact_phone ?? null,
      contactEmail: row?.contact_email ?? null,
    };
  },
);

const updateSchema = z.object({
  companyName: z.string().trim().min(1, "اسم الشركة مطلوب").max(200).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "صيغة اللون غير صحيحة (مثال: #2563eb)")
    .optional(),
  // نص فاضي يعني "امسح القيمة"
  contactPhone: z.string().max(40).optional(),
  contactEmail: z.union([z.string().email(), z.literal("")]).optional(),
});

/** تعديل بيانات هوية الشركة (للمدير فقط) */
export const updateCompanySettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { query } = await import("@/lib/db.server");

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (data.companyName !== undefined) {
      sets.push(`company_name = $${i++}`);
      values.push(data.companyName);
    }
    if (data.accentColor !== undefined) {
      sets.push(`accent_color = $${i++}`);
      values.push(data.accentColor);
    }
    if (data.contactPhone !== undefined) {
      sets.push(`contact_phone = $${i++}`);
      values.push(data.contactPhone.trim() || null);
    }
    if (data.contactEmail !== undefined) {
      sets.push(`contact_email = $${i++}`);
      values.push(data.contactEmail.trim() || null);
    }
    if (sets.length === 0) return { ok: true as const, message: "لا يوجد تغيير" };
    sets.push(`updated_at = now()`);
    await query(`update company_settings set ${sets.join(", ")} where id = true`, values);
    return { ok: true as const, message: "تم حفظ بيانات الشركة" };
  });

const logoInput = z.object({
  fileName: z.string().min(1),
  dataUrl: z.string().min(1),
});

/** رفع شعار الشركة (للمدير فقط) — يُخزَّن محلياً على القرص تحت data/uploads/company-assets/ */
export const uploadCompanyLogo = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => logoInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { writeUpload, IMAGE_UPLOAD_OPTS } = await import("@/lib/upload.server");
    const { query } = await import("@/lib/db.server");
    const { relativePath } = await writeUpload(
      "company-assets",
      data.dataUrl,
      data.fileName,
      IMAGE_UPLOAD_OPTS,
    );
    const url = `/api/uploads/${relativePath}`;
    await query(`update company_settings set logo_url = $1, updated_at = now() where id = true`, [
      url,
    ]);
    return { ok: true as const, url };
  });
