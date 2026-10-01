import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plane, LogIn, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { login } from "@/lib/auth";
import { useCrm } from "@/lib/crm-data";
import { needsBootstrap, bootstrapAdmin } from "@/lib/bootstrap.functions";
import { requestPasswordReset } from "@/lib/password-reset.functions";
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
      { title: "تسجيل الدخول" },
      {
        name: "description",
        content: "تسجيل الدخول إلى نظام إدارة العملاء والمبيعات.",
      },
      { property: "og:title", content: "تسجيل الدخول" },
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
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const statusFn = useServerFn(needsBootstrap);
  const bootstrapFn = useServerFn(bootstrapAdmin);
  const requestResetFn = useServerFn(requestPasswordReset);
  const { data: branding } = useCompanyBranding();

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  const checkBootstrapStatus = () => {
    setChecking(true);
    setCheckError(null);
    void statusFn({})
      .then((r) => {
        setBootstrap(r.needed);
        setChecking(false);
      })
      .catch((err: unknown) => {
        // Do NOT silently fall back to the login form here: the most likely
        // cause is the `users` table not existing yet (migrations never ran
        // against this deployment's Postgres) — showing a plain login form
        // in that case leaves the admin with literally no way to get in.
        setCheckError(err instanceof Error ? err.message : "تعذر التحقق من حالة النظام");
        setChecking(false);
      });
  };

  useEffect(checkBootstrapStatus, [statusFn]);

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

  const submitForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotBusy(true);
    const message = await requestResetFn({ data: { email: forgotEmail.trim() } })
      .then((r) => r.message)
      .catch(() => "تعذر إرسال الطلب — حاول مرة أخرى");
    setForgotBusy(false);
    toast.success(message);
    setForgotOpen(false);
    setForgotEmail("");
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
            {branding?.companyName ?? "نظام إدارة العملاء"}
          </h1>
          <p className="text-sm text-muted-foreground">نظام إدارة العملاء والحجوزات</p>
        </div>

        {checking ? (
          <Card className="shadow-sm">
            <CardContent className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> جارٍ التحقق من حالة النظام...
            </CardContent>
          </Card>
        ) : checkError ? (
          <Card className="shadow-sm border-destructive/50">
            <CardHeader>
              <CardTitle className="text-base text-destructive">تعذر الاتصال بالنظام</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                تعذر التحقق مما إذا كان يوجد حساب مدير بالفعل. السبب الأرجح: قاعدة البيانات غير
                متصلة، أو أن ملفات الترحيل (migrations) لم تُطبَّق بعد على هذه القاعدة — راجع
                جدول <code dir="ltr">users</code> في Postgres، ثم أعد المحاولة.
              </p>
              <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground" dir="ltr">
                {checkError}
              </p>
              <Button type="button" variant="outline" className="w-full" onClick={checkBootstrapStatus}>
                إعادة المحاولة
              </Button>
            </CardContent>
          </Card>
        ) : bootstrap ? (
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

              {forgotOpen ? (
                <form className="mt-4 space-y-3 border-t pt-4" onSubmit={submitForgotPassword}>
                  <p className="text-xs text-muted-foreground">
                    أدخل بريدك الإلكتروني، وسنرسل لك رابطًا لإعادة تعيين كلمة المرور إذا كان
                    الحساب موجودًا.
                  </p>
                  <Input
                    type="email"
                    required
                    dir="ltr"
                    className="text-right"
                    placeholder="name@company.com"
                    value={forgotEmail}
                    onChange={(ev) => setForgotEmail(ev.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="flex-1" disabled={forgotBusy}>
                      {forgotBusy ? <Loader2 className="size-4 animate-spin" /> : null} إرسال رابط
                      الاستعادة
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setForgotOpen(false)}
                    >
                      إلغاء
                    </Button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className="mt-3 w-full text-center text-xs font-medium text-primary hover:underline"
                  onClick={() => setForgotOpen(true)}
                >
                  نسيت كلمة المرور؟
                </button>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          الحسابات يُنشئها مدير الشركة من صفحة الإعدادات ← المستخدمون.
        </p>
      </div>
    </div>
  );
}
