import { createFileRoute } from "@tanstack/react-router";
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
import { AppLayout } from "@/components/crm/AppLayout";
import { Pagination, usePagination } from "@/components/crm/Pagination";
import { ShiftReport } from "@/components/crm/ShiftReport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { ROLE_LABELS, arDate, money, num, useCrm } from "@/lib/crm-data";
import { useSettings } from "@/lib/settings";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "التقارير وأداء الموظفين — طواف CRM" },
      {
        name: "description",
        content: "تقارير المبيعات والتحصيل وأداء كل موظف في شركة السياحة.",
      },
      { property: "og:title", content: "التقارير وأداء الموظفين — طواف CRM" },
      {
        property: "og:description",
        content: "تقارير المبيعات والتحصيل وأداء كل موظف في شركة السياحة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

const MONTHS = 6;

function monthKeys() {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("ar-EG-u-nu-latn", { month: "short" }).format(d),
    });
  }
  return out;
}

function ReportsPage() {
  const { bookings, customers, payments, opportunities, employees, can, currentUser } = useCrm();
  const { settings } = useSettings();
  const seesAll = can("reports.all");
  const [owner, setOwner] = useState<string>("all");

  const scopedEmployees = useMemo(
    () => (seesAll ? employees : employees.filter((e) => e.id === currentUser.id)),
    [employees, seesAll, currentUser.id],
  );

  const filterOwner = seesAll ? owner : currentUser.id;
  const match = (id: string) => filterOwner === "all" || id === filterOwner;

  const rows = bookings.filter((b) => match(b.ownerId) && b.status !== "cancelled");
  const sales = rows.reduce((s, b) => s + b.amount, 0);
  const collected = rows.reduce((s, b) => s + b.paid, 0);
  const due = sales - collected;
  const ratio = sales > 0 ? Math.round((collected / sales) * 100) : 0;
  const avg = rows.length > 0 ? Math.round(sales / rows.length) : 0;

  const months = monthKeys();
  const chart = months.map((m) => {
    const mb = rows.filter((b) => b.createdAt.startsWith(m.key));
    const mp = payments.filter((p) => match(p.collectedBy) && p.date.startsWith(m.key));
    return {
      month: m.label,
      sales: mb.reduce((s, b) => s + b.amount, 0),
      collected: mp.reduce((s, p) => s + p.amount, 0),
    };
  });

  const perEmployee = scopedEmployees.map((e) => {
    const eb = bookings.filter((b) => b.ownerId === e.id && b.status !== "cancelled");
    const eSales = eb.reduce((s, b) => s + b.amount, 0);
    const eCollected = eb.reduce((s, b) => s + b.paid, 0);
    const eOpps = opportunities.filter((o) => o.ownerId === e.id);
    const won = eOpps.filter((o) => o.stage === "won").length;
    const lost = eOpps.filter((o) => o.stage === "lost").length;
    const closed = won + lost;
    return {
      emp: e,
      customers: customers.filter((c) => c.ownerId === e.id).length,
      bookings: eb.length,
      sales: eSales,
      collected: eCollected,
      due: eSales - eCollected,
      opps: eOpps.length,
      won,
      conversion: closed > 0 ? Math.round((won / closed) * 100) : 0,
      avg: eb.length > 0 ? Math.round(eSales / eb.length) : 0,
    };
  });

  const ranked = [...perEmployee].sort((a, b) => b.sales - a.sales);
  const best = ranked[0];
  const { page, setPage, pageCount, paged, total: rankedTotal } = usePagination(ranked, settings.pageSize);

  const recent = [...payments]
    .filter((p) => match(p.collectedBy))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  const kpis = [
    { label: "إجمالي المبيعات", value: money(sales) },
    { label: "المحصّل", value: money(collected) },
    { label: "المتبقي", value: money(due) },
    { label: "متوسط قيمة الحجز", value: money(avg) },
  ];

  return (
    <AppLayout title="التقارير" subtitle="أداء المبيعات والتحصيل لكل موظف">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {seesAll ? (
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الموظفين</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="secondary">تقاريرك الشخصية فقط</Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {num(rows.length)} حجز ضمن النطاق المحدد
        </span>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="mt-1 text-xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            نسبة التحصيل: {num(ratio)}٪
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={ratio} className="h-2" />
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">المبيعات والتحصيل خلال {num(MONTHS)} أشهر</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
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
        </CardContent>
      </Card>

      <ShiftReport ownerFilter={filterOwner} />

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">أداء الموظفين</CardTitle>
        </CardHeader>
        <CardContent>
          {best ? (
            <p className="mb-3 text-xs text-muted-foreground">
              الأعلى مبيعاً: <span className="font-bold text-foreground">{best.emp.name}</span> بـ{" "}
              {money(best.sales)}
            </p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الموظف</TableHead>
                <TableHead className="text-right">العملاء</TableHead>
                <TableHead className="text-right">الحجوزات</TableHead>
                <TableHead className="text-right">المبيعات</TableHead>
                <TableHead className="text-right">المحصّل</TableHead>
                <TableHead className="text-right">المتبقي</TableHead>
                <TableHead className="text-right">الفرص</TableHead>
                <TableHead className="text-right">معدل التحويل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((r) => (
                <TableRow key={r.emp.id}>
                  <TableCell>
                    <p className="font-medium">{r.emp.name}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABELS[r.emp.role]}</p>
                  </TableCell>
                  <TableCell>{num(r.customers)}</TableCell>
                  <TableCell>{num(r.bookings)}</TableCell>
                  <TableCell className="font-medium">{money(r.sales)}</TableCell>
                  <TableCell>{money(r.collected)}</TableCell>
                  <TableCell>{money(r.due)}</TableCell>
                  <TableCell>
                    {num(r.won)} / {num(r.opps)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={r.conversion} className="h-1.5 w-16" />
                      <span className="text-xs">{num(r.conversion)}٪</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageCount={pageCount} total={rankedTotal} onPage={setPage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">آخر عمليات التحصيل</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد عمليات تحصيل بعد.</p>
          ) : (
            <ul className="divide-y">
              {recent.map((p) => {
                const c = customers.find((x) => x.id === p.customerId);
                const by = employees.find((e) => e.id === p.collectedBy);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{c?.name ?? "عميل"}</p>
                      <p className="text-xs text-muted-foreground">
                        {arDate(p.date)} · حصّلها {by?.name ?? "—"}
                      </p>
                    </div>
                    <span className="text-sm font-bold">{money(p.amount)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
