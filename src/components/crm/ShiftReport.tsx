import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABELS, money, num, useCrm } from "@/lib/crm-data";

/* ---- الحصص اليومية ---- */

type Slot = { key: string; label: string; hint: string; from: number; to: number };

export const SHIFTS: Slot[] = [
  { key: "morning", label: "الصباحية", hint: "6ص – 12ظ", from: 6, to: 12 },
  { key: "noon", label: "الظهيرة", hint: "12ظ – 4م", from: 12, to: 16 },
  { key: "evening", label: "المسائية", hint: "4م – 9م", from: 16, to: 21 },
  { key: "night", label: "الليلية", hint: "9م – 6ص", from: 21, to: 30 },
];

function slotOf(time: string | undefined): string {
  const h = Number((time ?? "").slice(0, 2));
  if (Number.isNaN(h)) return "morning";
  if (h >= 6 && h < 12) return "morning";
  if (h >= 12 && h < 16) return "noon";
  if (h >= 16 && h < 21) return "evening";
  return "night";
}

type Period = "day" | "week" | "month";

const PERIOD_LABELS: Record<Period, string> = {
  day: "اليوم",
  week: "هذا الأسبوع",
  month: "هذا الشهر",
};

function startOf(period: Period): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "week") d.setDate(d.getDate() - 6);
  if (period === "month") d.setDate(d.getDate() - 29);
  return d;
}

function inRange(dateStr: string, from: Date): boolean {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.getTime() >= from.getTime();
}

export function ShiftReport({ ownerFilter }: { ownerFilter: string }) {
  const { bookings, payments, employees } = useCrm();
  const [period, setPeriod] = useState<Period>("month");

  const match = (id: string) => ownerFilter === "all" || id === ownerFilter;

  const data = useMemo(() => {
    const from = startOf(period);
    const bks = bookings.filter(
      (b) => b.status !== "cancelled" && match(b.ownerId) && inRange(b.createdAt, from),
    );
    const pays = payments.filter((p) => match(p.collectedBy) && inRange(p.date, from));

    const bySlot = SHIFTS.map((s) => {
      const sb = bks.filter((b) => slotOf(b.time) === s.key);
      const sp = pays.filter((p) => slotOf(p.time) === s.key);
      return {
        slot: `${s.label}`,
        hint: s.hint,
        count: sb.length,
        sales: sb.reduce((a, b) => a + b.amount, 0),
        collected: sp.reduce((a, p) => a + p.amount, 0),
        payCount: sp.length,
      };
    });

    const staff = employees
      .map((e) => {
        const eb = bks.filter((b) => b.ownerId === e.id);
        const ep = pays.filter((p) => p.collectedBy === e.id);
        const cells = SHIFTS.map((s) => ({
          key: s.key,
          count: eb.filter((b) => slotOf(b.time) === s.key).length,
          collected: ep
            .filter((p) => slotOf(p.time) === s.key)
            .reduce((a, p) => a + p.amount, 0),
        }));
        return {
          emp: e,
          cells,
          count: eb.length,
          sales: eb.reduce((a, b) => a + b.amount, 0),
          collected: ep.reduce((a, p) => a + p.amount, 0),
        };
      })
      .filter((r) => r.count > 0 || r.collected > 0)
      .sort((a, b) => b.sales - a.sales);

    const peak = [...bySlot].sort((a, b) => b.count + b.payCount - (a.count + a.payCount))[0];

    return { bySlot, staff, peak, totalCount: bks.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, payments, employees, period, ownerFilter]);

  return (
    <Card className="mb-4">
      <CardHeader className="gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">الحصص اليومية</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            المبيعات والتحصيل حسب وقت اليوم وكل موظف
          </p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <TabsTrigger key={p} value={p}>
                {PERIOD_LABELS[p]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {data.totalCount === 0 && data.staff.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            لا توجد حركة مسجّلة خلال {PERIOD_LABELS[period]}.
          </p>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {data.bySlot.map((s) => (
                <div key={s.slot} className="rounded-lg border bg-card p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{s.slot}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      <span dir="ltr">{s.hint}</span>
                    </Badge>
                  </div>
                  <p className="mt-2 text-lg font-bold">{num(s.count)} حجز</p>
                  <p className="text-xs text-muted-foreground">تحصيل {money(s.collected)}</p>
                </div>
              ))}
            </div>

            {data.peak ? (
              <p className="mb-3 text-xs text-muted-foreground">
                أنشط حصة:{" "}
                <span className="font-bold text-foreground">{data.peak.slot}</span> بـ{" "}
                {num(data.peak.count)} حجز و{num(data.peak.payCount)} عملية تحصيل
              </p>
            ) : null}

            <div className="mb-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.bySlot}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="slot" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={70} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Legend />
                  <Bar
                    dataKey="sales"
                    name="المبيعات"
                    fill="var(--chart-1)"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="collected"
                    name="المحصّل"
                    fill="var(--chart-2)"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الموظف</TableHead>
                    {SHIFTS.map((s) => (
                      <TableHead key={s.key} className="text-right">
                        {s.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">إجمالي المبيعات</TableHead>
                    <TableHead className="text-right">إجمالي التحصيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.staff.map((r) => (
                    <TableRow key={r.emp.id}>
                      <TableCell>
                        <p className="font-medium">{r.emp.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {ROLE_LABELS[r.emp.role]}
                        </p>
                      </TableCell>
                      {r.cells.map((c) => (
                        <TableCell key={c.key}>
                          <p className="text-sm font-medium">{num(c.count)} حجز</p>
                          <p className="text-xs text-muted-foreground">{money(c.collected)}</p>
                        </TableCell>
                      ))}
                      <TableCell className="font-medium">{money(r.sales)}</TableCell>
                      <TableCell>{money(r.collected)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
