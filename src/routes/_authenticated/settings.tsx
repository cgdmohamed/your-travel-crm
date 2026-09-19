import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, RotateCcw, Save } from "lucide-react";
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

function SettingsPage() {
  const { settings, update, reset } = useSettings();
  const { employees, currentUser, can } = useCrm();
  const [draft, setDraft] = useState<AppSettings>(settings);
  useEffect(() => setDraft(settings), [settings]);

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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </span>
            <div>
              <p className="text-base font-bold text-foreground">{settings.companyName}</p>
              <p className="text-xs text-muted-foreground">
                تُحفظ الإعدادات على هذا الجهاز وتُطبَّق فوراً على كل الشاشات
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                reset();
                toast.success("تمت الاستعادة للإعدادات الافتراضية");
              }}
            >
              <RotateCcw className="size-4" /> استعادة الافتراضي
            </Button>
            <Button onClick={save}>
              <Save className="size-4" /> حفظ التغييرات
            </Button>
          </div>
        </div>

        <Tabs defaultValue="company" dir="rtl">
          <TabsList className="flex-wrap">
            <TabsTrigger value="company">بيانات الشركة</TabsTrigger>
            <TabsTrigger value="finance">المالية والعملة</TabsTrigger>
            <TabsTrigger value="alerts">التنبيهات والعرض</TabsTrigger>
            <TabsTrigger value="integrations">التكاملات</TabsTrigger>
            <TabsTrigger value="users">المستخدمون والصلاحيات</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">بيانات الشركة</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="اسم الشركة">
                  <Input
                    value={draft.companyName}
                    onChange={(e) => set("companyName", e.target.value)}
                  />
                </Field>
                <Field label="الوصف المختصر" hint="يظهر أسفل الاسم في القائمة الجانبية">
                  <Input
                    value={draft.companyTagline}
                    onChange={(e) => set("companyTagline", e.target.value)}
                  />
                </Field>
                <Field label="رقم الهاتف">
                  <Input
                    value={draft.companyPhone}
                    onChange={(e) => set("companyPhone", e.target.value)}
                    placeholder="01012345678"
                  />
                </Field>
                <Field label="البريد الإلكتروني">
                  <Input
                    value={draft.companyEmail}
                    onChange={(e) => set("companyEmail", e.target.value)}
                  />
                </Field>
                <Field label="العنوان">
                  <Input
                    value={draft.companyAddress}
                    onChange={(e) => set("companyAddress", e.target.value)}
                  />
                </Field>
                <Field label="الموقع الإلكتروني">
                  <Input value={draft.website} onChange={(e) => set("website", e.target.value)} />
                </Field>
                <Field label="الرقم الضريبي">
                  <Input value={draft.taxId} onChange={(e) => set("taxId", e.target.value)} />
                </Field>
              </CardContent>
            </Card>
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
              updatedBy={currentUser.name}
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
