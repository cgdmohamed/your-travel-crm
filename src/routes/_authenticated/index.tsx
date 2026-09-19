import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Banknote, CalendarCheck, TrendingUp, UserPlus, ArrowUpLeft, Trophy, AlertTriangle, MessageSquarePlus } from "lucide-react";
import { AppLayout } from "@/components/crm/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BOOKING_STATUS_LABELS,
  STAGE_LABELS,
  arDate,
  money,
  monthlySales,
  num,
  useCrm,
} from "@/lib/crm-data";
import { useSettings } from "@/lib/settings";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "لوحة المؤشرات — طواف CRM" },
      {
        name: "description",
        content: "نظرة سريعة على مبيعات شركة السياحة والحجوزات والعملاء الجدد والفرص.",
      },
      { property: "og:title", content: "لوحة المؤشرات — طواف CRM" },
      {
        property: "og:description",
        content: "نظرة سريعة على مبيعات شركة السياحة والحجوزات والعملاء الجدد والفرص.",
      },
    ],
  }),
  component: Dashboard,
});

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Banknote;
  tone: "blue" | "green" | "orange" | "violet";
}) {
  const tones = {
    blue: "bg-metric-blue/10 text-metric-blue",
    green: "bg-metric-green/10 text-metric-green",
    orange: "bg-metric-orange/10 text-metric-orange",
    violet: "bg-metric-violet/10 text-metric-violet",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex min-h-32 items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-extrabold">{value}</p>
          <p className="mt-2 flex items-center gap-1 text-xs text-success"><ArrowUpLeft className="size-3" />{hint}</p>
        </div>
        <span className={`flex size-12 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const {
    scopedBookings,
    scopedCustomers,
    scopedOpportunities,
    packages,
    customerName,
    packageName,
    employeeName,
    addNote,
  } = useCrm();
  const { settings } = useSettings();

  const [noteFor, setNoteFor] = useState<{ customerId: string; ref: string } | null>(null);
  const [noteText, setNoteText] = useState("");

  // يُحسب بعد التحميل في المتصفح فقط حتى لا يختلف التاريخ بين الخادم والمتصفح
  const [todayStr, setTodayStr] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    setTodayStr(local.toISOString().slice(0, 10));
  }, []);

  const dayMs = 86400000;
  const daysLeft = (d: string) =>
    todayStr === null
      ? 0
      : Math.round(
          (new Date(d + "T00:00:00").getTime() - new Date(todayStr + "T00:00:00").getTime()) /
            dayMs,
        );

  const dueSoon =
    todayStr === null
      ? []
      : scopedBookings
          .filter((b) => b.status !== "cancelled" && b.amount - b.paid > 0)
          .map((b) => ({ b, days: daysLeft(b.travelDate) }))
          .filter(({ days }) => days >= 0 && days <= settings.travelAlertDays)
          .sort((a, b) => a.days - b.days);

  const saveNote = () => {
    if (!noteFor || !noteText.trim()) return;
    addNote(noteFor.customerId, `متابعة تحصيل للحجز ${noteFor.ref}: ${noteText.trim()}`);
    toast.success("تم تسجيل المتابعة في سجل العميل");
    setNoteText("");
    setNoteFor(null);
  };


  const active = scopedBookings.filter((b) => b.status !== "cancelled");
  const revenue = active.reduce((s, b) => s + b.amount, 0);
  const won = scopedOpportunities.filter((o) => o.stage === "won").length;
  const conversion = scopedOpportunities.length
    ? Math.round((won / scopedOpportunities.length) * 100)
    : 0;

  const salesData = monthlySales(scopedBookings);

  const topPackages = packages
    .map((p) => ({
      name: p.destination,
      value: active.filter((b) => b.packageId === p.id).reduce((s, b) => s + b.amount, 0),
    }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const chartColors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  const todayFollowUps = [...scopedOpportunities]
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))
    .slice(0, 4);

  return (
    <AppLayout title="لوحة التحكم" subtitle="نظرة شاملة على أداء الشركة اليوم">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="إجمالي المبيعات"
          value={money(revenue)}
          hint={`${num(active.length)} حجز فعّال`}
          icon={Banknote}
          tone="orange"
        />
        <Kpi
          label="عدد الحجوزات"
          value={num(scopedBookings.length)}
          hint={`${num(scopedBookings.filter((b) => b.status === "paid").length)} حجز مدفوع بالكامل`}
          icon={CalendarCheck}
          tone="blue"
        />
        <Kpi
          label="العملاء"
          value={num(scopedCustomers.length)}
          hint={`${num(scopedCustomers.filter((c) => c.source === "whatsapp").length)} عميل من واتساب`}
          icon={UserPlus}
          tone="green"
        />
        <Kpi
          label="نسبة تحويل الفرص"
          value={`${num(conversion)}٪`}
          hint={`${num(scopedOpportunities.length)} فرصة مفتوحة ومغلقة`}
          icon={TrendingUp}
          tone="violet"
        />
      </div>

      {dueSoon.length > 0 && (
        <Card className="mt-5 border-metric-orange/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-5 text-metric-orange" />
              تنبيهات: سفر قريب ومبالغ مستحقة
              <Badge variant="secondary" className="text-[11px]">{num(dueSoon.length)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dueSoon.map(({ b, days }) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-metric-orange/5 p-3"
              >
                <div className="min-w-0">
                  <Link
                    to="/customers/$customerId"
                    params={{ customerId: b.customerId }}
                    className="text-sm font-semibold hover:underline"
                  >
                    {customerName(b.customerId)}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.ref} · {packageName(b.packageId)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{arDate(b.travelDate)}</p>
                  <Badge className="mt-1 bg-metric-orange text-[11px] text-white">
                    {days === 0 ? "السفر اليوم" : `باقي ${num(days)} يوم`}
                  </Badge>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-metric-orange">{money(b.amount - b.paid)}</p>
                  <p className="text-[11px] text-muted-foreground">مستحق من {money(b.amount)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNoteText("");
                    setNoteFor({ customerId: b.customerId, ref: b.ref });
                  }}
                >
                  <MessageSquarePlus className="size-4" />
                  تسجيل متابعة
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={noteFor !== null} onOpenChange={(o) => !o && setNoteFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              تسجيل متابعة {noteFor ? `— ${customerName(noteFor.customerId)}` : ""}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            rows={4}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="مثال: تم الاتصال بالعميل ووعد بسداد المتبقي خلال يومين."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteFor(null)}>إلغاء</Button>
            <Button onClick={saveNote} disabled={!noteText.trim()}>حفظ المتابعة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="size-5 text-primary" />المبيعات خلال آخر 6 أشهر</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
                  formatter={(v: number) => money(v)}
                  contentStyle={{ direction: "rtl", borderRadius: 12 }}
                />
                <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Trophy className="size-5 text-metric-violet" />أفضل الوجهات مبيعاً</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={topPackages} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} isAnimationActive={false}>
                  {topPackages.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => money(v)}
                  contentStyle={{ direction: "rtl", borderRadius: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-2">
              {topPackages.map((p, i) => (
                <span key={p.name} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: chartColors[i % chartColors.length] }}
                  />
                  {p.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><CalendarCheck className="size-5 text-primary" />آخر الحجوزات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scopedBookings.slice(0, 4).map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 pb-3 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{customerName(b.customerId)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {packageName(b.packageId)}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">{money(b.amount)}</p>
                  <Badge variant="secondary" className="mt-1 text-[11px]">
                    {BOOKING_STATUS_LABELS[b.status]}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="size-5 text-primary" />متابعات قريبة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayFollowUps.map((o) => {
              const overdue =
                todayStr !== null &&
                o.followUpDate < todayStr &&
                o.stage !== "won" &&
                o.stage !== "lost";
              return (
                <Link
                  key={o.id}
                  to="/pipeline"
                  className="flex items-center justify-between gap-3 rounded-lg pb-3 last:pb-0 hover:bg-muted/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{o.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {customerName(o.customerId)} · {employeeName(o.ownerId)}
                    </p>
                  </div>
                  <div className="text-left">
                    <p
                      className={`text-xs ${overdue ? "font-semibold text-metric-orange" : "text-muted-foreground"}`}
                    >
                      {overdue ? "متأخرة · " : ""}
                      {arDate(o.followUpDate)}
                    </p>
                    <Badge className="mt-1 text-[11px]">{STAGE_LABELS[o.stage]}</Badge>
                  </div>
                </Link>
              );
            })}
            <Link to="/pipeline" className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
              عرض كل الفرص
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
