import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Globe, MessageCircle, Phone } from "lucide-react";
import { AppLayout } from "@/components/crm/AppLayout";
import { Pagination, usePagination } from "@/components/crm/Pagination";
import { Card, CardContent } from "@/components/ui/card";
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
import { SOURCE_LABELS, money, num, useCrm, type CustomerSource } from "@/lib/crm-data";
import { useSettings } from "@/lib/settings";

export const Route = createFileRoute("/_authenticated/customers/")({
  head: () => ({
    meta: [
      { title: "العملاء — طواف CRM" },
      { name: "description", content: "سجل عملاء شركة السياحة ومصادرهم وحجوزاتهم." },
      { property: "og:title", content: "العملاء — طواف CRM" },
      { property: "og:description", content: "سجل عملاء شركة السياحة ومصادرهم وحجوزاتهم." },
    ],
  }),
  component: CustomersPage,
});

const SOURCE_ICONS: Record<CustomerSource, typeof Globe> = {
  whatsapp: MessageCircle,
  website: Globe,
  direct: Phone,
};

function CustomersPage() {
  const { scopedCustomers, bookings, employees, addCustomer, can, employeeName, currentUser } =
    useCrm();
  const { settings } = useSettings();
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"all" | CustomerSource>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    source: "whatsapp" as CustomerSource,
    ownerId: currentUser.id,
  });

  const list = scopedCustomers.filter(
    (c) =>
      (source === "all" || c.source === source) &&
      (c.name.includes(q) || c.phone.includes(q) || c.city.includes(q)),
  );

  const { page, setPage, pageCount, paged, total: listTotal } = usePagination(list, settings.pageSize);

  const stats = (customerId: string) => {
    const rows = bookings.filter((b) => b.customerId === customerId && b.status !== "cancelled");
    return { count: rows.length, total: rows.reduce((s, b) => s + b.amount, 0) };
  };

  const submit = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("الاسم ورقم الجوال مطلوبان");
      return;
    }
    addCustomer(form);
    setOpen(false);
    setForm({ ...form, name: "", phone: "", email: "", city: "" });
    toast.success("تمت إضافة العميل");
  };

  return (
    <AppLayout title="العملاء" subtitle="بيانات العملاء ومصادرهم وسجل تعاملاتهم">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="ابحث بالاسم أو الجوال أو المدينة"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المصادر</SelectItem>
            <SelectItem value="whatsapp">واتساب</SelectItem>
            <SelectItem value="website">الموقع</SelectItem>
            <SelectItem value="direct">مباشر</SelectItem>
          </SelectContent>
        </Select>
        {can("customers.edit") ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="ms-auto">إضافة عميل</Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>عميل جديد</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>الاسم</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>الجوال</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>المدينة</Label>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>البريد الإلكتروني</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>المصدر</Label>
                    <Select
                      value={form.source}
                      onValueChange={(v) => setForm({ ...form, source: v as CustomerSource })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">واتساب</SelectItem>
                        <SelectItem value="website">الموقع</SelectItem>
                        <SelectItem value="direct">مباشر</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>الموظف المسؤول</Label>
                    <Select
                      value={form.ownerId}
                      onValueChange={(v) => setForm({ ...form, ownerId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {employees
                          .filter((e) => e.active)
                          .map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit}>حفظ العميل</Button>
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
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">المصدر</TableHead>
                <TableHead className="text-right">المسؤول</TableHead>
                <TableHead className="text-right">الحجوزات</TableHead>
                <TableHead className="text-right">إجمالي الإنفاق</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((c) => {
                const s = stats(c.id);
                const SourceIcon = SOURCE_ICONS[c.source];
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        to="/customers/$customerId"
                        params={{ customerId: c.id }}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {c.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span dir="ltr">{c.phone}</span> · {c.city}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span
                        title={SOURCE_LABELS[c.source]}
                        className="inline-flex size-8 items-center justify-center rounded-md bg-secondary text-muted-foreground"
                      >
                        <SourceIcon className="size-4" />
                      </span>
                    </TableCell>
                    <TableCell>{employeeName(c.ownerId)}</TableCell>
                    <TableCell>{num(s.count)}</TableCell>
                    <TableCell>{money(s.total)}</TableCell>
                  </TableRow>
                );
              })}
              {list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    لا يوجد عملاء مطابقون
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <Pagination page={page} pageCount={pageCount} total={listTotal} onPage={setPage} />
        </CardContent>
      </Card>
    </AppLayout>
  );
}
