import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Inbox,
  Plane,
  Search,
  TrendingUp,
} from "lucide-react";
import { AppLayout } from "@/components/crm/AppLayout";
import { Pagination, usePagination } from "@/components/crm/Pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  BOARD_LABELS,
  BOOKING_STATUS_LABELS,
  CABIN_LABELS,
  PAYMENT_METHOD_LABELS,
  ROOM_BASIS_LABELS,
  TICKET_STATUS_LABELS,
  arDate,
  money,
  num,
  useCrm,
  type Booking,
  type BookingStatus,
  type PaymentMethod,
} from "@/lib/crm-data";
import { useSettings } from "@/lib/settings";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "الحجوزات والمبيعات — طواف CRM" },
      { name: "description", content: "متابعة حجوزات الرحلات والمدفوعات والمبالغ المتبقية." },
      { property: "og:title", content: "الحجوزات والمبيعات — طواف CRM" },
      {
        property: "og:description",
        content: "متابعة حجوزات الرحلات والمدفوعات والمبالغ المتبقية.",
      },
    ],
  }),
  component: BookingsPage,
});

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function BookingsPage() {
  const {
    scopedBookings,
    scopedCustomers,
    packages,
    addBooking,
    setBookingStatus,
    can,
    customerName,
    packageName,
    employeeName,
    currentUser,
  } = useCrm();
  const { settings } = useSettings();

  const [status, setStatus] = useState<"all" | BookingStatus>("all");
  const [query, setQuery] = useState("");
  const [soonOnly, setSoonOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerId: scopedCustomers[0]?.id ?? "",
    packageId: packages[0]?.id ?? "",
    travelDate: "2026-11-01",
    pax: "2",
    paid: "0",
  });

  const q = query.trim().toLowerCase();
  const in30 = new Date(Date.now() + settings.soonFilterDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const list = scopedBookings.filter((b) => {
    if (status !== "all" && b.status !== status) return false;
    if (soonOnly && (b.status === "cancelled" || b.travelDate > in30 || b.travelDate < todayIso()))
      return false;
    if (!q) return true;
    return (
      b.ref.toLowerCase().includes(q) ||
      customerName(b.customerId).toLowerCase().includes(q) ||
      packageName(b.packageId).toLowerCase().includes(q)
    );
  });

  const { page, setPage, pageCount, paged, total: listTotal } = usePagination(list, settings.pageSize);

  const active = list.filter((b) => b.status !== "cancelled");
  const total = active.reduce((s, b) => s + b.amount, 0);
  const collected = active.reduce((s, b) => s + b.paid, 0);
  const collectionRate = total > 0 ? Math.round((collected / total) * 100) : 0;

  const monthlyData = useMemo(() => {
    const now = new Date();
    const points: { month: string; sales: number; collected: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const rows = scopedBookings.filter((b) => {
        const bd = new Date(b.travelDate);
        return (
          b.status !== "cancelled" &&
          bd.getFullYear() === d.getFullYear() &&
          bd.getMonth() === d.getMonth()
        );
      });
      points.push({
        month: MONTHS_AR[d.getMonth()]!,
        sales: rows.reduce((s, b) => s + b.amount, 0),
        collected: rows.reduce((s, b) => s + b.paid, 0),
      });
    }
    return points;
  }, [scopedBookings]);

  const editable = can("bookings.edit");

  const submit = () => {
    const pkg = packages.find((p) => p.id === form.packageId);
    if (!form.customerId || !pkg) {
      toast.error("اختر العميل والباقة");
      return;
    }
    const pax = Number(form.pax) || 1;
    addBooking({
      customerId: form.customerId,
      packageId: pkg.id,
      travelDate: form.travelDate,
      pax,
      amount: pkg.price * pax,
      paid: Number(form.paid) || 0,
      status: "draft",
      ownerId: currentUser.id,
    });
    setOpen(false);
    toast.success("تم إنشاء الحجز");
  };

  return (
    <AppLayout title="الحجوزات والمبيعات" subtitle="كل الحجوزات وحالة التحصيل">
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="إجمالي قيمة الحجوزات" value={money(total)} />
        <Stat label="المحصّل" value={money(collected)} />
        <Stat label="المتبقي" value={money(total - collected)} />
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">نسبة التحصيل</p>
            <p className="mt-1 text-xl font-bold">{num(collectionRate)}%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-5 text-primary" />
            المبيعات والتحصيل حسب شهر السفر
          </CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={78}
                orientation="right"
                tickFormatter={(v: number) => num(v / 1000) + "k"}
              />
              <Tooltip
                formatter={(v: number, name: string) => [
                  money(v),
                  name === "sales" ? "المبيعات" : "المحصّل",
                ]}
                contentStyle={{ direction: "rtl", borderRadius: 12 }}
              />
              <Bar dataKey="sales" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="collected" fill="var(--chart-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث برقم الحجز أو العميل أو الباقة…"
            className="ps-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="draft">مبدئي</SelectItem>
            <SelectItem value="confirmed">مؤكد</SelectItem>
            <SelectItem value="paid">مدفوع</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={soonOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setSoonOnly((v) => !v)}
        >
          <CalendarClock className="me-1.5 size-4" />
          قريب السفر ({settings.soonFilterDays} يوماً)
        </Button>
        <span className="text-xs text-muted-foreground">{num(list.length)} حجز</span>
        {editable ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="ms-auto">حجز جديد</Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>إنشاء حجز</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>العميل</Label>
                  <Select
                    value={form.customerId}
                    onValueChange={(v) => setForm({ ...form, customerId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر العميل" />
                    </SelectTrigger>
                    <SelectContent>
                      {scopedCustomers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>الباقة</Label>
                  <Select
                    value={form.packageId}
                    onValueChange={(v) => setForm({ ...form, packageId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الباقة" />
                    </SelectTrigger>
                    <SelectContent>
                      {packages.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {money(p.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1.5">
                    <Label>تاريخ السفر</Label>
                    <Input
                      type="date"
                      value={form.travelDate}
                      onChange={(e) => setForm({ ...form, travelDate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>عدد الأفراد</Label>
                    <Input
                      type="number"
                      value={form.pax}
                      onChange={(e) => setForm({ ...form, pax: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>المدفوع</Label>
                    <Input
                      type="number"
                      value={form.paid}
                      onChange={(e) => setForm({ ...form, paid: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit}>حفظ الحجز</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الرقم</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">تاريخ السفر</TableHead>
                <TableHead className="text-right">الأفراد</TableHead>
                <TableHead className="text-right">التحصيل</TableHead>
                <TableHead className="text-right">المسؤول</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    <Inbox className="mx-auto mb-2 size-8 opacity-50" />
                    لا توجد نتائج مطابقة
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((b) => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    expanded={expandedId === b.id}
                    onToggle={() => setExpandedId(expandedId === b.id ? null : b.id)}
                    editable={editable}
                  />
                ))
              )}
            </TableBody>
          </Table>
          <Pagination page={page} pageCount={pageCount} total={listTotal} onPage={setPage} />
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function BookingRow({
  booking: b,
  expanded,
  onToggle,
  editable,
}: {
  booking: Booking;
  expanded: boolean;
  onToggle: () => void;
  editable: boolean;
}) {
  const {
    customerName,
    packageName,
    employeeName,
    setBookingStatus,
    tickets,
    hotelStays,
    payments,
    opportunities,
  } = useCrm();

  const pct = b.amount > 0 ? Math.min(100, Math.round((b.paid / b.amount) * 100)) : 0;
  const cancelled = b.status === "cancelled";
  const bTickets = tickets.filter((t) => t.bookingId === b.id);
  const bHotels = hotelStays.filter((h) => h.bookingId === b.id);
  const fromOpp = opportunities.find((o) => o.bookingId === b.id);
  const bPayments = payments
    .filter((p) => p.bookingId === b.id)
    .sort((x, y) => y.date.localeCompare(x.date));

  return (
    <>
      <TableRow
        className={`cursor-pointer ${cancelled ? "opacity-55" : ""} ${expanded ? "bg-muted/40" : ""}`}
        onClick={onToggle}
      >
        <TableCell className="font-medium">
          <span dir="ltr" className="block text-right">
            {b.ref}
          </span>
          {fromOpp ? (
            <span className="mt-0.5 block max-w-40 truncate text-[11px] text-muted-foreground">
              من فرصة: {fromOpp.title}
            </span>
          ) : null}
        </TableCell>
        <TableCell>
          <Link
            to="/customers/$customerId"
            params={{ customerId: b.customerId }}
            className="font-medium hover:text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {customerName(b.customerId)}
          </Link>
          <p className="mt-0.5 max-w-48 truncate text-xs text-muted-foreground">
            {packageName(b.packageId)}
          </p>
        </TableCell>
        <TableCell>{arDate(b.travelDate)}</TableCell>
        <TableCell>{num(b.pax)}</TableCell>
        <TableCell>
          <p className="font-semibold">{money(Math.max(b.amount - b.paid, 0))}</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${pct >= 100 ? "bg-success" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{num(pct)}%</span>
          </div>
        </TableCell>
        <TableCell>{employeeName(b.ownerId)}</TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          {editable ? (
            <Select
              value={b.status}
              onValueChange={(v) => setBookingStatus(b.id, v as BookingStatus)}
            >
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">مبدئي</SelectItem>
                <SelectItem value="confirmed">مؤكد</SelectItem>
                <SelectItem value="paid">مدفوع</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="secondary">{BOOKING_STATUS_LABELS[b.status]}</Badge>
          )}
        </TableCell>
        <TableCell>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={8} className="p-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Plane className="size-4 text-primary" />
                    التذاكر ({num(bTickets.length)})
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {bTickets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا توجد تذاكر مرتبطة</p>
                  ) : (
                    bTickets.map((t) => (
                      <div key={t.id} className="rounded-md border bg-card p-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{t.passenger}</p>
                          <Badge variant="secondary">{TICKET_STATUS_LABELS[t.status]}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t.airline} {t.flightNo} · {t.route} · {CABIN_LABELS[t.cabin]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PNR: <span dir="ltr">{t.pnr}</span> · {money(t.price)}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">الفنادق ({num(bHotels.length)})</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {bHotels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا توجد فنادق مرتبطة</p>
                  ) : (
                    bHotels.map((h) => (
                      <div key={h.id} className="rounded-md border bg-card p-2 text-sm">
                        <p className="font-medium">{h.hotel} — {h.city}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {ROOM_BASIS_LABELS[h.roomBasis]} · {BOARD_LABELS[h.board]} · {num(h.rooms)} غرفة / {num(h.guests)} نزيل
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {arDate(h.checkIn)} ← {arDate(h.checkOut)} · تأكيد <span dir="ltr">{h.confirmationNo}</span>
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm">الدفعات ({num(bPayments.length)})</CardTitle>
                  {editable && !cancelled && b.paid < b.amount ? (
                    <PaymentDialog booking={b} />
                  ) : null}
                </CardHeader>
                <CardContent className="grid gap-2">
                  {bPayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا توجد دفعات مسجلة</p>
                  ) : (
                    bPayments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-md border bg-card p-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-success">{money(p.amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            {arDate(p.date)} · {PAYMENT_METHOD_LABELS[p.method]}
                            {p.reference ? ` · ${p.reference}` : ""}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">{employeeName(p.collectedBy)}</span>
                      </div>
                    ))
                  )}
                  <div className="mt-1 flex items-center justify-between border-t pt-2 text-sm">
                    <span className="text-muted-foreground">المتبقي</span>
                    <span className="font-bold">{money(Math.max(b.amount - b.paid, 0))}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function PaymentDialog({ booking: b }: { booking: Booking }) {
  const { addPayment } = useCrm();
  const [open, setOpen] = useState(false);
  const remaining = Math.max(b.amount - b.paid, 0);
  const [form, setForm] = useState({
    amount: String(remaining),
    date: todayIso(),
    method: "cash" as PaymentMethod,
    reference: "",
  });

  const submit = () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    if (amount > remaining) {
      toast.error(`المبلغ أكبر من المتبقي (${money(remaining)})`);
      return;
    }
    addPayment({
      bookingId: b.id,
      customerId: b.customerId,
      date: form.date,
      amount,
      method: form.method,
      reference: form.reference,
    });
    setOpen(false);
    toast.success("تم تسجيل الدفعة");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" onClick={(e) => e.stopPropagation()}>
          <Banknote className="me-1.5 size-4" />
          تسجيل دفعة
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>تسجيل دفعة — <span dir="ltr">{b.ref}</span></DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            المتبقي على الحجز: <span className="font-bold text-foreground">{money(remaining)}</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>المبلغ</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>طريقة الدفع</Label>
            <Select
              value={form.method}
              onValueChange={(v) => setForm({ ...form, method: v as PaymentMethod })}
            >
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
          </div>
          <div className="grid gap-1.5">
            <Label>المرجع (اختياري)</Label>
            <Input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="رقم إيصال أو عملية"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>حفظ الدفعة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
