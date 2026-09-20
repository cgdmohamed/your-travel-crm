import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Check, X, Users, Moon, MapPin, Link2, Pencil, Upload, Images, ChevronDown } from "lucide-react";
import { AppLayout } from "@/components/crm/AppLayout";
import { Pagination, usePagination } from "@/components/crm/Pagination";
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
  PACKAGE_CATEGORY_LABELS,
  PACKAGE_STATUS_LABELS,
  ROOM_BASIS_LABELS,
  money,
  num,
  useCrm,
  type PackageCategory,
  type PackageStatus,
  type RoomBasis,
  type TourPackage,
} from "@/lib/crm-data";
import { useSettings } from "@/lib/settings";
import { useServerFn } from "@tanstack/react-start";
import { uploadPackageImage } from "@/lib/upload.functions";

export const Route = createFileRoute("/_authenticated/packages")({
  head: () => ({
    meta: [
      { title: "الباقات السياحية — طواف CRM" },
      {
        name: "description",
        content: "كروت الباقات السياحية بالصور والمشتملات والتصنيفات وربطها مع ووردبريس.",
      },
      { property: "og:title", content: "الباقات السياحية — طواف CRM" },
      {
        property: "og:description",
        content: "كروت الباقات السياحية بالصور والمشتملات والتصنيفات وربطها مع ووردبريس.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PackagesPage,
});

type FormState = {
  name: string;
  destination: string;
  nights: string;
  price: string;
  seats: string;
  seatsTaken: string;
  category: PackageCategory;
  roomBasis: RoomBasis;
  status: PackageStatus;
  image: string;
  gallery: string[];
  includes: string;
  excludes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  destination: "",
  nights: "5",
  price: "10000",
  seats: "30",
  seatsTaken: "0",
  category: "full",
  roomBasis: "double",
  status: "available",
  image: "",
  gallery: [],
  includes: "طيران ذهاب وعودة\nالإقامة مع الإفطار\nالانتقالات من وإلى المطار",
  excludes: "التأشيرة\nالمصروفات الشخصية",
};

function toForm(p: TourPackage): FormState {
  return {
    name: p.name,
    destination: p.destination,
    nights: String(p.nights),
    price: String(p.price),
    seats: String(p.seats),
    seatsTaken: String(p.seatsTaken),
    category: p.category,
    roomBasis: p.roomBasis,
    status: p.status,
    image: p.image ?? "",
    gallery: p.gallery ?? [],
    includes: p.includes.join("\n"),
    excludes: p.excludes.join("\n"),
  };
}

function slugify(v: string) {
  return v.trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").toLowerCase();
}

function PackagesPage() {
  const { packages, addPackage, updatePackage, can } = useCrm();
  const { settings } = useSettings();
  const uploadFn = useServerFn(uploadPackageImage);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | PackageStatus>("all");
  const [category, setCategory] = useState<"all" | PackageCategory>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TourPackage | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const list = packages.filter(
    (p) =>
      (status === "all" || p.status === status) &&
      (category === "all" || p.category === category) &&
      (p.name.includes(q) || p.destination.includes(q)),
  );

  const { page, setPage, pageCount, paged, total } = usePagination(list, settings.pageSize);

  const editable = can("packages.edit");

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: TourPackage) => {
    setEditing(p);
    setForm(toForm(p));
    setDialogOpen(true);
  };

  const submit = () => {
    if (!form.name.trim() || !form.destination.trim()) {
      toast.error("الاسم والوجهة مطلوبان");
      return;
    }
    const payload = {
      name: form.name,
      destination: form.destination,
      nights: Number(form.nights) || 1,
      price: Number(form.price) || 0,
      seats: Number(form.seats) || 0,
      seatsTaken: Number(form.seatsTaken) || 0,
      status: form.status,
      category: form.category,
      roomBasis: form.roomBasis,
      image: form.image.trim(),
      gallery: form.gallery,
      includes: form.includes.split("\n").map((s) => s.trim()).filter(Boolean),
      excludes: form.excludes.split("\n").map((s) => s.trim()).filter(Boolean),
      wpSlug: slugify(form.name),
    };
    if (editing) {
      updatePackage(editing.id, payload);
      toast.success("تم تحديث الباقة");
    } else {
      addPackage(payload);
      toast.success("تمت إضافة الباقة");
    }
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  return (
    <AppLayout
      title="الباقات السياحية"
      subtitle="كروت الباقات بالصور والمشتملات وتصنيفات جاهزة للمزامنة مع ووردبريس"
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Input
          placeholder="ابحث باسم الباقة أو الوجهة"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل التصنيفات</SelectItem>
            {Object.entries(PACKAGE_CATEGORY_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="available">متاحة</SelectItem>
            <SelectItem value="full">مكتملة</SelectItem>
            <SelectItem value="ended">منتهية</SelectItem>
          </SelectContent>
        </Select>

        {editable ? <Button className="ms-auto" onClick={openAdd}>إضافة باقة</Button> : null}
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {paged.map((p) => (
          <PackageCard
            key={p.id}
            pkg={p}
            editable={editable}
            onEdit={() => openEdit(p)}
            onStatus={(s) => updatePackage(p.id, { status: s })}
          />
        ))}
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            لا توجد باقات مطابقة
          </CardContent>
        </Card>
      ) : (
        <div className="mt-5">
          <Pagination page={page} pageCount={pageCount} total={total} onPage={setPage} />
        </div>
      )}

      <PackageFormDialog
        open={dialogOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        onSubmit={submit}
        uploadFn={uploadFn}
      />
    </AppLayout>
  );
}

function PackageFormDialog({
  open,
  editing,
  form,
  setForm,
  onOpenChange,
  onSubmit,
  uploadFn,
}: {
  open: boolean;
  editing: TourPackage | null;
  form: FormState;
  setForm: (f: FormState) => void;
  onOpenChange: (o: boolean) => void;
  onSubmit: () => void;
  uploadFn: (opts: { data: { fileName: string; dataUrl: string } }) => Promise<{ ok: true; url: string }>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل الباقة" : "باقة جديدة"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>اسم الباقة</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>الوجهة</Label>
            <Input
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>التصنيف</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as PackageCategory })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PACKAGE_CATEGORY_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>أساس الإقامة</Label>
              <Select
                value={form.roomBasis}
                onValueChange={(v) => setForm({ ...form, roomBasis: v as RoomBasis })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROOM_BASIS_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>الليالي</Label>
              <Input
                type="number"
                value={form.nights}
                onChange={(e) => setForm({ ...form, nights: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>السعر للفرد</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>المقاعد</Label>
              <Input
                type="number"
                value={form.seats}
                onChange={(e) => setForm({ ...form, seats: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>المقاعد المحجوزة</Label>
              <Input
                type="number"
                value={form.seatsTaken}
                onChange={(e) => setForm({ ...form, seatsTaken: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>الحالة</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as PackageStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">متاحة</SelectItem>
                  <SelectItem value="full">مكتملة</SelectItem>
                  <SelectItem value="ended">منتهية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>صورة الباقة الرئيسية</Label>
            <ImageDrop
              value={form.image}
              uploadFn={uploadFn}
              onPick={(urls) => setForm({ ...form, image: urls[0] ?? form.image })}
              onRemove={() => setForm({ ...form, image: "" })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>ألبوم صور الباقة</Label>
            <GalleryDrop
              images={form.gallery}
              uploadFn={uploadFn}
              onAdd={(urls) => setForm({ ...form, gallery: [...form.gallery, ...urls] })}
              onRemove={(i) =>
                setForm({ ...form, gallery: form.gallery.filter((_, idx) => idx !== i) })
              }
              onMakeCover={(i) => {
                const cover = form.gallery[i]!;
                const rest = form.gallery.filter((_, idx) => idx !== i);
                setForm({
                  ...form,
                  image: cover,
                  gallery: form.image ? [...rest, form.image] : rest,
                });
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>المشتملات (بند في كل سطر)</Label>
            <Textarea
              rows={4}
              value={form.includes}
              onChange={(e) => setForm({ ...form, includes: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>غير المشتمل (بند في كل سطر)</Label>
            <Textarea
              rows={3}
              value={form.excludes}
              onChange={(e) => setForm({ ...form, excludes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit}>{editing ? "حفظ التعديلات" : "حفظ الباقة"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PackageCard({
  pkg,
  editable,
  onEdit,
  onStatus,
}: {
  pkg: TourPackage;
  editable: boolean;
  onEdit: () => void;
  onStatus: (s: PackageStatus) => void;
}) {
  const left = pkg.seats - pkg.seatsTaken;
  const pct = pkg.seats ? Math.round((pkg.seatsTaken / pkg.seats) * 100) : 0;
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <Card className="overflow-hidden pt-0">
      <div className="relative h-44 w-full bg-muted">
        {pkg.image ? (
          <img
            src={pkg.image}
            alt={pkg.name}
            loading="lazy"
            width={1024}
            height={640}
            className="h-44 w-full object-cover"
          />
        ) : (
          <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20 text-sm text-muted-foreground">
            بدون صورة
          </div>
        )}
        <div className="absolute right-3 top-3 flex gap-2">
          <Badge className="bg-primary text-primary-foreground">
            {PACKAGE_CATEGORY_LABELS[pkg.category]}
          </Badge>
          <Badge variant="secondary">{PACKAGE_STATUS_LABELS[pkg.status]}</Badge>
        </div>
        {editable ? (
          <Button
            size="sm"
            variant="secondary"
            className="absolute left-3 top-3 gap-1.5"
            onClick={onEdit}
          >
            <Pencil className="size-3.5" />
            تعديل
          </Button>
        ) : null}
      </div>

      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="text-base font-bold leading-tight">{pkg.name}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> {pkg.destination}
            </span>
            <span className="inline-flex items-center gap-1">
              <Moon className="size-3.5" /> {num(pkg.nights)} ليالٍ
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {ROOM_BASIS_LABELS[pkg.roomBasis]}
            </span>
          </p>
        </div>

        <div className="flex items-end justify-between rounded-lg bg-secondary/60 px-3 py-2">
          <div>
            <p className="text-[11px] text-muted-foreground">السعر للفرد</p>
            <p className="text-lg font-bold text-primary">{money(pkg.price)}</p>
          </div>
          <div className="text-left">
            <p className="text-[11px] text-muted-foreground">المقاعد</p>
            <p className="text-sm font-medium">
              {num(left)} متاح من {num(pkg.seats)}
            </p>
          </div>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>

        {pkg.gallery && pkg.gallery.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto">
            {pkg.gallery.map((src, i) => (
              <img
                key={src.slice(-24) + i}
                src={src}
                alt={`${pkg.name} - صورة ${i + 1}`}
                loading="lazy"
                className="size-14 shrink-0 rounded-md object-cover"
              />
            ))}
          </div>
        ) : null}


        {detailsOpen ? (
          <div className="space-y-3 border-t pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-foreground">يشمل</p>
                <ul className="space-y-1">
                  {pkg.includes.map((i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-muted-foreground">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-foreground">لا يشمل</p>
                <ul className="space-y-1">
                  {pkg.excludes.map((i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-muted-foreground">
                      <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Link2 className="size-3.5" />
              ووردبريس: {pkg.wpId ? `#${pkg.wpId}` : "غير مرتبطة"} · {pkg.wpSlug}
            </span>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            التفاصيل والمشتملات
            <ChevronDown className={`size-4 transition ${detailsOpen ? "rotate-180" : ""}`} />
          </button>
          {editable ? (
            <Select value={pkg.status} onValueChange={(v) => onStatus(v as PackageStatus)}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">متاحة</SelectItem>
                <SelectItem value="full">مكتملة</SelectItem>
                <SelectItem value="ended">منتهية</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- رفع الصور ---------------- */

type UploadFn = (opts: {
  data: { fileName: string; dataUrl: string };
}) => Promise<{ ok: true; url: string }>;

function readAsDataUrl(f: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(f);
  });
}

/** يقرأ الصور المختارة ويرفعها فعليًا للخادم (Phase 2 — تخزين محلي)، ثم يرجّع روابطها الدائمة */
function readFiles(files: File[], uploadFn: UploadFn, cb: (urls: string[]) => void) {
  const imgs = files.filter((f) => f.type.startsWith("image/"));
  if (imgs.length === 0) {
    toast.error("من فضلك اختر ملفات صور فقط");
    return;
  }
  void Promise.all(
    imgs.map(async (f) => {
      const dataUrl = await readAsDataUrl(f);
      const res = await uploadFn({ data: { fileName: f.name, dataUrl } });
      return res.url;
    }),
  )
    .then(cb)
    .catch((e: unknown) => {
      toast.error(e instanceof Error ? e.message : "تعذر رفع الصورة");
    });
}

function useDropzone(onFiles: (files: File[]) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      },
    },
  };
}

function ImageDrop({
  value,
  uploadFn,
  onPick,
  onRemove,
}: {
  value: string;
  uploadFn: UploadFn;
  onPick: (urls: string[]) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { over, props } = useDropzone((files) => readFiles(files.slice(0, 1), uploadFn, onPick));

  if (value) {
    return (
      <div className="relative overflow-hidden rounded-lg border">
        <img src={value} alt="صورة الباقة" className="h-40 w-full object-cover" />
        <Button
          type="button"
          size="icon"
          variant="destructive"
          className="absolute left-2 top-2 size-7"
          onClick={onRemove}
          aria-label="حذف الصورة"
        >
          <X className="size-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute bottom-2 left-2"
          onClick={() => inputRef.current?.click()}
        >
          تغيير الصورة
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => readFiles(Array.from(e.target.files ?? []).slice(0, 1), uploadFn, onPick)}
        />
      </div>
    );
  }

  return (
    <div
      {...props}
      onClick={() => inputRef.current?.click()}
      className={`flex h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-sm text-muted-foreground transition ${
        over ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <Upload className="size-5" />
      <span>اسحب الصورة هنا أو اضغط للاختيار</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => readFiles(Array.from(e.target.files ?? []).slice(0, 1), uploadFn, onPick)}
      />
    </div>
  );
}

function GalleryDrop({
  images,
  uploadFn,
  onAdd,
  onRemove,
  onMakeCover,
}: {
  images: string[];
  uploadFn: UploadFn;
  onAdd: (urls: string[]) => void;
  onRemove: (i: number) => void;
  onMakeCover: (i: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { over, props } = useDropzone((files) => readFiles(files, uploadFn, onAdd));

  return (
    <div className="space-y-2">
      {images.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {images.map((src, i) => (
            <div key={src.slice(-24) + i} className="group relative overflow-hidden rounded-md border">
              <img src={src} alt={`صورة ${i + 1}`} className="h-20 w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label="حذف الصورة"
                className="absolute left-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground"
              >
                <X className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => onMakeCover(i)}
                className="absolute inset-x-0 bottom-0 bg-background/80 py-0.5 text-[10px] opacity-0 transition group-hover:opacity-100"
              >
                اجعلها الرئيسية
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div
        {...props}
        onClick={() => inputRef.current?.click()}
        className={`flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs text-muted-foreground transition ${
          over ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <Images className="size-4" />
        <span>اسحب صوراً متعددة هنا أو اضغط للاختيار</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => readFiles(Array.from(e.target.files ?? []), uploadFn, onAdd)}
        />
      </div>
    </div>
  );
}
