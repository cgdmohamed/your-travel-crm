import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, Send, AlertTriangle, CheckCircle2, Activity } from "lucide-react";
import { AppLayout } from "@/components/crm/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCrm } from "@/lib/crm-data";
import {
  getMetaCapiStatus,
  listMetaEvents,
  sendMetaEvent,
  type MetaEventRow,
} from "@/lib/meta-capi.functions";
import { Pagination, usePagination } from "@/components/crm/Pagination";

export const Route = createFileRoute("/_authenticated/marketing")({
  component: MarketingPage,
  head: () => ({
    meta: [
      { title: "تتبّع Meta — طواف للسياحة" },
      {
        name: "description",
        content: "إرسال أحداث العملاء والمبيعات إلى Meta Conversions API ومتابعة سجل الإرسال.",
      },
      { property: "og:title", content: "تتبّع Meta — طواف للسياحة" },
      {
        property: "og:description",
        content: "لوحة متابعة أحداث التحويل المرسلة إلى Meta من نظام إدارة عملاء شركة السياحة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const EVENT_LABELS: Record<string, string> = {
  Lead: "عميل محتمل",
  Purchase: "عملية شراء",
  Contact: "تواصل",
  InitiateCheckout: "بدء حجز",
  Schedule: "موعد سفر",
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  sent: { label: "تم الإرسال", cls: "bg-success/15 text-success border-success/30" },
  failed: { label: "فشل", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  not_configured: { label: "غير مضبوط", cls: "bg-muted text-muted-foreground" },
};

const money = (n: number) =>
  new Intl.NumberFormat("ar-EG-u-nu-latn", { maximumFractionDigits: 0 }).format(n);

function MarketingPage() {
  const { currentUser } = useCrm();
  const status = useServerFn(getMetaCapiStatus);
  const list = useServerFn(listMetaEvents);
  const send = useServerFn(sendMetaEvent);

  const [connected, setConnected] = useState<boolean | null>(null);
  const [rows, setRows] = useState<MetaEventRow[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [st, ev] = await Promise.all([status(), list()]);
    setConnected(st.connected);
    setRows(ev);
  }, [status, list]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const testEvent = async () => {
    setBusy(true);
    const res = await send({
      data: {
        eventName: "Lead",
        customerName: "اختبار النظام",
        phone: "01000000000",
        currency: "EGP",
        sentBy: currentUser.name,
        test: true,
      },
    });
    setBusy(false);
    toast[res.ok ? "success" : "error"](
      res.ok ? "وصل الحدث التجريبي إلى Meta" : "لم يصل الحدث — راجع البيانات المدخلة",
    );
    void refresh();
  };

  const sent = rows.filter((r) => r.status === "sent").length;
  const failed = rows.filter((r) => r.status !== "sent").length;
  const { page, setPage, pageCount, paged, total } = usePagination(rows, 8);

  return (
    <AppLayout
      title="تتبّع Meta"
      subtitle="إرسال أحداث العملاء والمبيعات إلى Meta من الخادم مباشرة (Conversions API)"
    >
      <div className="space-y-5">
        {connected === false && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              التتبّع غير مربوط بعد — الأحداث تُسجَّل محلياً فقط. بعد حفظ معرّف البكسل ورمز الوصول
              ستبدأ بالوصول إلى Meta تلقائياً.
            </span>
          </div>
        )}
        {connected === true && (
          <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
            <CheckCircle2 className="size-4 text-success" />
            <span>التتبّع مربوط ويعمل.</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">أحداث وصلت</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{money(sent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">أحداث لم تصل</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{money(failed)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 p-4">
              <Button size="sm" onClick={testEvent} disabled={busy}>
                <Send className="ms-1 size-4" /> إرسال حدث تجريبي
              </Button>
              <Button size="sm" variant="outline" onClick={() => void refresh()}>
                <RefreshCw className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-primary" /> سجل الأحداث
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                لا توجد أحداث بعد — ستظهر تلقائياً عند إضافة عميل جديد أو تسجيل دفعة.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="p-2 text-start font-medium">الحدث</th>
                        <th className="p-2 text-start font-medium">العميل</th>
                        <th className="p-2 text-start font-medium">القيمة</th>
                        <th className="p-2 text-start font-medium">الحالة</th>
                        <th className="p-2 text-start font-medium">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((r) => {
                        const st = STATUS_LABELS[r.status] ?? STATUS_LABELS["failed"]!;
                        return (
                          <tr key={r.id} className="border-b last:border-0">
                            <td className="p-2 font-medium text-foreground">
                              {EVENT_LABELS[r.event_name] ?? r.event_name}
                              {r.test_event && (
                                <span className="ms-1 text-xs text-muted-foreground">(تجريبي)</span>
                              )}
                            </td>
                            <td className="p-2">{r.customer_name ?? "—"}</td>
                            <td className="p-2">
                              {r.value != null ? (
                                <bdi>{money(Number(r.value))} ج.م</bdi>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="p-2">
                              <Badge variant="outline" className={st.cls}>
                                {st.label}
                              </Badge>
                              {r.error && (
                                <span className="ms-2 text-xs text-muted-foreground">{r.error}</span>
                              )}
                            </td>
                            <td className="p-2 text-xs text-muted-foreground">
                              <bdi>
                                {new Date(r.created_at).toLocaleString("ar-EG-u-nu-latn", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </bdi>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} pageCount={pageCount} total={total} onPage={setPage} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
