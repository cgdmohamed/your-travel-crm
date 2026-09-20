/**
 * هوية الشركة على مستوى العميل — Phase 7. يجلب `company_settings` (اسم/شعار/
 * لون مميز) بدون أي حاجة لتسجيل دخول (يعمل في صفحة الدخول قبل وجود جلسة)
 * ويطبّق اللون المميز كمتغيّر CSS على `:root` بدل قيمة ثابتة في Tailwind.
 */
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCompanySettings } from "@/lib/company.functions";

/** يطبّق اللون المميز المحفوظ كمتغيّرات CSS على الجذر (bg-primary/text-primary/...). */
function applyAccentColor(hex: string) {
  const root = document.documentElement.style;
  root.setProperty("--primary", hex);
  root.setProperty("--sidebar-primary", hex);
  root.setProperty("--ring", hex);
}

/** يجلب هوية الشركة (اسم/شعار/لون/تواصل) — بدون تسجيل دخول، صالح في صفحة الدخول أيضاً. */
export function useCompanyBranding() {
  const fn = useServerFn(getCompanySettings);
  return useQuery({
    queryKey: ["company-settings"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * يُستدعى مرة واحدة على مستوى جذر التطبيق (RootComponent): يجلب هوية الشركة
 * ويطبّق اللون المميز كمتغيّر CSS + عنوان الصفحة تلقائياً في كل الشاشات
 * (بما فيها صفحة الدخول، لأن RootComponent يلفّها هي الأخرى).
 */
export function useCompanyBrandingEffect() {
  const { data } = useCompanyBranding();

  useEffect(() => {
    if (!data) return;
    applyAccentColor(data.accentColor);
    document.title = `${data.companyName} — نظام إدارة العملاء`;
  }, [data]);

  return data;
}
