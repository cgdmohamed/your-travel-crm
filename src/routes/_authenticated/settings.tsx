import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, ImagePlus, Loader2, Save } from "lucide-react";
import { AppLayout } from "@/components/crm/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings, type AppSettings } from "@/lib/settings";
import { useCompanyBranding } from "@/lib/branding";
import { updateCompanySettings, uploadCompanyLogo } from "@/lib/company.functions";
import { readFile } from "@/components/crm/FileDrop";
import { IntegrationsTab } from "@/components/crm/IntegrationsTab";
import { useCrm, ROLE_LABELS } from "@/lib/crm-data";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "الإعدادات — طواف للسياحة" },
      {
        name: "description",
        content: "إعدادات النظام: بيانات الشركة، العملة والضرائب، التنبيهات، التكاملات والصلاحيات.",
      },
      { property: "og:title", content: "الإعدادات — طواف للسياحة" },
      {
        property: "og:description",
        content: "لوحة إعدادات نظام إدارة عملاء شركة السياحة بالكامل في مكان واحد.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * الهوية البصرية للشركة (اسم/شعار/لون مميز/تواصل) — محفوظة في قاعدة البيانات
 * (`company_settings`)، بعكس بقية حقول هذه الشاشة (تُحفظ محلياً على هذا الجهاز
 * فقط). هذه الحقول هي التي تظهر فعلياً في القائمة الجانبية وصفحة الدخول
 * ولكل من يفتح النظام، لذا تعديلها مقصور على المدير.
 */
function BrandingCard({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: branding, isLoading } = useCompanyBranding();
  const updateFn = useServerFn(updateCompanySettings);
  const uploadFn = useServerFn(uploadCompanyLogo);

  const [name, setName] = useState("");
  const [accent, setAccent] = useState("#2563eb");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!branding) return;
    setName(branding.companyName);
    setAccent(branding.accentColor);
    setPhone(branding.contactPhone ?? "");
    setEmail(branding.contactEmail ?? "");
  }, [branding]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["company-settings"] });

  const save = async () => {
    setSaving(true);
    const r = await updateFn({
      data: { companyName: name, accentColor: accent, contactPhone: phone, contactEmail: email },
    }).catch((err: unknown) => ({
      ok: false as const,
      message: err instanceof Error ? err.message : "تعذر الحفظ",
    }));
    setSaving(false);
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    toast.success(r.message ?? "تم الحفظ");
    await invalidate();
  };

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    const picked = await readFile(file);
    if (!picked) return;
    setUploading(true);
    const r = await uploadFn({ data: { fileName: picked.name, dataUrl: picked.dataUrl } }).catch(
      (err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : "تعذر الرفع" }),
    );
    setUploading(false);
    if (!r.ok) {
      toast.error("error" in r ? r.error : "تعذر رفع الشعار");
      return;
    }
    toast.success("تم رفع الشعار");
    await invalidate();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">الهوية البصرية والعلامة التجارية</CardTitle>
        <span className="text-xs text-muted-foreground">
          تظهر للجميع في القائمة الجانبية وصفحة الدخول
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAdmin ? (
          <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            تعديل الهوية البصرية للشركة متاح لمدير الشركة فقط. القيم الحالية معروضة هنا للاطّلاع.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="شعار الشركة" className="size-full object-cover" />
            ) : (
              <Building2 className="size-6 text-muted-foreground" />
            )}
          </div>
          {isAdmin ? (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm font-medium text-foreground hover:border-primary/60">
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              رفع شعار جديد
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  void pickLogo(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="اسم الشركة">
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
          </Field>
          <Field label="اللون المميز" hint="يُطبَّق فوراً على الأزرار والروابط الأساسية">
            <div className="flex items-center gap-2">
              <Input
                type="color"
                className="h-10 w-14 cursor-pointer p-1"
                value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#2563eb"}
                onChange={(e) => setAccent(e.target.value)}
                disabled={!isAdmin}
              />
              <Input
                dir="ltr"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                disabled={!isAdmin}
                className="text-right"
              />
            </div>
          </Field>
          <Field label="هاتف التواصل">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!isAdmin} />
          </Field>
          <Field label="بريد التواصل">
            <Input
              type="email"
              dir="ltr"
              className="text-right"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!isAdmin}
            />
          </Field>
        </div>

        {isAdmin ? (
          <div className="flex justify-end">
            <Button onClick={() => void save()} disabled={saving || isLoading}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              حفظ بيانات الشركة
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SettingsPage() {
  const { settings, update } = useSettings();
  const { employees, currentUser, can } = useCrm();
  const [draft, setDraft] = useState<AppSettings>(settings);
  useEffect(() => setDraft(settings), [settings]);
  const [activeTab, setActiveTab] = useState("company");

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    update(draft);
    toast.success("تم حفظ الإعدادات");
  };

  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  return (
    <AppLayout title="الإعدادات" subtitle="إعدادات النظام بالكامل في مكان واحد">
      <div className="space-y-5" dir="rtl">
        {activeTab !== "company" ? (
          <div className="flex flex-wrap items-center justify-end gap-3 rounded-lg border bg-card p-4 shadow-sm">
            <Button onClick={save}>
              <Save className="size-4" /> حفظ التغييرات
            </Button>
          </div>
        ) : null}

        <Tabs defaultValue="company" onValueChange={setActiveTab} dir="rtl">
          <TabsList className="flex-wrap">
            <TabsTrigger value="company">بيانات الشركة</TabsTrigger>
            <TabsTrigger value="finance">المالية والعملة</TabsTrigger>
            <TabsTrigger value="alerts">التنبيهات والعرض</TabsTrigger>
            <TabsTrigger value="integrations">التكاملات</TabsTrigger>
            <TabsTrigger value="users">المستخدمون والصلاحيات</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="mt-4 space-y-4">
            <BrandingCard isAdmin={currentUser.role === "admin"} />
          </TabsContent>

          <TabsContent value="finance" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">العملة والضرائب والدفعات</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <Field label="العملة">
                  <Select value={draft.currency} onValueChange={(v) => set("currency", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EGP">جنيه مصري (EGP)</SelectItem>
                      <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                      <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                      <SelectItem value="AED">درهم إماراتي (AED)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="نسبة الضريبة %">
                  <Input
                    type="number"
                    value={String(draft.vatRate)}
                    onChange={(e) => set("vatRate", num(e.target.value, 0))}
                  />
                </Field>
                <Field label="نسبة العربون الافتراضية %" hint="تُقترح عند تسجيل أول دفعة">
                  <Input
                    type="number"
                    value={String(draft.depositPercent)}
                    onChange={(e) => set("depositPercent", num(e.target.value, 0))}
                  />
                </Field>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">التنبيهات وعرض الجداول</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <Field
                  label="تنبيه السفر القريب (يوم)"
                  hint="يظهر في لوحة المؤشرات للحجوزات المستحقة"
                >
                  <Input
                    type="number"
                    value={String(draft.travelAlertDays)}
                    onChange={(e) => set("travelAlertDays", num(e.target.value, 45))}
                  />
                </Field>
                <Field label="فلتر «قريب السفر» في الحجوزات (يوم)">
                  <Input
                    type="number"
                    value={String(draft.soonFilterDays)}
                    onChange={(e) => set("soonFilterDays", num(e.target.value, 30))}
                  />
                </Field>
                <Field label="عدد السجلات في الصفحة">
                  <Input
                    type="number"
                    value={String(draft.pageSize)}
                    onChange={(e) => set("pageSize", num(e.target.value, 8))}
                  />
                </Field>
                <div className="flex items-center justify-between rounded-md border bg-background p-3 md:col-span-3">
                  <div>
                    <p className="text-sm font-semibold">تنبيه المبالغ المستحقة قبل السفر</p>
                    <p className="text-xs text-muted-foreground">
                      بطاقة تنبيهات في لوحة المؤشرات مع تسجيل متابعة
                    </p>
                  </div>
                  <Switch
                    checked={draft.notifyDueSoon}
                    onCheckedChange={(v) => set("notifyDueSoon", v)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border bg-background p-3 md:col-span-3">
                  <div>
                    <p className="text-sm font-semibold">تنبيه عند وصول عميل محتمل جديد</p>
                    <p className="text-xs text-muted-foreground">إشعار فوري داخل النظام</p>
                  </div>
                  <Switch
                    checked={draft.notifyNewLead}
                    onCheckedChange={(v) => set("notifyNewLead", v)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="mt-4 space-y-4">
            <IntegrationsTab
              autoClassify={draft.autoClassifyWhatsapp}
              onAutoClassify={(v) => set("autoClassifyWhatsapp", v)}
              updatedBy={currentUser.id}
            />
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">المستخدمون والصلاحيات</CardTitle>
                {can("team.view") ? (
                  <Button variant="outline" asChild>
                    <Link to="/team">إدارة الصلاحيات</Link>
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  المستخدم الحالي: {currentUser.name} — {ROLE_LABELS[currentUser.role]}
                </p>
                <ul className="divide-y rounded-md border">
                  {employees.map((e) => (
                    <li key={e.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm font-semibold text-foreground">{e.name}</span>
                      <Badge variant="outline">{ROLE_LABELS[e.role]}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
