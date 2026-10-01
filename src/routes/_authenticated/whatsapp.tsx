import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/crm/AppLayout";
import { useCrm, SOURCE_LABELS, type CustomerSource } from "@/lib/crm-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageCircle,
  Search,
  Send,
  Sparkle,
  RefreshCw,
  UserPlus,
  Link2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { getWhatsAppStatus, sendWhatsAppMessage } from "@/lib/whatsapp.functions";
import {
  classifyThreads,
  linkThreadToCustomer,
  listThreadMessages,
  listThreads,
  seedDemoInbox,
  type ThreadRow,
} from "@/lib/whatsapp-inbox.functions";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  component: WhatsAppInbox,
  head: () => ({
    meta: [
      { title: "صندوق واتساب — طواف للسياحة" },
      {
        name: "description",
        content:
          "صندوق وارد واتساب مربوط بنظام إدارة عملاء شركة السياحة: رد فوري، إنشاء عميل، وفلترة ذكية للعملاء المهتمين.",
      },
      { property: "og:title", content: "صندوق واتساب — طواف للسياحة" },
      {
        property: "og:description",
        content: "تابع محادثات واتساب وحوّل المهتمين إلى عملاء من نفس الشاشة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const INTENT_LABELS: Record<string, string> = {
  interested: "عميل مهتم",
  inquiry: "استفسار فقط",
  unknown: "غير مصنّف",
};

const STATUS_LABELS: Record<string, string> = {
  accepted: "قيد الإرسال",
  sent: "أُرسلت",
  delivered: "وصلت",
  read: "قُرئت",
  failed: "فشلت",
  received: "واردة",
};

function localPhone(phone: string) {
  return phone.startsWith("20") ? "0" + phone.slice(2) : phone;
}

function time(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function IntentBadge({ intent }: { intent: string }) {
  if (intent === "interested")
    return <Badge className="bg-metric-green/15 text-metric-green">عميل مهتم</Badge>;
  if (intent === "inquiry")
    return <Badge className="bg-metric-orange/15 text-metric-orange">استفسار فقط</Badge>;
  return <Badge variant="secondary">غير مصنّف</Badge>;
}

function WhatsAppInbox() {
  const { customers, addCustomer, currentUser, can } = useCrm();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<"all" | "interested" | "inquiry" | "unknown" | "unlinked">(
    "all",
  );
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"new" | "link" | null>(null);

  const statusFn = useServerFn(getWhatsAppStatus);
  const threadsFn = useServerFn(listThreads);
  const messagesFn = useServerFn(listThreadMessages);
  const sendFn = useServerFn(sendWhatsAppMessage);
  const classifyFn = useServerFn(classifyThreads);
  const linkFn = useServerFn(linkThreadToCustomer);
  const seedFn = useServerFn(seedDemoInbox);

  const statusQuery = useQuery({ queryKey: ["whatsapp-status"], queryFn: () => statusFn() });
  const threadsQuery = useQuery({
    queryKey: ["whatsapp-threads"],
    queryFn: () => threadsFn(),
    refetchInterval: 25000,
  });
  const threads = threadsQuery.data?.threads ?? [];

  useEffect(() => {
    if (!selected && threads.length > 0) setSelected(threads[0]!.phone);
  }, [threads, selected]);

  const messagesQuery = useQuery({
    queryKey: ["whatsapp-thread", selected],
    queryFn: () => messagesFn({ data: { phone: selected! } }),
    enabled: Boolean(selected),
    refetchInterval: 20000,
  });

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ["whatsapp-threads"] });
    void qc.invalidateQueries({ queryKey: ["whatsapp-thread"] });
  };

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      sendFn({
        data: {
          phone: selected!,
          body,
          ...(activeThread?.customer_id ? { customerId: activeThread.customer_id } : {}),
          sentBy: currentUser.name,
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        setText("");
        setError(null);
        refreshAll();
      } else setError(res.error);
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "تعذر الإرسال"),
  });

  const classifyMutation = useMutation({
    mutationFn: () => classifyFn({ data: { all: true } }),
    onSuccess: (res) => {
      if (!res.ok) setError(res.error);
      refreshAll();
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => seedFn(),
    onSuccess: () => refreshAll(),
  });

  const linkMutation = useMutation({
    mutationFn: (vars: { phone: string; customerId: string; contactName?: string }) =>
      linkFn({ data: vars }),
    onSuccess: () => {
      setDialog(null);
      refreshAll();
    },
  });

  const activeThread = threads.find((t) => t.phone === selected) ?? null;

  const customerOf = (t: ThreadRow | null) =>
    t?.customer_id ? (customers.find((c) => c.id === t.customer_id) ?? null) : null;
  const activeCustomer = customerOf(activeThread);

  const filtered = useMemo(() => {
    const q = term.trim();
    return threads.filter((t) => {
      if (filter === "unlinked" && t.customer_id) return false;
      if (filter !== "all" && filter !== "unlinked" && t.ai_intent !== filter) return false;
      if (!q) return true;
      const name = t.contact_name ?? "";
      const cust = customerOf(t)?.name ?? "";
      return (
        t.phone.includes(q) ||
        localPhone(t.phone).includes(q) ||
        name.includes(q) ||
        cust.includes(q) ||
        (t.last_message ?? "").includes(q)
      );
    });
  }, [threads, filter, term, customers]);

  const counts = {
    all: threads.length,
    interested: threads.filter((t) => t.ai_intent === "interested").length,
    inquiry: threads.filter((t) => t.ai_intent === "inquiry").length,
    unknown: threads.filter((t) => t.ai_intent === "unknown").length,
    unlinked: threads.filter((t) => !t.customer_id).length,
  };

  const connected = statusQuery.data?.connected ?? false;
  const messages = messagesQuery.data?.messages ?? [];
  const canEdit = can("customers.edit");

  return (
    <AppLayout title="صندوق واتساب" subtitle="محادثات العملاء مع فلترة ذكية وربط مباشر بالنظام">
      <div className="space-y-4">
        {!connected && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              حساب واتساب بيزنس غير مربوط بعد — الشاشة جاهزة للعمل، وبمجرد الربط ستصل الرسائل
              وتُرسل الردود فعلياً من هنا.
            </span>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          {/* قائمة المحادثات */}
          <Card className="h-fit">
            <CardContent className="space-y-3 p-3">
              <div className="relative">
                <Search className="absolute top-2.5 right-3 size-4 text-muted-foreground" />
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="ابحث برقم أو اسم أو نص رسالة…"
                  className="pr-9"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", "الكل"],
                    ["interested", "مهتمون"],
                    ["inquiry", "استفسارات"],
                    ["unknown", "غير مصنّف"],
                    ["unlinked", "غير مرتبط"],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={filter === key ? "default" : "outline"}
                    onClick={() => setFilter(key)}
                  >
                    {label} ({counts[key]})
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => classifyMutation.mutate()}
                  disabled={classifyMutation.isPending || threads.length === 0}
                >
                  <Sparkle className="size-4" />
                  {classifyMutation.isPending ? "جارِ التصنيف…" : "فلترة ذكية"}
                </Button>
                <Button size="sm" variant="ghost" onClick={refreshAll} title="تحديث">
                  <RefreshCw className="size-4" />
                </Button>
              </div>

              <div className="max-h-[540px] space-y-1.5 overflow-y-auto">
                {threadsQuery.isLoading && (
                  <p className="p-2 text-sm text-muted-foreground">جارِ التحميل…</p>
                )}
                {!threadsQuery.isLoading && threads.length === 0 && (
                  <div className="space-y-2 p-2 text-sm text-muted-foreground">
                    <p>لا توجد محادثات بعد.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => seedMutation.mutate()}
                      disabled={seedMutation.isPending}
                    >
                      إضافة محادثات تجريبية
                    </Button>
                  </div>
                )}
                {filtered.map((t) => {
                  const cust = customerOf(t);
                  const active = t.phone === selected;
                  return (
                    <button
                      key={t.phone}
                      onClick={() => {
                        setSelected(t.phone);
                        if (window.innerWidth < 1024) {
                          window.setTimeout(() => {
                            document
                              .getElementById("whatsapp-conversation")
                              ?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }, 50);
                        }
                      }}
                      className={`w-full rounded-lg border p-2.5 text-start transition ${
                        active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {cust?.name ?? t.contact_name ?? localPhone(t.phone)}
                        </span>
                        {t.unread > 0 && (
                          <Badge className="bg-metric-green text-white">{t.unread}</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {t.last_message}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <IntentBadge intent={t.ai_intent} />
                        <span className="text-[11px] text-muted-foreground" dir="ltr">
                          {time(t.last_message_at)}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {!threadsQuery.isLoading && threads.length > 0 && filtered.length === 0 && (
                  <p className="p-2 text-sm text-muted-foreground">لا توجد نتائج مطابقة.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* المحادثة */}
          <Card id="whatsapp-conversation">
            <CardContent className="space-y-4 p-4">
              {!activeThread ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  اختر محادثة من القائمة لعرض الرسائل والرد عليها.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <MessageCircle className="size-4 text-primary" />
                        <span className="font-semibold">
                          {activeCustomer?.name ??
                            activeThread.contact_name ??
                            localPhone(activeThread.phone)}
                        </span>
                        <IntentBadge intent={activeThread.ai_intent} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span dir="ltr">{localPhone(activeThread.phone)}</span>
                        {activeThread.ai_reason ? ` · ${activeThread.ai_reason}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeCustomer ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            to="/customers/$customerId"
                            params={{ customerId: activeCustomer.id }}
                          >
                            <ExternalLink className="size-4" /> ملف العميل
                          </Link>
                        </Button>
                      ) : (
                        canEdit && (
                          <>
                            <Button size="sm" onClick={() => setDialog("new")}>
                              <UserPlus className="size-4" /> إنشاء عميل
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setDialog("link")}>
                              <Link2 className="size-4" /> ربط بعميل
                            </Button>
                          </>
                        )
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => classifyFn({ data: { phone: activeThread.phone } }).then(refreshAll)}
                      >
                        <Sparkle className="size-4" /> تصنيف
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-md bg-muted/30 p-3">
                    {messagesQuery.isLoading && (
                      <p className="text-sm text-muted-foreground">جارِ التحميل…</p>
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
                              : "border bg-card text-foreground"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            <span dir="ltr">{time(m.created_at)}</span>
                            {" · "}
                            {STATUS_LABELS[m.status] ?? m.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={3}
                      placeholder="اكتب ردك على العميل…"
                    />
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <div className="flex justify-end">
                      <Button
                        onClick={() => sendMutation.mutate(text.trim())}
                        disabled={!text.trim() || sendMutation.isPending}
                      >
                        <Send className="size-4" />
                        {sendMutation.isPending ? "جارِ الإرسال…" : "إرسال"}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {activeThread && dialog === "new" && (
        <NewCustomerDialog
          thread={activeThread}
          onClose={() => setDialog(null)}
          onCreate={(data) => {
            void addCustomer({
              name: data.name,
              phone: localPhone(activeThread.phone),
              email: data.email,
              city: data.city,
              source: data.source,
              ownerId: currentUser.id,
            }).then((id) => {
              linkMutation.mutate({
                phone: activeThread.phone,
                customerId: id,
                ...(data.name ? { contactName: data.name } : {}),
              });
            });
          }}
        />
      )}

      {activeThread && dialog === "link" && (
        <Dialog open onOpenChange={() => setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ربط المحادثة بعميل موجود</DialogTitle>
            </DialogHeader>
            <Select
              onValueChange={(v) =>
                linkMutation.mutate({ phone: activeThread.phone, customerId: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر العميل" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}

function NewCustomerDialog({
  thread,
  onClose,
  onCreate,
}: {
  thread: ThreadRow;
  onClose: () => void;
  onCreate: (d: { name: string; email: string; city: string; source: CustomerSource }) => void;
}) {
  const [name, setName] = useState(thread.contact_name ?? "");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("القاهرة");
  const [source, setSource] = useState<CustomerSource>("whatsapp");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إنشاء عميل من محادثة واتساب</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">الاسم</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">رقم الموبايل</label>
            <Input value={localPhone(thread.phone)} readOnly dir="ltr" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">المدينة</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">البريد</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">مصدر العميل</label>
            <Select value={source} onValueChange={(v) => setSource(v as CustomerSource)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(SOURCE_LABELS) as [CustomerSource, string][]).map(
                  ([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button disabled={!name.trim()} onClick={() => onCreate({ name, email, city, source })}>
            حفظ العميل وربطه
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
