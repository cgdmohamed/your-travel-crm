import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Phone, Plus, CalendarClock, Ticket as TicketIcon } from "lucide-react";
import { AppLayout } from "@/components/crm/AppLayout";
import { OpportunityDialog } from "@/components/crm/OpportunityDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  PIPELINE_STAGES,
  SOURCE_LABELS,
  STAGE_LABELS,
  arDate,
  money,
  num,
  useCrm,
  type CustomerSource,
  type Opportunity,
  type Stage,
} from "@/lib/crm-data";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "الفرص والمتابعات — طواف CRM" },
      { name: "description", content: "لوحة مراحل البيع ومتابعة العملاء المحتملين للرحلات." },
      { property: "og:title", content: "الفرص والمتابعات — طواف CRM" },
      {
        property: "og:description",
        content: "لوحة مراحل البيع ومتابعة العملاء المحتملين للرحلات.",
      },
    ],
  }),
  component: PipelinePage,
});

const today = () => new Date().toISOString().slice(0, 10);

function PipelinePage() {
  const {
    scopedOpportunities,
    bookings,
    customers,
    moveOpportunity,
    customerName,
    employeeName,
    can,
  } = useCrm();
  const [dragId, setDragId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [convert, setConvert] = useState<Opportunity | null>(null);
  const [followUp, setFollowUp] = useState<Opportunity | null>(null);
  const [lost, setLost] = useState<Opportunity | null>(null);
  const editable = can("pipeline.edit");

  const drop = (stage: Stage) => {
    if (!dragId || !editable) return;
    const opp = scopedOpportunities.find((o) => o.id === dragId);
    setDragId(null);
    if (!opp || opp.stage === stage) return;
    if (stage === "won" && !opp.bookingId) {
      setConvert(opp);
      return;
    }
    if (stage === "lost") {
      setLost(opp);
      return;
    }
    moveOpportunity(opp.id, stage);
    toast.success(`تم نقل الفرصة إلى «${STAGE_LABELS[stage]}»`);
  };

  return (
    <AppLayout title="الفرص والمتابعات" subtitle="اسحب بطاقة الفرصة لتغيير مرحلتها">
      {editable && (
        <div className="mb-4 flex justify-start">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            فرصة جديدة
          </Button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {PIPELINE_STAGES.map((stage) => {
          const items = scopedOpportunities.filter((o) => o.stage === stage);
          const value = items.reduce((s, o) => s + o.value, 0);
          return (
            <div
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drop(stage)}
              className="flex min-h-72 flex-col rounded-xl bg-muted/60 p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">{STAGE_LABELS[stage]}</p>
                <Badge variant="secondary">{num(items.length)}</Badge>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">{money(value)}</p>
              <div className="flex flex-col gap-2">
                {items.map((o) => {
                  const customer = customers.find((c) => c.id === o.customerId);
                  const overdue =
                    !!o.followUpDate &&
                    o.followUpDate < today() &&
                    o.stage !== "won" &&
                    o.stage !== "lost";
                  const booking = o.bookingId ? bookings.find((b) => b.id === o.bookingId) : undefined;
                  return (
                    <Card
                      key={o.id}
                      draggable={editable}
                      onDragStart={() => setDragId(o.id)}
                      className={`${editable ? "cursor-grab active:cursor-grabbing" : ""} ${
                        overdue ? "border-metric-orange/60" : ""
                      }`}
                    >
                      <CardContent className="space-y-1.5 p-3">
                        <p className="text-sm font-semibold leading-snug">{o.title}</p>
                        <Link
                          to="/customers/$customerId"
                          params={{ customerId: o.customerId }}
                          className="block truncate text-xs text-primary underline-offset-4 hover:underline"
                        >
                          {customerName(o.customerId)}
                        </Link>
                        <p className="text-sm font-bold text-primary">{money(o.value)}</p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <Badge variant="outline" className="text-[10px]">
                            {SOURCE_LABELS[o.source]}
                          </Badge>
                          {o.followUpDate && (
                            <Badge
                              variant={overdue ? "destructive" : "outline"}
                              className="text-[10px]"
                            >
                              {overdue ? "متأخرة " : "متابعة "}
                              {arDate(o.followUpDate)}
                            </Badge>
                          )}
                        </div>
                        {booking && (
                          <Link
                            to="/bookings"
                            className="flex items-center gap-1 pt-1 text-[11px] font-medium text-primary underline-offset-4 hover:underline"
                          >
                            <TicketIcon className="size-3" />
                            حجز {booking.ref}
                          </Link>
                        )}
                        <p className="pt-1 text-[11px] text-muted-foreground">
                          {employeeName(o.ownerId)}
                        </p>
                        {editable && (
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => setFollowUp(o)}
                            >
                              <CalendarClock className="size-3" />
                              متابعة
                            </Button>
                            {o.stage === "won" && !o.bookingId && (
                              <Button
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => setConvert(o)}
                              >
                                تحويل إلى حجز
                              </Button>
                            )}
                            {customer && (
                              <>
                                <Button
                                  asChild
                                  size="sm"
                                  variant="ghost"
                                  className="size-7 p-0"
                                  title="واتساب"
                                >
                                  <a
                                    href={`https://wa.me/2${customer.phone}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <MessageCircle className="size-3.5" />
                                  </a>
                                </Button>
                                <Button
                                  asChild
                                  size="sm"
                                  variant="ghost"
                                  className="size-7 p-0"
                                  title="اتصال"
                                >
                                  <a href={`tel:${customer.phone}`}>
                                    <Phone className="size-3.5" />
                                  </a>
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {items.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    لا توجد فرص
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <OpportunityDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ConvertDialog opp={convert} onClose={() => setConvert(null)} />
      <FollowUpDialog opp={followUp} onClose={() => setFollowUp(null)} />
      <LostDialog opp={lost} onClose={() => setLost(null)} />
    </AppLayout>
  );
}

function ConvertDialog({ opp, onClose }: { opp: Opportunity | null; onClose: () => void }) {
  const { convertOpportunityToBooking, moveOpportunity, customerName, packageName } = useCrm();
  const [travelDate, setTravelDate] = useState(today());
  const [pax, setPax] = useState(2);
  const [amount, setAmount] = useState(0);
  const [paid, setPaid] = useState(0);
  const [key, setKey] = useState("");

  if (opp && key !== opp.id) {
    setKey(opp.id);
    setPax(opp.pax ?? 2);
    setAmount(opp.value);
    setPaid(0);
  }

  const save = async () => {
    if (!opp) return;
    try {
      const ref = await convertOpportunityToBooking(opp.id, { travelDate, pax, amount, paid });
      toast.success(`تم إنشاء الحجز ${ref}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر تحويل الفرصة إلى حجز");
    }
  };

  const skip = () => {
    if (!opp) return;
    moveOpportunity(opp.id, "won");
    toast.success("تم تعليم الفرصة كربح بدون حجز");
    onClose();
  };

  return (
    <Dialog open={!!opp} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تحويل الفرصة إلى حجز</DialogTitle>
        </DialogHeader>
        {opp && (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              {customerName(opp.customerId)} · {packageName(opp.packageId)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>تاريخ السفر</Label>
                <Input
                  type="date"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>عدد الأفراد</Label>
                <Input
                  type="number"
                  min={1}
                  value={pax}
                  onChange={(e) => setPax(Number(e.target.value) || 1)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>إجمالي المبلغ</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>المدفوع مقدماً</Label>
                <Input
                  type="number"
                  value={paid}
                  onChange={(e) => setPaid(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={skip}>
            ربح بدون حجز
          </Button>
          <Button onClick={save}>إنشاء الحجز</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FollowUpDialog({ opp, onClose }: { opp: Opportunity | null; onClose: () => void }) {
  const { addNote, updateOpportunity } = useCrm();
  const [text, setText] = useState("");
  const [date, setDate] = useState(today());

  const save = () => {
    if (!opp) return;
    if (text.trim()) addNote(opp.customerId, `متابعة فرصة «${opp.title}»: ${text.trim()}`);
    updateOpportunity(opp.id, { followUpDate: date });
    toast.success("تم تسجيل المتابعة");
    setText("");
    onClose();
  };

  return (
    <Dialog open={!!opp} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تسجيل متابعة</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>نص المتابعة</Label>
            <Textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="تم الاتصال بالعميل وطلب عرض سعر محدث."
            />
          </div>
          <div className="grid gap-1.5">
            <Label>تاريخ المتابعة القادمة</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={save}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LostDialog({ opp, onClose }: { opp: Opportunity | null; onClose: () => void }) {
  const { updateOpportunity, addNote } = useCrm();
  const [reason, setReason] = useState("");

  const save = () => {
    if (!opp) return;
    updateOpportunity(opp.id, { stage: "lost", lostReason: reason.trim() || undefined });
    if (reason.trim()) addNote(opp.customerId, `خسارة فرصة «${opp.title}»: ${reason.trim()}`);
    toast.success("تم نقل الفرصة إلى «مغلق - خسارة»");
    setReason("");
    onClose();
  };

  return (
    <Dialog open={!!opp} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>سبب الخسارة</DialogTitle>
        </DialogHeader>
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="السعر أعلى من ميزانية العميل (اختياري)"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={save}>تأكيد الخسارة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
