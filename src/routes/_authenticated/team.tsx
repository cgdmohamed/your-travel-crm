import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/crm/AppLayout";
import { Pagination, usePagination } from "@/components/crm/Pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { resetAccountPassword } from "@/lib/accounts.functions";
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
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  effectivePermissions,
  money,
  num,
  useCrm,
  type Permission,
  type Role,
} from "@/lib/crm-data";
import { useSettings } from "@/lib/settings";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "الموظفون والصلاحيات — طواف CRM" },
      { name: "description", content: "إدارة موظفي شركة السياحة وأدوارهم وصلاحياتهم." },
      { property: "og:title", content: "الموظفون والصلاحيات — طواف CRM" },
      { property: "og:description", content: "إدارة موظفي شركة السياحة وأدوارهم وصلاحياتهم." },
    ],
  }),
  component: TeamPage,
});


function TeamPage() {
  const { employees, bookings, addEmployee, updateEmployee, can } = useCrm();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [permsFor, setPermsFor] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "agent" as Role,
    active: true,
  });

  const editable = can("team.edit");
  const { page, setPage, pageCount, paged, total: teamTotal } = usePagination(employees, settings.pageSize);

  const stats = (id: string) => {
    const rows = bookings.filter((b) => b.ownerId === id && b.status !== "cancelled");
    return { count: rows.length, total: rows.reduce((s, b) => s + b.amount, 0) };
  };

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("الاسم والبريد مطلوبان");
      return;
    }
    if (form.password.trim().length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    try {
      await addEmployee(form);
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "agent", active: true });
      toast.success("تمت إضافة الموظف");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر إضافة الموظف");
    }
  };

  return (
    <AppLayout title="الموظفون والصلاحيات" subtitle="أدوار الفريق ونطاق ما يراه كل موظف">
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
          <Card key={r}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-bold">{ROLE_LABELS[r]}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {num(ROLE_PERMISSIONS[r].length)} صلاحيات
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {num(employees.filter((e) => e.role === r).length)} موظف
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {editable ? (
        <div className="mb-4 flex">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="ms-auto">إضافة موظف</Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>موظف جديد</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>الاسم</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    dir="ltr"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>كلمة المرور (لحساب الدخول)</Label>
                  <Input
                    dir="ltr"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="8 أحرف على الأقل"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>الدور</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit}>حفظ الموظف</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الموظف</TableHead>
                <TableHead className="text-right">البريد</TableHead>
                <TableHead className="text-right">الدور</TableHead>
                <TableHead className="text-right">الصلاحيات</TableHead>
                <TableHead className="text-right">الحجوزات</TableHead>
                <TableHead className="text-right">المبيعات المحققة</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                {editable ? <TableHead className="text-right">إجراءات</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((e) => {
                const s = stats(e.id);
                const perms = effectivePermissions(e);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell dir="ltr" className="text-right">
                      {e.email}
                    </TableCell>
                    <TableCell>
                      {editable ? (
                        <Select
                          value={e.role}
                          onValueChange={(v) =>
                            updateEmployee(e.id, { role: v as Role, permissions: undefined })
                          }
                        >
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{ROLE_LABELS[e.role]}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={e.permissions ? "default" : "secondary"}>
                          {num(perms.length)} صلاحية
                        </Badge>
                        {editable ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => setPermsFor(e.id)}
                          >
                            تعديل
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{num(s.count)}</TableCell>
                    <TableCell>{money(s.total)}</TableCell>
                    <TableCell>
                      {editable ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={e.active}
                            onCheckedChange={(v) => updateEmployee(e.id, { active: v })}
                          />
                          <span className="text-xs text-muted-foreground">
                            {e.active ? "نشط" : "موقوف"}
                          </span>
                        </div>
                      ) : (
                        <Badge variant={e.active ? "default" : "outline"}>
                          {e.active ? "نشط" : "موقوف"}
                        </Badge>
                      )}
                    </TableCell>
                    {editable ? (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-[11px]"
                          onClick={() => setResetFor(e.id)}
                        >
                          <KeyRound className="size-3.5" /> إعادة تعيين كلمة المرور
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination page={page} pageCount={pageCount} total={teamTotal} onPage={setPage} />
        </CardContent>
      </Card>

      <PermissionsDialog employeeId={permsFor} onClose={() => setPermsFor(null)} />
      <ResetPasswordDialog employeeId={resetFor} onClose={() => setResetFor(null)} />
    </AppLayout>
  );
}

function ResetPasswordDialog({
  employeeId,
  onClose,
}: {
  employeeId: string | null;
  onClose: () => void;
}) {
  const { employees } = useCrm();
  const emp = employees.find((e) => e.id === employeeId) ?? null;
  const resetFn = useServerFn(resetAccountPassword);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!emp) return;
    if (newPassword.trim().length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    setBusy(true);
    const r = await resetFn({ data: { id: emp.id, newPassword: newPassword.trim() } }).catch(() => ({
      ok: false as const,
      message: "تعذر تعيين كلمة المرور",
    }));
    setBusy(false);
    if (!r.ok) {
      toast.error(r.message);
      return;
    }
    toast.success(r.message);
    setNewPassword("");
    onClose();
  };

  return (
    <Dialog open={!!emp} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>تعيين كلمة مرور جديدة — {emp?.name ?? ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            سيتم تسجيل خروج {emp?.name ?? "الموظف"} من كل الأجهزة فورًا، ويحتاج تسجيل الدخول
            مجددًا بكلمة المرور الجديدة.
          </p>
          <div className="space-y-1.5">
            <Label>كلمة المرور الجديدة</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="8 أحرف على الأقل"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null} تعيين كلمة المرور
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermissionsDialog({
  employeeId,
  onClose,
}: {
  employeeId: string | null;
  onClose: () => void;
}) {
  const { employees, updateEmployee } = useCrm();
  const emp = employees.find((e) => e.id === employeeId) ?? null;
  const [key, setKey] = useState("");
  const [sel, setSel] = useState<Permission[]>([]);

  if (emp && key !== emp.id) {
    setKey(emp.id);
    setSel(effectivePermissions(emp));
  }

  const toggle = (p: Permission, on: boolean) =>
    setSel((prev) => (on ? [...new Set([...prev, p])] : prev.filter((x) => x !== p)));

  const save = () => {
    if (!emp) return;
    updateEmployee(emp.id, { permissions: sel });
    toast.success(`تم تحديث صلاحيات ${emp.name}`);
    onClose();
  };

  const reset = () => {
    if (!emp) return;
    updateEmployee(emp.id, { permissions: undefined });
    toast.success("تمت إعادة الصلاحيات لصلاحيات الدور");
    onClose();
  };

  return (
    <Dialog open={!!emp} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>صلاحيات {emp?.name ?? ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {PERMISSION_GROUPS.map((g) => (
            <div key={g.title} className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-bold">{g.title}</p>
              <div className="space-y-2">
                {g.items.map((p) => (
                  <div key={p} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{PERMISSION_LABELS[p]}</span>
                    <Switch
                      checked={sel.includes(p)}
                      onCheckedChange={(v) => toggle(p, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            «عرض تقارير كل الفريق» يتيح للموظف رؤية بيانات وحجوزات باقي الموظفين.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={reset}>
            إعادة لصلاحيات الدور
          </Button>
          <Button onClick={save}>حفظ الصلاحيات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
