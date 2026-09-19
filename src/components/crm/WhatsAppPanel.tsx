import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, RefreshCw, AlertTriangle } from "lucide-react";
import {
  getWhatsAppStatus,
  listWhatsAppMessages,
  sendWhatsAppMessage,
} from "@/lib/whatsapp.functions";

const STATUS_LABELS: Record<string, string> = {
  accepted: "قيد الإرسال",
  sent: "أُرسلت",
  delivered: "وصلت",
  read: "قُرئت",
  failed: "فشلت",
  received: "واردة",
};

function time(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

const QUICK_TEMPLATES = [
  "مرحباً {name}، معك فريق خدمة العملاء. تحت أمرك في أي استفسار عن رحلتك.",
  "مرحباً {name}، نذكّرك بموعد سفرك القادم. برجاء مراجعة بيانات الحجز والمستندات المطلوبة.",
  "مرحباً {name}، تبقّى مبلغ مستحق على حجزك. يسعدنا تحديد موعد مناسب للسداد.",
];

export function WhatsAppPanel({
  customerId,
  customerName,
  phone,
  sentBy,
}: {
  customerId: string;
  customerName: string;
  phone: string;
  sentBy?: string;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const status = useServerFn(getWhatsAppStatus);
  const list = useServerFn(listWhatsAppMessages);
  const send = useServerFn(sendWhatsAppMessage);

  const statusQuery = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: () => status(),
  });

  const messagesQuery = useQuery({
    queryKey: ["whatsapp-messages", customerId],
    queryFn: () => list({ data: { customerId, phone } }),
    refetchInterval: 20000,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => send({ data: { customerId, phone, body, sentBy } }),
    onSuccess: (res) => {
      if (res.ok) {
        setText("");
        setError(null);
        void qc.invalidateQueries({ queryKey: ["whatsapp-messages", customerId] });
      } else {
        setError(res.error);
      }
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "تعذر الإرسال"),
  });

  const connected = statusQuery.data?.connected ?? false;
  const messages = messagesQuery.data?.messages ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="size-4 text-primary" /> محادثة واتساب
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "الحساب مربوط" : "الحساب غير مربوط"}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void messagesQuery.refetch()}
            title="تحديث"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connected && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              الواجهة جاهزة، لكن حساب واتساب بيزنس لم يُربط بعد. بعد الربط ستُرسل الرسائل فعلياً
              من هنا، وتظهر ردود العملاء وحالات التسليم تلقائياً.
            </span>
          </div>
        )}

        <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border bg-muted/30 p-3">
          {messagesQuery.isLoading && (
            <p className="text-sm text-muted-foreground">جارِ التحميل…</p>
          )}
          {!messagesQuery.isLoading && messages.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد رسائل بعد مع هذا العميل.</p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.direction === "out" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                  m.direction === "out"
                    ? "bg-primary/10 text-foreground"
                    : "bg-card text-foreground border"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <span dir="ltr">{time(m.created_at)}</span>
                  {" · "}
                  {STATUS_LABELS[m.status] ?? m.status}
                  {m.error ? ` · ${m.error.slice(0, 80)}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_TEMPLATES.map((t, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => setText(t.replace("{name}", customerName))}
            >
              نص جاهز {i + 1}
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="اكتب رسالتك للعميل…"
            rows={3}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              الرقم: <span dir="ltr">{phone}</span>
            </span>
            <Button
              onClick={() => sendMutation.mutate(text.trim())}
              disabled={!text.trim() || sendMutation.isPending}
            >
              <Send className="size-4" />
              {sendMutation.isPending ? "جارِ الإرسال…" : "إرسال"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
