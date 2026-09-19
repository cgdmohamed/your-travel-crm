import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, CalendarPlus, Wallet, Zap, Target } from "lucide-react";
import { OpportunityDialog } from "@/components/crm/OpportunityDialog";
import {
  useCrm,
  SOURCE_LABELS,
  PAYMENT_METHOD_LABELS,
  money,
  type CustomerSource,
  type PaymentMethod,
} from "@/lib/crm-data";
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

const today = () => new Date().toISOString().slice(0, 10);

type Kind = "customer" | "booking" | "payment" | "opportunity" | null;

export function QuickActions() {
  const [open, setOpen] = useState<Kind>(null);
  const { can } = useCrm();

  const canCustomers = can("customers.edit");
  const canBookings = can("bookings.edit");
  const canPipeline = can("pipeline.edit");
  if (!canCustomers && !canBookings && !canPipeline) return null;

  return (
    <>
      <div className="flex items-center gap-1.5 rounded-lg border bg-card p-1">
        <span className="hidden items-center gap-1 px-2 text-xs font-semibold text-muted-foreground xl:flex">
          <Zap className="size-3.5 text-primary" />
          إجراء سريع
        </span>
        {canCustomers && (
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5" onClick={() => setOpen("customer")}>
            <UserPlus className="size-4 text-primary" />
            <span className="hidden sm:inline">عميل</span>
          </Button>
        )}
        {canPipeline && (
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5" onClick={() => setOpen("opportunity")}>
            <Target className="size-4 text-primary" />
            <span className="hidden sm:inline">فرصة</span>
          </Button>
        )}
        {canBookings && (
          <>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5" onClick={() => setOpen("booking")}>
              <CalendarPlus className="size-4 text-primary" />
              <span className="hidden sm:inline">حجز</span>
            </Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5" onClick={() => setOpen("payment")}>
              <Wallet className="size-4 text-primary" />
              <span className="hidden sm:inline">دفعة</span>
            </Button>
          </>
        )}
      </div>

      <QuickCustomer open={open === "customer"} close={() => setOpen(null)} />
      <QuickBooking open={open === "booking"} close={() => setOpen(null)} />
      <QuickPayment open={open === "payment"} close={() => setOpen(null)} />
      <OpportunityDialog
        open={open === "opportunity"}
        onOpenChange={(v) => setOpen(v ? "opportunity" : null)}
      />
    </>
  );
}

function Shell({
  open,
  close,
  title,
  onSubmit,
  children,
}: {
  open: boolean;
  close: () => void;
  title: string;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            إلغاء
          </Button>
          <Button onClick={onSubmit}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <Label className="mb-1.5 block text-xs font-semibold">{label}</Label>
      {children}
    </div>
  );
}

