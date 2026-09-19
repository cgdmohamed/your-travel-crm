import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plane, LogIn, KeyRound, ArrowRight, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { needsBootstrap, bootstrapAdmin } from "@/lib/bootstrap.functions";
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
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [bootstrap, setBootstrap] = useState(false);
  const statusFn = useServerFn(needsBootstrap);
  const bootstrapFn = useServerFn(bootstrapAdmin);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/", replace: true });
    });
    void statusFn({})
      .then((r) => setBootstrap(r.needed))
      .catch(() => setBootstrap(false));
  }, [navigate, statusFn]);

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

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("Invalid login")
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
          : error.message.includes("Email not confirmed")
            ? "لم يتم تأكيد البريد بعد — راجع رسالة التفعيل"
            : "تعذر تسجيل الدخول",
      );
      return;
    }
    toast.success("مرحباً بك");
    void navigate({ to: "/", replace: true });
  };

  const forgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error("تعذر إرسال رسالة الاستعادة");
      return;
    }
    setSent(true);
    toast.success("أرسلنا رابط استعادة كلمة المرور إلى بريدك");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4" dir="rtl">
      <div className="w-full max-w-md space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plane className="size-7" />
          </span>
          <h1 className="text-2xl font-extrabold text-foreground">طواف للسياحة</h1>
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
            <CardTitle className="text-base">
              {mode === "login" ? "تسجيل الدخول" : "استعادة كلمة المرور"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mode === "login" ? (
              <form className="space-y-4" onSubmit={login}>
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
                <button
                  type="button"
                  className="w-full text-center text-sm font-semibold text-primary hover:underline"
                  onClick={() => {
                    setMode("forgot");
                    setSent(false);
                  }}
                >
                  نسيت كلمة المرور؟
                </button>
              </form>
            ) : sent ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-foreground">
                  أرسلنا رابط إعادة تعيين كلمة المرور إلى <span dir="ltr">{email}</span>. افتح
                  الرابط من بريدك لإكمال العملية.
                </p>
                <Button variant="outline" className="w-full" onClick={() => setMode("login")}>
                  <ArrowRight className="size-4" /> العودة لتسجيل الدخول
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={forgot}>
                <p className="text-sm text-muted-foreground">
                  أدخل بريدك المسجّل وسنرسل لك رابطاً لتعيين كلمة مرور جديدة.
                </p>
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
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}
                  إرسال رابط الاستعادة
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-sm font-semibold text-primary hover:underline"
                  onClick={() => setMode("login")}
                >
                  العودة لتسجيل الدخول
                </button>
              </form>
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
