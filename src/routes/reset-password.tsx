import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plane, KeyRound, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { resetPasswordWithToken } from "@/lib/password-reset.functions";
import { useCompanyBranding } from "@/lib/branding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SearchParams = { token: string | undefined };

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    token: typeof search["token"] === "string" ? search["token"] : undefined,
  }),
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "إعادة تعيين كلمة المرور — طواف للسياحة" },
      { name: "description", content: "إعادة تعيين كلمة مرور حساب الدخول." },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const { data: branding } = useCompanyBranding();
  const resetFn = useServerFn(resetPasswordWithToken);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("رابط إعادة التعيين غير صالح");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setBusy(true);
    const r = await resetFn({ data: { token, newPassword } }).catch(() => ({
      ok: false as const,
      message: "تعذر إعادة تعيين كلمة المرور",
    }));
    setBusy(false);
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    toast.success(r.message);
    void navigate({ to: "/auth", replace: true });
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
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">إعادة تعيين كلمة المرور</CardTitle>
          </CardHeader>
          <CardContent>
            {!token ? (
              <p className="text-sm text-destructive">
                الرابط غير صالح — تأكد من فتح نفس الرابط المُرسَل في البريد الإلكتروني.
              </p>
            ) : (
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">كلمة المرور الجديدة</Label>
                  <Input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(ev) => setNewPassword(ev.target.value)}
                    placeholder="8 أحرف على الأقل"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">تأكيد كلمة المرور</Label>
                  <Input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(ev) => setConfirmPassword(ev.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                  تعيين كلمة المرور
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