/* ---------- عميل جديد ---------- */
function QuickCustomer({ open, close }: { open: boolean; close: () => void }) {
  const { addCustomer, currentUser } = useCrm();
  const [f, setF] = useState({ name: "", phone: "", email: "", city: "", source: "direct" as CustomerSource });

  const submit = () => {
    if (!f.name.trim() || !f.phone.trim()) {
      toast.error("الاسم ورقم الجوال مطلوبان");
      return;
    }
    addCustomer({ ...f, ownerId: currentUser.id });
    toast.success("تمت إضافة العميل");
    setF({ name: "", phone: "", email: "", city: "", source: "direct" });
    close();
  };

  return (
    <Shell open={open} close={close} title="عميل جديد" onSubmit={submit}>
      <Field label="الاسم">
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="رقم الجوال">
        <Input dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="01012345678" />
      </Field>
      <Field label="البريد الإلكتروني">
        <Input dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </Field>
      <Field label="المدينة">
        <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
      </Field>
      <Field label="المصدر" wide>
        <Select value={f.source} onValueChange={(v) => setF({ ...f, source: v as CustomerSource })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </Shell>
  );
}

/* ---------- حجز جديد ---------- */
function QuickBooking({ open, close }: { open: boolean; close: () => void }) {
  const { addBooking, scopedCustomers, packages, currentUser } = useCrm();
  const [f, setF] = useState({ customerId: "", packageId: "", travelDate: today(), pax: "1", amount: "", paid: "0" });

  const pick = (packageId: string) => {
    const p = packages.find((x) => x.id === packageId);
    const pax = Number(f.pax) || 1;
    setF({ ...f, packageId, amount: p ? String(p.price * pax) : f.amount });
  };

  const submit = () => {
    if (!f.customerId || !f.packageId || !Number(f.amount)) {
      toast.error("اختر العميل والباقة وحدد المبلغ");
      return;
    }
    const paid = Number(f.paid) || 0;
    const amount = Number(f.amount);
    addBooking({
      customerId: f.customerId,
      packageId: f.packageId,
      travelDate: f.travelDate,
      pax: Number(f.pax) || 1,
      amount,
      paid,
      status: paid >= amount ? "paid" : paid > 0 ? "confirmed" : "draft",
      ownerId: currentUser.id,
    });
    toast.success("تم إنشاء الحجز");
    setF({ customerId: "", packageId: "", travelDate: today(), pax: "1", amount: "", paid: "0" });
    close();
  };

  return (
    <Shell open={open} close={close} title="حجز جديد" onSubmit={submit}>
      <Field label="العميل" wide>
        <Select value={f.customerId} onValueChange={(v) => setF({ ...f, customerId: v })}>
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
      </Field>
      <Field label="الباقة" wide>
        <Select value={f.packageId} onValueChange={pick}>
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
      </Field>
      <Field label="تاريخ السفر">
        <Input dir="ltr" type="date" value={f.travelDate} onChange={(e) => setF({ ...f, travelDate: e.target.value })} />
      </Field>
      <Field label="عدد الأفراد">
        <Input dir="ltr" type="number" min={1} value={f.pax} onChange={(e) => setF({ ...f, pax: e.target.value })} />
      </Field>
      <Field label="إجمالي المبلغ">
        <Input dir="ltr" type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
      </Field>
      <Field label="المدفوع مقدماً">
        <Input dir="ltr" type="number" value={f.paid} onChange={(e) => setF({ ...f, paid: e.target.value })} />
      </Field>
    </Shell>
  );
}

/* ---------- تسجيل دفعة ---------- */
function QuickPayment({ open, close }: { open: boolean; close: () => void }) {
  const { addPayment, scopedBookings, customerName, packageName } = useCrm();
  const [f, setF] = useState({ bookingId: "", amount: "", date: today(), method: "cash" as PaymentMethod, reference: "" });

  const openBookings = scopedBookings.filter((b) => b.status !== "cancelled" && b.paid < b.amount);
  const selected = scopedBookings.find((b) => b.id === f.bookingId);

  const submit = () => {
    const booking = scopedBookings.find((b) => b.id === f.bookingId);
    if (!booking || !Number(f.amount)) {
      toast.error("اختر الحجز وحدد مبلغ الدفعة");
      return;
    }
    addPayment({
      bookingId: booking.id,
      customerId: booking.customerId,
      date: f.date,
      amount: Number(f.amount),
      method: f.method,
      reference: f.reference,
    });
    toast.success("تم تسجيل الدفعة");
    setF({ bookingId: "", amount: "", date: today(), method: "cash", reference: "" });
    close();
  };

  return (
    <Shell open={open} close={close} title="تسجيل دفعة" onSubmit={submit}>
      <Field label="الحجز" wide>
        <Select value={f.bookingId} onValueChange={(v) => setF({ ...f, bookingId: v })}>
          <SelectTrigger>
            <SelectValue placeholder="اختر الحجز" />
          </SelectTrigger>
          <SelectContent>
            {openBookings.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {customerName(b.customerId)} — {packageName(b.packageId)} (متبقي {money(b.amount - b.paid)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {selected ? (
        <p className="sm:col-span-2 -mt-1 text-xs text-muted-foreground">
          المتبقي على هذا الحجز: <span className="font-bold text-primary">{money(selected.amount - selected.paid)}</span>
        </p>
      ) : null}
      <Field label="المبلغ">
        <Input dir="ltr" type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
      </Field>
      <Field label="التاريخ">
        <Input dir="ltr" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
      </Field>
      <Field label="طريقة الدفع">
        <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v as PaymentMethod })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="المرجع">
        <Input dir="ltr" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
      </Field>
    </Shell>
  );
}
