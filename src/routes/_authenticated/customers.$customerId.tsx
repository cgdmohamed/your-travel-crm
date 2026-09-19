import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plane,
  BedDouble,
  Wallet,
  Paperclip,
  FileText,
  X,
  AlertTriangle,
  Phone,
  Mail,
  MessageCircle,
  Plus,
} from "lucide-react";
import { AppLayout } from "@/components/crm/AppLayout";
import { OpportunityDialog } from "@/components/crm/OpportunityDialog";
import { FileDrop, fileSize, type PickedFile } from "@/components/crm/FileDrop";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppPanel } from "@/components/crm/WhatsAppPanel";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ATTACHMENT_KIND_LABELS,
  BOARD_LABELS,
  BOOKING_STATUS_LABELS,
  CABIN_LABELS,
  PAYMENT_METHOD_LABELS,
  ROOM_BASIS_LABELS,
  SOURCE_LABELS,
  TICKET_STATUS_LABELS,
  arDate,
  STAGE_LABELS,
  money,
  num,
  useCrm,
  type AttachmentKind,
  type BoardBasis,
  type CabinClass,
  type PaymentMethod,
  type RoomBasis,
  type TicketStatus,
} from "@/lib/crm-data";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  head: () => ({
    meta: [
      { title: "ملف العميل — طواف CRM" },
      {
        name: "description",
        content: "بيانات العميل وحجوزاته وتذاكره وفنادقه وسجل التحصيل ومرفقاته.",
      },
      { property: "og:title", content: "ملف العميل — طواف CRM" },
      {
        property: "og:description",
        content: "بيانات العميل وحجوزاته وتذاكره وفنادقه وسجل التحصيل ومرفقاته.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerDetail,
});

const today = () => new Date().toISOString().slice(0, 10);

function CustomerDetail() {
  const { customerId } = Route.useParams();
  const crm = useCrm();
  const {
    customers,
    bookings,
    opportunities,
    tickets,
    hotelStays,
    payments,
    attachments,
    addNote,
    addPayment,
    addTicket,
    addHotelStay,
    addAttachment,
    removeAttachment,
    employeeName,
    packageName,
    can,
  } = crm;

  const [note, setNote] = useState("");
  const [tab, setTab] = useState("overview");
  const [dialog, setDialog] = useState<null | "ticket" | "hotel" | "payment">(null);
  const [oppOpen, setOppOpen] = useState(false);
  const [showAllTimeline, setShowAllTimeline] = useState(false);

  const customer = customers.find((c) => c.id === customerId);
  const myBookings = bookings.filter((b) => b.customerId === customerId);

  if (!customer) {
    return (
      <AppLayout title="العميل غير موجود">
        <p className="text-muted-foreground">
          لم نعثر على هذا العميل.{" "}
          <Link to="/customers" className="text-primary underline">
            العودة لقائمة العملاء
          </Link>
        </p>
      </AppLayout>
    );
  }

  const myOpps = opportunities.filter((o) => o.customerId === customer.id);
  const myTickets = tickets.filter((t) => t.customerId === customer.id);
  const myHotels = hotelStays.filter((h) => h.customerId === customer.id);
  const myPayments = payments.filter((p) => p.customerId === customer.id);
  const myFiles = attachments.filter((a) => a.customerId === customer.id);

  const spent = myBookings
    .filter((b) => b.status !== "cancelled")
    .reduce((s, b) => s + b.amount, 0);
  const due = myBookings
    .filter((b) => b.status !== "cancelled")
    .reduce((s, b) => s + Math.max(b.amount - b.paid, 0), 0);
  const collected = myPayments.reduce((s, p) => s + p.amount, 0);

  const alerts: { id: string; text: string; tab: string }[] = [];
  if (due > 0)
    alerts.push({ id: "due", text: `مستحق على العميل ${money(due)} — سجّل الدفعة`, tab: "payments" });
  const soon = myBookings.filter((b) => {
    const days = (new Date(b.travelDate).getTime() - Date.now()) / 86400000;
    return b.status !== "cancelled" && days >= 0 && days <= 7;
  });
  if (soon.length)
    alerts.push({
      id: "soon",
      text: `سفر خلال 7 أيام: ${soon.map((b) => b.ref).join("، ")}`,
      tab: "bookings",
    });
  const pendingTickets = myTickets.filter((t) => t.status === "pending");
  if (pendingTickets.length)
    alerts.push({
      id: "tk",
      text: `${num(pendingTickets.length)} تذكرة لم تُصدر بعد`,
      tab: "tickets",
    });

  const saveNote = () => {
    if (!note.trim()) return;
    addNote(customer.id, note.trim());
    setNote("");
    toast.success("تمت إضافة الملاحظة");
  };

  const timeline = useMemo(
    () =>
      [
        ...myBookings.map((b) => ({
          id: "b" + b.id,
          date: b.createdAt,
          title: `حجز ${b.ref} — ${packageName(b.packageId)}`,
          meta: `${money(b.amount)} · ${BOOKING_STATUS_LABELS[b.status]}`,
        })),
        ...myPayments.map((p) => ({
          id: "p" + p.id,
          date: p.date,
          title: `تحصيل ${money(p.amount)}`,
          meta: `${PAYMENT_METHOD_LABELS[p.method]} · ${p.reference}`,
        })),
        ...myTickets.map((t) => ({
          id: "t" + t.id,
          date: t.departDate,
          title: `تذكرة ${t.airline} ${t.flightNo} — ${t.passenger}`,
          meta: `${t.route} · ${TICKET_STATUS_LABELS[t.status]}`,
        })),
        ...myHotels.map((h) => ({
          id: "h" + h.id,
          date: h.checkIn,
          title: `فندق ${h.hotel}`,
          meta: `${h.city} · ${BOARD_LABELS[h.board]}`,
        })),
        ...myOpps.map((o) => ({
          id: "o" + o.id,
          date: o.followUpDate,
          title: `فرصة: ${o.title}`,
          meta: `${money(o.value)} · متابعة مجدولة`,
        })),
        ...customer.notes.map((n) => ({
          id: "n" + n.id,
          date: n.date,
          title: n.text,
          meta: `ملاحظة · ${n.author}`,
        })),
      ].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [myBookings, myPayments, myTickets, myHotels, myOpps, customer.notes, packageName],
  );

  const bookingRef = (id: string) => myBookings.find((b) => b.id === id)?.ref ?? "—";
  const editable = can("bookings.edit");

  const attachTo = (kind: AttachmentKind, refId: string | undefined, files: PickedFile[]) => {
    files.forEach((f) => addAttachment({ customerId: customer.id, kind, refId, ...f }));
    toast.success("تم رفع الملف");
  };

  return (
    <AppLayout title={customer.name} subtitle="ملف العميل 360">
      {/* Header summary */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-lg font-bold">{customer.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <span dir="ltr">{customer.phone}</span> · {customer.city} ·{" "}
              {SOURCE_LABELS[customer.source]} · المسؤول: {employeeName(customer.ownerId)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <a href={`https://wa.me/2${customer.phone}`} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" /> واتساب
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`tel:${customer.phone}`}>
                <Phone className="size-4" /> اتصال
              </a>
            </Button>
            {customer.email ? (
              <Button asChild size="sm" variant="outline">
                <a href={`mailto:${customer.email}`}>
                  <Mail className="size-4" /> بريد
                </a>
              </Button>
            ) : null}
            {editable ? (
              <>
                <Button size="sm" onClick={() => setDialog("ticket")}>
                  <Plus className="size-4" /> تذكرة
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDialog("hotel")}>
                  <Plus className="size-4" /> فندق
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDialog("payment")}>
                  <Plus className="size-4" /> دفعة
                </Button>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="إجمالي الإنفاق" value={money(spent)} />
        <Kpi label="المحصّل" value={money(collected)} />
        <Kpi label="المستحق" value={money(due)} highlight />
        <Kpi label="عدد الحجوزات" value={num(myBookings.length)} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="bookings">الحجوزات ({num(myBookings.length)})</TabsTrigger>
          <TabsTrigger value="tickets">التذاكر ({num(myTickets.length)})</TabsTrigger>
          <TabsTrigger value="hotels">الفنادق ({num(myHotels.length)})</TabsTrigger>
          <TabsTrigger value="payments">التحصيل ({num(myPayments.length)})</TabsTrigger>
          <TabsTrigger value="files">المرفقات ({num(myFiles.length)})</TabsTrigger>
          <TabsTrigger value="whatsapp">واتساب</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          {alerts.length ? (
            <Card>
              <CardContent className="space-y-2 p-4">
                {alerts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setTab(a.tab)}
                    className="flex w-full items-center gap-2 rounded-md bg-muted px-3 py-2 text-right text-sm hover:bg-muted/70"
                  >
                    <AlertTriangle className="size-4 shrink-0 text-primary" />
                    <span className="flex-1">{a.text}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>آخر النشاط</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(showAllTimeline ? timeline : timeline.slice(0, 6)).map((t) => (
                  <div key={t.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.meta} · {arDate(t.date)}
                      </p>
                    </div>
                  </div>
                ))}
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا يوجد نشاط مسجل</p>
                ) : null}
                {timeline.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllTimeline((v) => !v)}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {showAllTimeline ? "عرض أقل" : `عرض كل النشاط (${num(timeline.length)})`}
                  </button>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>الملاحظات والفرص</CardTitle>
                {can("pipeline.edit") ? (
                  <Button size="sm" variant="outline" onClick={() => setOppOpen(true)}>
                    إضافة فرصة
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3">
                {can("customers.edit") ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="اكتب ملاحظة عن آخر تواصل مع العميل"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <Button onClick={saveNote} size="sm">
                      إضافة ملاحظة
                    </Button>
                  </div>
                ) : null}
                {myOpps.map((o) => {
                  const linked = o.bookingId
                    ? bookings.find((b) => b.id === o.bookingId)
                    : undefined;
                  return (
                    <div key={o.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{o.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {STAGE_LABELS[o.stage]} · متابعة {arDate(o.followUpDate)}
                            {linked ? ` · حجز ${linked.ref}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold">{money(o.value)}</span>
                      </div>
                    </div>
                  );
                })}
                <Link
                  to="/pipeline"
                  className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  فتح لوحة الفرص
                </Link>
                {customer.notes.map((n) => (
                  <div key={n.id} className="rounded-lg bg-muted p-3">
                    <p className="text-sm">{n.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n.author} · {arDate(n.date)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Bookings */}
        <TabsContent value="bookings">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الرقم</TableHead>
                    <TableHead className="text-right">الباقة</TableHead>
                    <TableHead className="text-right">تاريخ السفر</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">المتبقي</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myBookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell dir="ltr" className="text-right">
                        {b.ref}
                      </TableCell>
                      <TableCell>{packageName(b.packageId)}</TableCell>
                      <TableCell>{arDate(b.travelDate)}</TableCell>
                      <TableCell>{money(b.amount)}</TableCell>
                      <TableCell className="font-semibold">
                        {money(Math.max(b.amount - b.paid, 0))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{BOOKING_STATUS_LABELS[b.status]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {myBookings.length === 0 ? (
                    <Empty cols={6} text="لا توجد حجوزات بعد" />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tickets */}
        <TabsContent value="tickets" className="space-y-4">
          <SectionHeader
            icon={<Plane className="size-4 text-primary" />}
            title="تذاكر الطيران"
            action={
              editable ? (
                <Button size="sm" onClick={() => setDialog("ticket")}>
                  <Plus className="size-4" /> إضافة تذكرة
                </Button>
              ) : null
            }
          />
          {myTickets.map((t) => (
            <Card key={t.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {t.passenger} — {t.airline} <span dir="ltr">{t.flightNo}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.route} · <span dir="ltr">{t.pnr}</span> · {CABIN_LABELS[t.cabin]} ·{" "}
                      {arDate(t.departDate)}
                      {t.returnDate ? ` — عودة ${arDate(t.returnDate)}` : ""}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold">{money(t.price)}</p>
                    <Badge variant={t.status === "issued" ? "default" : "secondary"}>
                      {TICKET_STATUS_LABELS[t.status]}
                    </Badge>
                  </div>
                </div>
                <Files
                  files={myFiles.filter((f) => f.refId === t.id)}
                  onRemove={removeAttachment}
                />
                {editable ? (
                  <FileDrop
                    compact
                    label="أرفق ملف التذكرة (PDF أو صورة)"
                    onFiles={(f) => attachTo("ticket", t.id, f)}
                  />
                ) : null}
              </CardContent>
            </Card>
          ))}
          {myTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد تذاكر مسجلة</p>
          ) : null}
        </TabsContent>

        {/* Hotels */}
        <TabsContent value="hotels" className="space-y-4">
          <SectionHeader
            icon={<BedDouble className="size-4 text-primary" />}
            title="حجوزات الفنادق"
            action={
              editable ? (
                <Button size="sm" onClick={() => setDialog("hotel")}>
                  <Plus className="size-4" /> إضافة فندق
                </Button>
              ) : null
            }
          />
          {myHotels.map((h) => (
            <Card key={h.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {h.hotel} — {h.city}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ROOM_BASIS_LABELS[h.roomBasis]} · {BOARD_LABELS[h.board]} ·{" "}
                      {num(h.rooms)} غرفة / {num(h.guests)} نزلاء · {arDate(h.checkIn)} حتى{" "}
                      {arDate(h.checkOut)} · <span dir="ltr">{h.confirmationNo}</span>
                    </p>
                  </div>
                  <p className="font-bold">{money(h.price)}</p>
                </div>
                <Files
                  files={myFiles.filter((f) => f.refId === h.id)}
                  onRemove={removeAttachment}
                />
                {editable ? (
                  <FileDrop
                    compact
                    label="أرفق تأكيد الحجز (PDF أو صورة)"
                    onFiles={(f) => attachTo("hotel", h.id, f)}
                  />
                ) : null}
              </CardContent>
            </Card>
          ))}
          {myHotels.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد حجوزات فنادق</p>
          ) : null}
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-4 text-primary" /> التحصيل من العميل
              </CardTitle>
              {editable && myBookings.length > 0 ? (
                <Button size="sm" onClick={() => setDialog("payment")}>
                  تسجيل دفعة
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الحجز</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">طريقة الدفع</TableHead>
                    <TableHead className="text-right">المرجع</TableHead>
                    <TableHead className="text-right">حصّلها</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{arDate(p.date)}</TableCell>
                      <TableCell dir="ltr" className="text-right">
                        {bookingRef(p.bookingId)}
                      </TableCell>
                      <TableCell className="font-semibold">{money(p.amount)}</TableCell>
                      <TableCell>{PAYMENT_METHOD_LABELS[p.method]}</TableCell>
                      <TableCell dir="ltr" className="text-right">
                        {p.reference}
                      </TableCell>
                      <TableCell>{employeeName(p.collectedBy)}</TableCell>
                    </TableRow>
                  ))}
                  {myPayments.length === 0 ? (
                    <Empty cols={6} text="لا توجد مدفوعات مسجلة" />
                  ) : null}
                </TableBody>
              </Table>
              <div className="mt-3 flex flex-wrap gap-6 text-sm">
                <span>
                  إجمالي المحصّل: <strong>{money(collected)}</strong>
                </span>
                <span>
                  المتبقي على العميل: <strong className="text-primary">{money(due)}</strong>
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Files */}
        <TabsContent value="files">
          <FilesTab
            files={myFiles}
            onRemove={removeAttachment}
            onUpload={editable ? (f) => attachTo("other", undefined, f) : undefined}
          />
        </TabsContent>

        {/* WhatsApp */}
        <TabsContent value="whatsapp">
          <WhatsAppPanel
            customerId={customer.id}
            customerName={customer.name}
            phone={customer.phone}
          />
        </TabsContent>
      </Tabs>

      {dialog === "ticket" ? (
        <TicketDialog
          bookings={myBookings.map((b) => ({ id: b.id, ref: b.ref }))}
          onClose={() => setDialog(null)}
          onSave={(t, files) => {
            addTicket({ ...t, customerId: customer.id });
            if (files.length) attachTo("ticket", undefined, files);
            setDialog(null);
            setTab("tickets");
            toast.success("تمت إضافة التذكرة");
          }}
        />
      ) : null}

      {dialog === "hotel" ? (
        <HotelDialog
          bookings={myBookings.map((b) => ({ id: b.id, ref: b.ref }))}
          onClose={() => setDialog(null)}
          onSave={(h, files) => {
            addHotelStay({ ...h, customerId: customer.id });
            if (files.length) attachTo("hotel", undefined, files);
            setDialog(null);
            setTab("hotels");
            toast.success("تمت إضافة حجز الفندق");
          }}
        />
      ) : null}

      {dialog === "payment" ? (
        <PaymentDialog
          bookings={myBookings.map((b) => ({
            id: b.id,
            ref: b.ref,
            rest: Math.max(b.amount - b.paid, 0),
          }))}
          onClose={() => setDialog(null)}
          onSave={(p, files) => {
            addPayment({ ...p, customerId: customer.id });
            if (files.length) attachTo("payment", p.bookingId, files);
            setDialog(null);
            setTab("payments");
            toast.success("تم تسجيل التحصيل");
          }}
        />
      ) : null}

      <OpportunityDialog open={oppOpen} onOpenChange={setOppOpen} customerId={customer.id} />
    </AppLayout>
  );
}

/* ---------- shared bits ---------- */

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-lg font-bold ${highlight ? "text-primary" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Empty({ cols, text }: { cols: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-6 text-center text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  );
}

function SectionHeader({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        {icon} {title}
      </h2>
      {action}
    </div>
  );
}

type Att = ReturnType<typeof useCrm>["attachments"][number];

function Files({ files, onRemove }: { files: Att[]; onRemove: (id: string) => void }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f) => (
        <FileChip key={f.id} file={f} onRemove={onRemove} />
      ))}
    </div>
  );
}

function FileChip({ file, onRemove }: { file: Att; onRemove: (id: string) => void }) {
  const isImage = file.mime.startsWith("image/");
  return (
    <div className="group relative flex w-44 items-center gap-2 rounded-lg border bg-card p-2">
      <a
        href={file.dataUrl}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        {isImage ? (
          <img src={file.dataUrl} alt={file.name} className="size-9 rounded object-cover" />
        ) : (
          <span className="flex size-9 items-center justify-center rounded bg-muted">
            <FileText className="size-4 text-primary" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{file.name}</span>
          <span className="block text-[11px] text-muted-foreground">{fileSize(file.size)}</span>
        </span>
      </a>
      <button
        type="button"
        onClick={() => onRemove(file.id)}
        className="absolute -left-2 -top-2 hidden size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
        aria-label="حذف المرفق"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

function FilesTab({
  files,
  onRemove,
  onUpload,
}: {
  files: Att[];
  onRemove: (id: string) => void;
  onUpload?: ((f: PickedFile[]) => void) | undefined;
}) {
  const [filter, setFilter] = useState<"all" | AttachmentKind>("all");
  const shown = filter === "all" ? files : files.filter((f) => f.kind === filter);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="size-4 text-primary" /> مرفقات العميل
        </CardTitle>
        <Select value={filter} onValueChange={(v) => setFilter(v as "all" | AttachmentKind)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المرفقات</SelectItem>
            {Object.entries(ATTACHMENT_KIND_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {onUpload ? <FileDrop onFiles={onUpload} label="اسحب الملفات هنا (PDF أو صور) أو اضغط للاختيار" /> : null}
        {shown.length ? (
          <div className="flex flex-wrap gap-3">
            {shown.map((f) => (
              <div key={f.id} className="space-y-1">
                <FileChip file={f} onRemove={onRemove} />
                <p className="px-1 text-[11px] text-muted-foreground">
                  {ATTACHMENT_KIND_LABELS[f.kind]} · {arDate(f.uploadedAt)} · {f.uploadedBy}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">لا توجد مرفقات</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- dialogs ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function TicketDialog({
  bookings,
  onClose,
  onSave,
}: {
  bookings: { id: string; ref: string }[];
  onClose: () => void;
  onSave: (
    t: {
      bookingId: string;
      passenger: string;
      airline: string;
      flightNo: string;
      route: string;
      departDate: string;
      returnDate?: string | undefined;
      pnr: string;
      cabin: CabinClass;
      price: number;
      status: TicketStatus;
    },
    files: PickedFile[],
  ) => void;
}) {
  const [f, setF] = useState({
    bookingId: bookings[0]?.id ?? "",
    passenger: "",
    airline: "",
    flightNo: "",
    route: "",
    departDate: today(),
    returnDate: "",
    pnr: "",
    cabin: "economy" as CabinClass,
    price: "",
    status: "issued" as TicketStatus,
  });
  const [files, setFiles] = useState<PickedFile[]>([]);

  const submit = () => {
    if (!f.bookingId || !f.passenger.trim() || !f.airline.trim()) {
      toast.error("اختر الحجز واكتب اسم المسافر وشركة الطيران");
      return;
    }
    onSave(
      {
        bookingId: f.bookingId,
        passenger: f.passenger.trim(),
        airline: f.airline.trim(),
        flightNo: f.flightNo.trim() || "—",
        route: f.route.trim() || "—",
        departDate: f.departDate,
        returnDate: f.returnDate || undefined,
        pnr: f.pnr.trim() || "—",
        cabin: f.cabin,
        price: Number(f.price) || 0,
        status: f.status,
      },
      files,
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة تذكرة طيران</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="الحجز">
            <Select value={f.bookingId} onValueChange={(v) => setF({ ...f, bookingId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الحجز" />
              </SelectTrigger>
              <SelectContent>
                {bookings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.ref}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم المسافر">
              <Input value={f.passenger} onChange={(e) => setF({ ...f, passenger: e.target.value })} />
            </Field>
            <Field label="شركة الطيران">
              <Input value={f.airline} onChange={(e) => setF({ ...f, airline: e.target.value })} />
            </Field>
            <Field label="رقم الرحلة">
              <Input dir="ltr" value={f.flightNo} onChange={(e) => setF({ ...f, flightNo: e.target.value })} />
            </Field>
            <Field label="خط السير">
              <Input value={f.route} onChange={(e) => setF({ ...f, route: e.target.value })} />
            </Field>
            <Field label="تاريخ المغادرة">
              <Input type="date" value={f.departDate} onChange={(e) => setF({ ...f, departDate: e.target.value })} />
            </Field>
            <Field label="تاريخ العودة">
              <Input type="date" value={f.returnDate} onChange={(e) => setF({ ...f, returnDate: e.target.value })} />
            </Field>
            <Field label="PNR">
              <Input dir="ltr" value={f.pnr} onChange={(e) => setF({ ...f, pnr: e.target.value })} />
            </Field>
            <Field label="السعر">
              <Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
            </Field>
            <Field label="الدرجة">
              <Select value={f.cabin} onValueChange={(v) => setF({ ...f, cabin: v as CabinClass })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CABIN_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="الحالة">
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as TicketStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TICKET_STATUS_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <UploadField files={files} setFiles={setFiles} label="ارفع ملف التذكرة (PDF أو صورة)" />
        </div>
        <DialogFooter>
          <Button onClick={submit}>حفظ التذكرة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HotelDialog({
  bookings,
  onClose,
  onSave,
}: {
  bookings: { id: string; ref: string }[];
  onClose: () => void;
  onSave: (
    h: {
      bookingId: string;
      hotel: string;
      city: string;
      roomBasis: RoomBasis;
      board: BoardBasis;
      checkIn: string;
      checkOut: string;
      rooms: number;
      guests: number;
      confirmationNo: string;
      price: number;
    },
    files: PickedFile[],
  ) => void;
}) {
  const [f, setF] = useState({
    bookingId: bookings[0]?.id ?? "",
    hotel: "",
    city: "",
    roomBasis: "double" as RoomBasis,
    board: "bb" as BoardBasis,
    checkIn: today(),
    checkOut: today(),
    rooms: "1",
    guests: "2",
    confirmationNo: "",
    price: "",
  });
  const [files, setFiles] = useState<PickedFile[]>([]);

  const submit = () => {
    if (!f.bookingId || !f.hotel.trim()) {
      toast.error("اختر الحجز واكتب اسم الفندق");
      return;
    }
    onSave(
      {
        bookingId: f.bookingId,
        hotel: f.hotel.trim(),
        city: f.city.trim() || "—",
        roomBasis: f.roomBasis,
        board: f.board,
        checkIn: f.checkIn,
        checkOut: f.checkOut,
        rooms: Number(f.rooms) || 1,
        guests: Number(f.guests) || 1,
        confirmationNo: f.confirmationNo.trim() || "—",
        price: Number(f.price) || 0,
      },
      files,
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة حجز فندق</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="الحجز">
            <Select value={f.bookingId} onValueChange={(v) => setF({ ...f, bookingId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الحجز" />
              </SelectTrigger>
              <SelectContent>
                {bookings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.ref}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم الفندق">
              <Input value={f.hotel} onChange={(e) => setF({ ...f, hotel: e.target.value })} />
            </Field>
            <Field label="المدينة">
              <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
            </Field>
            <Field label="نوع الغرفة">
              <Select value={f.roomBasis} onValueChange={(v) => setF({ ...f, roomBasis: v as RoomBasis })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROOM_BASIS_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="نظام الإقامة">
              <Select value={f.board} onValueChange={(v) => setF({ ...f, board: v as BoardBasis })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BOARD_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="تاريخ الدخول">
              <Input type="date" value={f.checkIn} onChange={(e) => setF({ ...f, checkIn: e.target.value })} />
            </Field>
            <Field label="تاريخ المغادرة">
              <Input type="date" value={f.checkOut} onChange={(e) => setF({ ...f, checkOut: e.target.value })} />
            </Field>
            <Field label="عدد الغرف">
              <Input type="number" value={f.rooms} onChange={(e) => setF({ ...f, rooms: e.target.value })} />
            </Field>
            <Field label="عدد النزلاء">
              <Input type="number" value={f.guests} onChange={(e) => setF({ ...f, guests: e.target.value })} />
            </Field>
            <Field label="رقم التأكيد">
              <Input dir="ltr" value={f.confirmationNo} onChange={(e) => setF({ ...f, confirmationNo: e.target.value })} />
            </Field>
            <Field label="السعر">
              <Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
            </Field>
          </div>
          <UploadField files={files} setFiles={setFiles} label="ارفع تأكيد الحجز (PDF أو صورة)" />
        </div>
        <DialogFooter>
          <Button onClick={submit}>حفظ حجز الفندق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  bookings,
  onClose,
  onSave,
}: {
  bookings: { id: string; ref: string; rest: number }[];
  onClose: () => void;
  onSave: (
    p: {
      bookingId: string;
      date: string;
      amount: number;
      method: PaymentMethod;
      reference: string;
    },
    files: PickedFile[],
  ) => void;
}) {
  const [f, setF] = useState({
    bookingId: bookings[0]?.id ?? "",
    amount: "",
    method: "cash" as PaymentMethod,
    reference: "",
    date: today(),
  });
  const [files, setFiles] = useState<PickedFile[]>([]);

  const submit = () => {
    const amount = Number(f.amount);
    if (!f.bookingId || !amount || amount <= 0) {
      toast.error("اختر الحجز وأدخل مبلغاً صحيحاً");
      return;
    }
    onSave(
      {
        bookingId: f.bookingId,
        date: f.date,
        amount,
        method: f.method,
        reference: f.reference.trim() || "—",
      },
      files,
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تسجيل تحصيل جديد</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="الحجز">
            <Select value={f.bookingId} onValueChange={(v) => setF({ ...f, bookingId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الحجز" />
              </SelectTrigger>
              <SelectContent>
                {bookings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.ref} — متبقي {money(b.rest)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="المبلغ">
              <Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
            </Field>
            <Field label="التاريخ">
              <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </Field>
            <Field label="طريقة الدفع">
              <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v as PaymentMethod })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="رقم الإيصال / المرجع">
              <Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
            </Field>
          </div>
          <UploadField files={files} setFiles={setFiles} label="ارفع صورة الإيصال (PDF أو صورة)" />
        </div>
        <DialogFooter>
          <Button onClick={submit}>حفظ التحصيل</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadField({
  files,
  setFiles,
  label,
}: {
  files: PickedFile[];
  setFiles: (f: PickedFile[]) => void;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <FileDrop compact label={label} onFiles={(f) => setFiles([...files, ...f])} />
      {files.length ? (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span
              key={f.name + i}
              className="flex items-center gap-2 rounded-md border bg-card px-2 py-1 text-xs"
            >
              <FileText className="size-3 text-primary" />
              <span className="max-w-32 truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                aria-label="إزالة"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
