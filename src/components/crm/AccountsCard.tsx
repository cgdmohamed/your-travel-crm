import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Loader2, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  listAccounts,
  createAccount,
  deleteAccount,
  setAccountRole,
  resetAccountPassword,
  type AccountRow,
} from "@/lib/accounts.functions";

const ROLES: Record<string, string> = {
  admin: "مدير الشركة",
  sales_manager: "مدير مبيعات",
  agent: "موظف مبيعات",
  accountant: "محاسب",
};

export function AccountsCard() {
  const listFn = useServerFn(listAccounts);
  const createFn = useServerFn(createAccount);
  const deleteFn = useServerFn(deleteAccount);
  const roleFn = useServerFn(setAccountRole);
  const resetPasswordFn = useServerFn(resetAccountPassword);

  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("agent");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listFn({}));
      setDenied(false);
    } catch {
      setDenied(true);
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await createFn({
        data: {
          email: email.trim(),
          fullName: fullName.trim(),
          password,
          role: role as "admin" | "sales_manager" | "agent" | "accountant",
        },
      });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(r.message);
      setOpen(false);
      setEmail("");
      setFullName("");
      setPassword("");
      setRole("agent");
      await load();
    } catch {
      toast.error("تعذر إنشاء الحساب");
    } finally {
      setBusy(false);
    }
  };

  if (denied) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">حسابات الدخول</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            إدارة حسابات الدخول متاحة لمدير الشركة فقط.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">حسابات الدخول</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="size-4" /> تحديث
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="size-4" /> حساب جديد
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>إنشاء حساب دخول لموظف</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">الاسم الكامل</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    dir="ltr"
                    className="text-right"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">كلمة المرور المبدئية</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8 أحرف على الأقل"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">الدور</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => void submit()} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} إنشاء الحساب
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">جارِ التحميل…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد حسابات بعد.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{r.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">
                    {r.email}
                  </p>
                </div>
                {!r.active ? <Badge variant="outline">معطّل</Badge> : null}
                <Select
                  value={r.role}
                  onValueChange={(v) => {
                    void roleFn({
                      data: {
                        id: r.id,
                        role: v as "admin" | "sales_manager" | "agent" | "accountant",
                      },
                    })
                      .then((res) => {
                        if (res.ok) toast.success(res.message);
                        else toast.error(res.message);
                        return load();
                      })
                      .catch(() => toast.error("تعذر تحديث الدور"));
                  }}
                >
                  <SelectTrigger className="h-9 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  title="إعادة تعيين كلمة المرور"
                  onClick={() => {
                    const newPassword = window.prompt("كلمة المرور الجديدة (8 أحرف على الأقل)");
                    if (!newPassword) return;
                    void resetPasswordFn({ data: { id: r.id, newPassword } })
                      .then((res) => {
                        if (res.ok) toast.success(res.message);
                        else toast.error(res.message);
                      })
                      .catch(() => toast.error("تعذر إعادة تعيين كلمة المرور"));
                  }}
                >
                  <KeyRound className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="تعطيل الحساب"
                  onClick={() => {
                    void deleteFn({ data: { id: r.id } })
                      .then((res) => {
                        if (res.ok) toast.success(res.message);
                        else toast.error(res.message);
                        return load();
                      })
                      .catch(() => toast.error("تعذر تعطيل الحساب"));
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
