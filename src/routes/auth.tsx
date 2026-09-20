import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plane, LogIn, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { login } from "@/lib/auth";
import { useCrm } from "@/lib/crm-data";
import { needsBootstrap, bootstrapAdmin } from "@/lib/bootstrap.functions";
import { useCompanyBranding } from "@/lib/branding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — طواف للسياحة" },
      {
        name: "description",
        content: "تسجيل الدخول إلى نظام إدارة عملاء ومبيعات شركة طواف للسياحة.",
      },
      { property: "og:title", content: "تسجيل الدخول — طواف للسياحة" },
      {
        property: "og:description",
        content: "ادخل إلى لوحة إدارة الباقات والعملاء والحجوزات والتحصيل.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const { refreshAuth } = useCrm();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [bootstrap, setBootstrap] = useState(false);
  const statusFn = useServerFn(needsBootstrap);
  const bootstrapFn = useServerFn(bootstrapAdmin);
  const { data: branding } = useCompanyBranding();

  useEffect(() => {
    void statusFn({})
      .then((r) => setBootstrap(r.needed))
      .catch(() => setBootstrap(false));
  }, [statusFn]);

  const createFirstAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await bootstrapFn({
      data: { email: email.trim(), fullName: fullName.trim(), password },
    }).catch(() => ({ ok: false as const, message: "تعذر إنشاء الحساب" }));
    setBusy(false);
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    toast.success(r.message);
    setBootstrap(false);
  };

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await login(email.trim(), password);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.message ?? "تعذر تسجيل الدخول");
      return;
    }
    toast.success("مرحباً بك");
    // CrmProvider (mounted once at the app root) caches the auth session in
    // its own useAuth() call, which client-side navigation alone would not
    // refresh -- without this, the dashboard would render with a stale
    // "logged out" session (falling back to a guest employee) right after
    // this exact login until a full page reload.
    await refreshAuth();
    void navigate({ to: "/", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4" dir="rtl">
      <div className="w-full max-w-md space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.companyName}
              className="size-14 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Plane className="size-7" />
            </span>
          )}
          <h1 className="text-2xl font-extrabold text-foreground">
            {branding?.companyName ?? "طواف للسياحة"}
          </h1>
          <p className="text-sm text-muted-foreground">نظام إدارة العملاء والحجوزات</p>
        </div>

        {bootstrap ? (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">إنشاء حساب المدير الأول</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={createFirstAdmin}>
                <p className="text-sm text-muted-foreground">
                  لا توجد حسابات بعد — أنشئ حساب مدير الشركة، ومنه تضيف باقي الموظفين.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">الاسم الكامل</Label>
                  <Input
                    required
                    value={fullName}
                    onChange={(ev) => setFullName(ev.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    required
                    dir="ltr"
                    className="text-right"
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">كلمة المرور</Label>
                  <Input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    placeholder="8 أحرف على الأقل"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} إنشاء الحساب
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">تسجيل الدخول</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={doLogin}>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    required
                    dir="ltr"
                    className="text-right"
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                    placeholder="name@company.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">كلمة المرور</Label>
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                  دخول
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          الحسابات يُنشئها مدير الشركة من صفحة الإعدادات ← المستخدمون. لنسيان كلمة المرور، راجع
          مدير الشركة لإعادة تعيينها.
        </p>
      </div>
    </div>
  );
}
