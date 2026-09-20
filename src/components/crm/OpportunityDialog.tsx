import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { SOURCE_LABELS, useCrm, type CustomerSource } from "@/lib/crm-data";

const today = () => new Date().toISOString().slice(0, 10);

export function OpportunityDialog({
  open,
  onOpenChange,
  customerId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId?: string | undefined;
}) {
  const { customers, packages, employees, addOpportunity, addCustomer, currentUser } = useCrm();
  const [mode, setMode] = useState<"existing" | "new">(customerId ? "existing" : "existing");
  const [form, setForm] = useState({
    customerId: customerId ?? "",
    newName: "",
    newPhone: "",
    packageId: "",
    title: "",
    pax: 2,
    value: 0,
    source: "whatsapp" as CustomerSource,
    followUpDate: today(),
    ownerId: currentUser.id,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const pickPackage = (pid: string) => {
    const pkg = packages.find((p) => p.id === pid);
    setForm((f) => ({
      ...f,
      packageId: pid,
      value: pkg ? pkg.price * f.pax : f.value,
      title: f.title || (pkg ? `${pkg.name} — ${f.pax} أفراد` : f.title),
    }));
  };

  const pickPax = (pax: number) => {
    const pkg = packages.find((p) => p.id === form.packageId);
    setForm((f) => ({ ...f, pax, value: pkg ? pkg.price * pax : f.value }));
  };

  const submit = async () => {
    let cid = form.customerId;
    if (mode === "new") {
      if (!form.newName.trim() || !form.newPhone.trim()) {
        toast.error("أدخل اسم العميل ورقم الجوال");
        return;
      }
      cid = await addCustomer({
        name: form.newName.trim(),
        phone: form.newPhone.trim(),
        email: "",
        city: "",
        source: form.source,
        ownerId: form.ownerId,
      });
    }
    if (!cid || !form.packageId || !form.title.trim()) {
      toast.error("أكمل بيانات الفرصة");
      return;
    }
    await addOpportunity({
      title: form.title.trim(),
      customerId: cid,
      packageId: form.packageId,
      value: form.value,
      stage: "new",
      ownerId: form.ownerId,
      followUpDate: form.followUpDate,
      source: form.source,
      pax: form.pax,
    });
    toast.success("تمت إضافة الفرصة");
    onOpenChange(false);
    setForm((f) => ({ ...f, title: "", packageId: "", newName: "", newPhone: "", value: 0 }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>فرصة جديدة</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {!customerId && (
            <div className="grid gap-1.5">
              <Label>العميل</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={mode === "existing" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("existing")}
                >
                  عميل حالي
                </Button>
                <Button
                  type="button"
                  variant={mode === "new" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("new")}
                >
                  عميل جديد
                </Button>
              </div>
            </div>
          )}

          {mode === "existing" ? (
            <div className="grid gap-1.5">
              <Label>اختر العميل</Label>
              <Select value={form.customerId} onValueChange={(v) => set("customerId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر العميل" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>اسم العميل</Label>
                <Input value={form.newName} onChange={(e) => set("newName", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>الجوال</Label>
                <Input
                  dir="ltr"
                  value={form.newPhone}
                  onChange={(e) => set("newPhone", e.target.value)}
                  placeholder="01012345678"
                />
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>الباقة</Label>
            <Select value={form.packageId} onValueChange={pickPackage}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الباقة" />
              </SelectTrigger>
              <SelectContent>
                {packages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>عنوان الفرصة</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>عدد الأفراد</Label>
              <Input
                type="number"
                min={1}
                value={form.pax}
                onChange={(e) => pickPax(Number(e.target.value) || 1)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>القيمة المتوقعة</Label>
              <Input
                type="number"
                value={form.value}
                onChange={(e) => set("value", Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>المصدر</Label>
              <Select
                value={form.source}
                onValueChange={(v) => set("source", v as CustomerSource)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_LABELS) as CustomerSource[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>تاريخ المتابعة</Label>
              <Input
                type="date"
                value={form.followUpDate}
                onChange={(e) => set("followUpDate", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>المسؤول</Label>
            <Select value={form.ownerId} onValueChange={(v) => set("ownerId", v)}>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={submit}>حفظ الفرصة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
