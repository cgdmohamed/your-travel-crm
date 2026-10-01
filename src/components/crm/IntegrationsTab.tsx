import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Plug, PlugZap, RefreshCw, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getIntegrationsStatus,
  saveIntegration,
  disconnectIntegration,
  testIntegration,
  sendTestEmail,
  type IntegrationsStatus,
} from "@/lib/integrations.functions";

type IntegrationKey = "meta" | "whatsapp" | "wordpress" | "smtp" | "openai";

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
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

function Status({ ok }: { ok: boolean }) {
  return ok ? (
    <Badge className="gap-1 border-success/30 bg-success/15 text-success">
      <CheckCircle2 className="size-3.5" /> مربوط
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <AlertTriangle className="size-3.5" /> غير مربوط
    </Badge>
  );
}

export function IntegrationsTab({
  autoClassify,
  onAutoClassify,
  updatedBy,
}: {
  autoClassify: boolean;
  onAutoClassify: (v: boolean) => void;
  updatedBy: string;
}) {
  const statusFn = useServerFn(getIntegrationsStatus);
  const saveFn = useServerFn(saveIntegration);
  const disconnectFn = useServerFn(disconnectIntegration);
  const testFn = useServerFn(testIntegration);
  const testEmailFn = useServerFn(sendTestEmail);
  const [testEmailTo, setTestEmailTo] = useState("");

  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  const [busy, setBusy] = useState<string>("");

  // حقول الإدخال (المفاتيح تُعرض مخفية ولا تُعاد من الخادم)
  const [metaPixel, setMetaPixel] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [metaTest, setMetaTest] = useState("");
  const [waPhoneNumberId, setWaPhoneNumberId] = useState("");
  const [waAccessToken, setWaAccessToken] = useState("");
  const [waAppSecret, setWaAppSecret] = useState("");
  const [wpUrl, setWpUrl] = useState("");
  const [wpUser, setWpUser] = useState("");
  const [wpPass, setWpPass] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpName, setSmtpName] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");

  const load = useCallback(async () => {
    const s = await statusFn({});
    setStatus(s);
    setMetaPixel(s.meta.pixelId);
    setMetaTest(s.meta.testEventCode);
    setWaPhoneNumberId(s.whatsapp.phoneNumberId);
    setWpUrl(s.wordpress.siteUrl);
    setWpUser(s.wordpress.username);
    setSmtpHost(s.smtp.host);
    setSmtpPort(s.smtp.port);
    setSmtpUser(s.smtp.username);
    setSmtpFrom(s.smtp.fromEmail);
    setSmtpName(s.smtp.fromName);
    setSmtpSecure(s.smtp.secure);
    setMetaToken("");
    setWaAccessToken("");
    setWaAppSecret("");
    setWpPass("");
    setSmtpPass("");
    setOpenaiKey("");
  }, [statusFn]);

  useEffect(() => {
    void load().catch(() => toast.error("تعذر قراءة حالة التكاملات"));
  }, [load]);

  const save = async (key: IntegrationKey, values: Record<string, string>) => {
    setBusy(key);
    try {
      await saveFn({ data: { key, values, updatedBy } });
      await load();
      toast.success("تم حفظ بيانات الربط");
    } catch {
      toast.error("تعذر الحفظ");
    } finally {
      setBusy("");
    }
  };

  const test = async (key: IntegrationKey) => {
    setBusy(`test-${key}`);
    try {
      const r = await testFn({ data: { key } });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } catch {
      toast.error("تعذر اختبار الاتصال");
    } finally {
      setBusy("");
    }
  };

  const disconnect = async (key: IntegrationKey) => {
    setBusy(`off-${key}`);
    try {
      await disconnectFn({ data: { key } });
      await load();
      toast.success("تم فصل الربط");
    } catch {
      toast.error("تعذر فصل الربط");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-sm">
        <p className="text-sm text-muted-foreground">
          أدخل بيانات الربط هنا وتُحفظ على الخادم بشكل آمن — لا تظهر المفاتيح بعد الحفظ.
        </p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="size-4" /> تحديث الحالة
        </Button>
      </div>

      {/* واتساب */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">واتساب بيزنس</CardTitle>
          <Status ok={Boolean(status?.whatsapp.connected)} />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Row label="معرّف رقم الهاتف (Phone Number ID)" hint="من WhatsApp Business API في Meta for Developers">
            <Input
              dir="ltr"
              className="text-right"
              value={waPhoneNumberId}
              onChange={(e) => setWaPhoneNumberId(e.target.value)}
              placeholder="1029384756"
            />
          </Row>
          <Row
            label="رمز الوصول (Access Token)"
            hint={
              status?.whatsapp.tokenMask
                ? `المحفوظ حالياً: ${status.whatsapp.tokenMask}`
                : "رمز وصول دائم لتطبيق واتساب بيزنس"
            }
          >
            <Input
              type="password"
              value={waAccessToken}
              onChange={(e) => setWaAccessToken(e.target.value)}
              placeholder="أدخل الرمز"
            />
          </Row>
          <Row label="سر التطبيق (App Secret)" hint="يُستخدم للتحقق من توقيع الـwebhook القادم من Meta">
            <Input
              type="password"
              value={waAppSecret}
              onChange={(e) => setWaAppSecret(e.target.value)}
              placeholder="أدخل السر"
            />
          </Row>
          <div className="flex items-center justify-between rounded-md border bg-background p-3 md:col-span-2">
            <div>
              <p className="text-sm font-semibold">الفلترة الذكية للمحادثات</p>
              <p className="text-xs text-muted-foreground">تصنيف تلقائي عبر OpenAI: مهتم بالحجز أم استفسار</p>
            </div>
            <Switch checked={autoClassify} onCheckedChange={onAutoClassify} />
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button
              disabled={busy === "whatsapp"}
              onClick={() =>
                void save("whatsapp", {
                  phoneNumberId: waPhoneNumberId,
                  accessToken: waAccessToken,
                  appSecret: waAppSecret,
                })
              }
            >
              <Save className="size-4" /> حفظ وربط
            </Button>
            <Button
              variant="outline"
              disabled={busy === "test-whatsapp"}
              onClick={() => void test("whatsapp")}
            >
              <PlugZap className="size-4" /> اختبار الاتصال
            </Button>
            {status?.whatsapp.connected ? (
              <Button variant="outline" onClick={() => void disconnect("whatsapp")}>
                <Plug className="size-4" /> فصل الربط
              </Button>
            ) : null}
            <Button variant="ghost" asChild>
              <Link to="/whatsapp">فتح صندوق واتساب</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* OpenAI */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">OpenAI (تصنيف نية محادثات واتساب)</CardTitle>
          <Status ok={Boolean(status?.openai.connected)} />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Row
            label="مفتاح OpenAI API"
            hint={
              status?.openai.keyMask
                ? `المحفوظ حالياً: ${status.openai.keyMask}`
                : "من platform.openai.com ← API keys — يُستخدم لتفعيل «الفلترة الذكية للمحادثات» أعلاه"
            }
          >
            <Input
              type="password"
              dir="ltr"
              className="text-right"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
            />
          </Row>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              disabled={busy === "openai"}
              onClick={() => void save("openai", { apiKey: openaiKey })}
            >
              <Save className="size-4" /> حفظ وربط
            </Button>
            <Button
              variant="outline"
              disabled={busy === "test-openai"}
              onClick={() => void test("openai")}
            >
              <PlugZap className="size-4" /> اختبار المفتاح
            </Button>
            {status?.openai.connected ? (
              <Button variant="outline" onClick={() => void disconnect("openai")}>
                <Plug className="size-4" /> فصل الربط
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Meta */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">تتبّع Meta (Conversions API)</CardTitle>
          <Status ok={Boolean(status?.meta.connected)} />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Row label="معرّف البكسل (Pixel ID)" hint="من Events Manager ← إعدادات مصدر البيانات">
            <Input value={metaPixel} onChange={(e) => setMetaPixel(e.target.value)} />
          </Row>
          <Row
            label="رمز وصول Conversions API"
            hint={status?.meta.tokenMask ? `المحفوظ حالياً: ${status.meta.tokenMask}` : undefined}
          >
            <Input
              type="password"
              value={metaToken}
              onChange={(e) => setMetaToken(e.target.value)}
              placeholder="أدخل الرمز"
            />
          </Row>
          <Row label="كود حدث الاختبار (اختياري)">
            <Input
              value={metaTest}
              onChange={(e) => setMetaTest(e.target.value)}
              placeholder="TEST12345"
            />
          </Row>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button
              disabled={busy === "meta"}
              onClick={() =>
                void save("meta", {
                  pixelId: metaPixel,
                  accessToken: metaToken,
                  testEventCode: metaTest,
                })
              }
            >
              <Save className="size-4" /> حفظ وربط
            </Button>
            <Button
              variant="outline"
              disabled={busy === "test-meta"}
              onClick={() => void test("meta")}
            >
              <PlugZap className="size-4" /> اختبار الاتصال
            </Button>
            {status?.meta.connected ? (
              <Button variant="outline" onClick={() => void disconnect("meta")}>
                <Plug className="size-4" /> فصل الربط
              </Button>
            ) : null}
            <Button variant="ghost" asChild>
              <Link to="/marketing">فتح لوحة التتبّع</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ووردبريس */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">ووردبريس</CardTitle>
          <Status ok={Boolean(status?.wordpress.connected)} />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Row label="رابط الموقع" hint="يُستخدم لمزامنة الباقات مع صفحات الموقع">
            <Input
              value={wpUrl}
              onChange={(e) => setWpUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </Row>
          <Row label="اسم المستخدم">
            <Input value={wpUser} onChange={(e) => setWpUser(e.target.value)} />
          </Row>
          <Row
            label="كلمة مرور التطبيق (Application Password)"
            hint={
              status?.wordpress.passwordMask
                ? `المحفوظ حالياً: ${status.wordpress.passwordMask}`
                : "من ملف المستخدم في ووردبريس"
            }
          >
            <Input type="password" value={wpPass} onChange={(e) => setWpPass(e.target.value)} />
          </Row>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button
              disabled={busy === "wordpress"}
              onClick={() =>
                void save("wordpress", {
                  siteUrl: wpUrl,
                  username: wpUser,
                  appPassword: wpPass,
                })
              }
            >
              <Save className="size-4" /> حفظ وربط
            </Button>
            <Button
              variant="outline"
              disabled={busy === "test-wordpress"}
              onClick={() => void test("wordpress")}
            >
              <PlugZap className="size-4" /> اختبار الاتصال
            </Button>
            {status?.wordpress.connected ? (
              <Button variant="outline" onClick={() => void disconnect("wordpress")}>
                <Plug className="size-4" /> فصل الربط
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* البريد الصادر SMTP */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">البريد الصادر (SMTP)</CardTitle>
          <Status ok={Boolean(status?.smtp.connected)} />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Row label="خادم البريد" hint="مثال: smtp.gmail.com">
            <Input
              dir="ltr"
              className="text-right"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="smtp.example.com"
            />
          </Row>
          <Row label="المنفذ" hint="587 للتشفير STARTTLS أو 465 للتشفير الكامل">
            <Input
              dir="ltr"
              className="text-right"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
            />
          </Row>
          <Row label="اسم المستخدم">
            <Input
              dir="ltr"
              className="text-right"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
            />
          </Row>
          <Row
            label="كلمة المرور"
            hint={
              status?.smtp.passwordMask
                ? `المحفوظة حالياً: ${status.smtp.passwordMask}`
                : "كلمة مرور التطبيق من مزوّد البريد"
            }
          >
            <Input
              type="password"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              placeholder="أدخل كلمة المرور"
            />
          </Row>
          <Row label="بريد المُرسِل">
            <Input
              dir="ltr"
              className="text-right"
              value={smtpFrom}
              onChange={(e) => setSmtpFrom(e.target.value)}
              placeholder="noreply@example.com"
            />
          </Row>
          <Row label="اسم المُرسِل الظاهر">
            <Input
              value={smtpName}
              onChange={(e) => setSmtpName(e.target.value)}
              placeholder="اسم الشركة"
            />
          </Row>
          <div className="flex items-center justify-between rounded-md border bg-background p-3 md:col-span-2">
            <div>
              <p className="text-sm font-semibold">اتصال مشفّر (SSL/TLS)</p>
              <p className="text-xs text-muted-foreground">فعّله إذا كان المنفذ 465</p>
            </div>
            <Switch checked={smtpSecure} onCheckedChange={setSmtpSecure} />
          </div>
          <Row label="إرسال بريد تجريبي" hint="للتأكد من عمل الإرسال الفعلي بعد الحفظ">
            <div className="flex gap-2">
              <Input
                type="email"
                dir="ltr"
                className="text-right"
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                placeholder="you@example.com"
              />
              <Button
                variant="outline"
                disabled={!testEmailTo || busy === "test-email"}
                onClick={async () => {
                  setBusy("test-email");
                  try {
                    const r = await testEmailFn({ data: { to: testEmailTo } });
                    if (r.ok) toast.success(r.message);
                    else toast.error(r.message);
                  } catch {
                    toast.error("تعذر إرسال البريد التجريبي");
                  } finally {
                    setBusy("");
                  }
                }}
              >
                إرسال
              </Button>
            </div>
          </Row>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button
              disabled={busy === "smtp"}
              onClick={() =>
                void save("smtp", {
                  host: smtpHost,
                  port: smtpPort,
                  username: smtpUser,
                  password: smtpPass,
                  fromEmail: smtpFrom,
                  fromName: smtpName,
                  secure: smtpSecure ? "true" : "false",
                })
              }
            >
              <Save className="size-4" /> حفظ وربط
            </Button>
            <Button
              variant="outline"
              disabled={busy === "test-smtp"}
              onClick={() => void test("smtp")}
            >
              <PlugZap className="size-4" /> اختبار الاتصال
            </Button>
            {status?.smtp.connected ? (
              <Button variant="outline" onClick={() => void disconnect("smtp")}>
                <Plug className="size-4" /> فصل الربط
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
