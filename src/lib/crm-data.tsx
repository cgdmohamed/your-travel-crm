import { trackMeta } from "@/lib/meta-track";
import { useAuth, refreshAccessToken } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type Context,
  type ReactNode,
} from "react";

import { listEmployees } from "@/lib/queries/employees.functions";
import { createAccount, updateEmployeeSettings } from "@/lib/accounts.functions";
import {
  listPackages,
  createPackage,
  updatePackage as updatePackageFn,
} from "@/lib/queries/packages.functions";
import { listCustomers, createCustomer, addCustomerNote } from "@/lib/queries/customers.functions";
import {
  listBookings,
  createBooking,
  setBookingStatus as setBookingStatusFn,
  convertOpportunityToBooking as convertOppFn,
} from "@/lib/queries/bookings.functions";
import {
  listOpportunities,
  createOpportunity,
  updateOpportunity as updateOpportunityFn,
  moveOpportunity as moveOpportunityFn,
} from "@/lib/queries/opportunities.functions";
import { listTickets, addTicket as addTicketFn } from "@/lib/queries/tickets.functions";
import { listHotelStays, addHotelStay as addHotelStayFn } from "@/lib/queries/hotels.functions";
import { listPayments, addPayment as addPaymentFn } from "@/lib/queries/payments.functions";
import {
  listAttachments,
  createAttachment,
  removeAttachment as removeAttachmentFn,
} from "@/lib/queries/attachments.functions";

/* ---------------- Types ---------------- */

export type {
  Role,
  Permission,
  PermissionCarrier,
} from "@/lib/permissions";
export {
  ROLE_LABELS,
  PERMISSION_LABELS,
  PERMISSION_GROUPS,
  ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
  effectivePermissions,
} from "@/lib/permissions";
import { effectivePermissions, type Role, type Permission } from "@/lib/permissions";

export type Employee = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  /** صلاحيات مخصّصة يضبطها المدير؛ عند غيابها تُستخدم صلاحيات الدور */
  permissions?: Permission[] | undefined;
};

export type PackageStatus = "available" | "full" | "ended";

export const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
  available: "متاحة",
  full: "مكتملة",
  ended: "منتهية",
};

export type PackageCategory = "flight" | "hotel" | "shared" | "full" | "cruise" | "visa";

export const PACKAGE_CATEGORY_LABELS: Record<PackageCategory, string> = {
  flight: "طيران",
  hotel: "فنادق",
  shared: "إقامة مشتركة",
  full: "باقة متكاملة",
  cruise: "رحلات بحرية",
  visa: "تأشيرات",
};

export type RoomBasis = "single" | "double" | "triple" | "quad";

export const ROOM_BASIS_LABELS: Record<RoomBasis, string> = {
  single: "غرفة فردية",
  double: "غرفة مزدوجة (فردان)",
  triple: "غرفة ثلاثية (3 أفراد)",
  quad: "غرفة رباعية (4 أفراد)",
};

export type TourPackage = {
  id: string;
  name: string;
  destination: string;
  nights: number;
  price: number;
  seats: number;
  seatsTaken: number;
  status: PackageStatus;
  category: PackageCategory;
  roomBasis: RoomBasis;
  image: string | null;
  /** ألبوم صور إضافية للباقة */
  gallery?: string[];
  includes: string[];
  excludes: string[];
  /** معرّف المنتج في ووردبريس (للمزامنة) */
  wpId?: number | undefined;
  wpSlug: string;
};

export type CustomerSource = "whatsapp" | "website" | "direct";

export const SOURCE_LABELS: Record<CustomerSource, string> = {
  whatsapp: "واتساب",
  website: "الموقع",
  direct: "مباشر",
};

export type Note = { id: string; date: string; text: string; author: string };

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  source: CustomerSource;
  ownerId: string;
  notes: Note[];
};

export type BookingStatus = "draft" | "confirmed" | "paid" | "cancelled";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  draft: "مبدئي",
  confirmed: "مؤكد",
  paid: "مدفوع",
  cancelled: "ملغي",
};

export type Booking = {
  id: string;
  ref: string;
  customerId: string;
  packageId: string;
  travelDate: string;
  pax: number;
  amount: number;
  paid: number;
  status: BookingStatus;
  ownerId: string;
  createdAt: string;
  /** وقت تسجيل الحجز HH:MM */
  time?: string | undefined;
};

/* ---- التذاكر والفنادق والتحصيل ---- */

export type TicketStatus = "issued" | "pending" | "cancelled";

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  issued: "صادرة",
  pending: "قيد الإصدار",
  cancelled: "ملغاة",
};

export type CabinClass = "economy" | "business";

export const CABIN_LABELS: Record<CabinClass, string> = {
  economy: "اقتصادية",
  business: "رجال أعمال",
};

export type Ticket = {
  id: string;
  bookingId: string;
  customerId: string;
  passenger: string;
  airline: string;
  flightNo: string;
  route: string;
  departDate: string;
  returnDate?: string | undefined;
  pnr: string;
  cabin: CabinClass;
  price: number;
  status: TicketStatus;
};

export type BoardBasis = "ro" | "bb" | "hb" | "ai";

export const BOARD_LABELS: Record<BoardBasis, string> = {
  ro: "بدون وجبات",
  bb: "إفطار فقط",
  hb: "نصف إقامة",
  ai: "الكل شامل",
};

export type HotelStay = {
  id: string;
  bookingId: string;
  customerId: string;
  hotel: string;
  city: string;
  roomBasis: RoomBasis;
  board: BoardBasis;
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
  confirmationNo: string;
  price: number;
};

export type PaymentMethod = "cash" | "bank" | "card" | "instapay" | "wallet";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "نقدي",
  bank: "تحويل بنكي",
  card: "بطاقة ائتمان",
  instapay: "إنستا باي",
  wallet: "محفظة إلكترونية",
};

export type Payment = {
  id: string;
  bookingId: string;
  customerId: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  collectedBy: string;
  /** وقت التحصيل HH:MM */
  time?: string | undefined;
};

export type Stage = "new" | "contacted" | "quote" | "negotiation" | "won" | "lost";

export const STAGE_LABELS: Record<Stage, string> = {
  new: "جديد",
  contacted: "تواصل",
  quote: "عرض سعر",
  negotiation: "تفاوض",
  won: "مغلق - ربح",
  lost: "مغلق - خسارة",
};

export const PIPELINE_STAGES: Stage[] = ["new", "contacted", "quote", "negotiation", "won", "lost"];

export type Opportunity = {
  id: string;
  title: string;
  customerId: string;
  packageId: string;
  value: number;
  stage: Stage;
  ownerId: string;
  followUpDate: string;
  source: CustomerSource;
  pax?: number | undefined;
  bookingId?: string | undefined;
  lostReason?: string | undefined;
};

export type AttachmentKind = "ticket" | "hotel" | "payment" | "other";

export const ATTACHMENT_KIND_LABELS: Record<AttachmentKind, string> = {
  ticket: "تذاكر",
  hotel: "فنادق",
  payment: "إيصالات",
  other: "أخرى",
};

export type Attachment = {
  id: string;
  customerId: string;
  kind: AttachmentKind;
  refId?: string | undefined;
  name: string;
  mime: string;
  size: number;
  /** رابط تحميل الملف (مسار API خاص محمي بالمصادقة وملكية العميل) */
  url: string;
  uploadedAt: string;
  uploadedBy: string;
};

/* ---------------- Store (Postgres عبر React Query) ---------------- */

type CrmState = {
  employees: Employee[];
  packages: TourPackage[];
  customers: Customer[];
  bookings: Booking[];
  tickets: Ticket[];
  hotelStays: HotelStay[];
  payments: Payment[];
  attachments: Attachment[];
  opportunities: Opportunity[];
  currentUser: Employee;
  /** يُعاد تحميل جلسة المصادقة الحالية — تُستدعى بعد تسجيل الخروج لتفريغ الحالة المخبأة */
  refreshAuth: () => Promise<void>;
  can: (p: Permission) => boolean;
  /** أصبحت من نفس مصدر customers/bookings/opportunities (القيود مطبّقة على الخادم) */
  scopedCustomers: Customer[];
  scopedBookings: Booking[];
  scopedOpportunities: Opportunity[];
  addPackage: (p: Omit<TourPackage, "id">) => Promise<void>;
  updatePackage: (id: string, p: Partial<TourPackage>) => Promise<void>;
  addCustomer: (c: Omit<Customer, "id" | "notes">) => Promise<string>;
  addNote: (customerId: string, text: string) => Promise<void>;
  addBooking: (b: Omit<Booking, "id" | "ref" | "createdAt">) => Promise<void>;
  setBookingStatus: (id: string, status: BookingStatus) => Promise<void>;
  addTicket: (t: Omit<Ticket, "id">) => Promise<void>;
  addHotelStay: (h: Omit<HotelStay, "id">) => Promise<void>;
  addPayment: (p: Omit<Payment, "id" | "collectedBy">) => Promise<void>;
  addAttachment: (a: {
    customerId: string;
    kind: AttachmentKind;
    refId?: string | undefined;
    name: string;
    mime: string;
    size: number;
    dataUrl: string;
  }) => Promise<void>;
  removeAttachment: (id: string) => Promise<void>;
  moveOpportunity: (id: string, stage: Stage) => Promise<void>;
  addOpportunity: (o: Omit<Opportunity, "id">) => Promise<void>;
  updateOpportunity: (
    id: string,
    o: Partial<Pick<Opportunity, "stage" | "followUpDate" | "lostReason" | "bookingId">>,
  ) => Promise<void>;
  convertOpportunityToBooking: (
    oppId: string,
    data: { travelDate: string; pax: number; amount: number; paid: number },
  ) => Promise<string>;
  /** إنشاء موظف يتطلب الآن كلمة مرور لحساب الدخول الحقيقي */
  addEmployee: (e: Omit<Employee, "id"> & { password: string }) => Promise<void>;
  updateEmployee: (id: string, e: Partial<Employee>) => Promise<void>;
  employeeName: (id: string) => string;
  customerName: (id: string) => string;
  packageName: (id: string) => string;
};

// Shared across duplicate module instances (HMR / route code-splitting)
const g = globalThis as unknown as { __crmContext?: Context<CrmState | null> };
const CrmContext = (g.__crmContext ??= createContext<CrmState | null>(null));

const nowIsoDate = () => new Date().toISOString().slice(0, 10);

/** موظف احتياطي بينما تُحمَّل قائمة الموظفين الحقيقية أو قبل تسجيل الدخول — لا يُعرض فعليًا لأن الصفحات المحمية تنتظر جلسة صالحة */
const GUEST_EMPLOYEE: Employee = { id: "", name: "", email: "", role: "agent", active: false };

/** إلغاء المعرّف المؤقت المستخدم في التحديث المتفائل قبل رجوع مُعرّف الخادم الحقيقي */
const tempId = () => `tmp-${Math.random().toString(36).slice(2, 10)}`;

function useOptimisticAdd<TItem, TInput>(
  qc: QueryClient,
  key: readonly unknown[],
  mutationFn: (input: TInput) => Promise<TItem>,
  buildOptimistic: (input: TInput) => TItem,
) {
  return useMutation({
    mutationFn,
    onMutate: async (input: TInput) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TItem[]>(key);
      qc.setQueryData<TItem[]>(key, (old) => [buildOptimistic(input), ...(old ?? [])]);
      return { prev };
    },
    onError: (_e, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}

function useOptimisticPatch<TItem extends { id: string }, TInput extends { id: string }>(
  qc: QueryClient,
  key: readonly unknown[],
  mutationFn: (input: TInput) => Promise<TItem>,
  applyPatch: (item: TItem, input: TInput) => TItem,
) {
  return useMutation({
    mutationFn,
    onMutate: async (input: TInput) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TItem[]>(key);
      qc.setQueryData<TItem[]>(key, (old) =>
        (old ?? []).map((it) => (it.id === input.id ? applyPatch(it, input) : it)),
      );
      return { prev };
    },
    onError: (_e, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { profile, reload } = useAuth();
  const enabled = Boolean(profile);

  // الـaccess token صالح 15 دقيقة فقط ومفيش أي تجديد تلقائي له غير هنا —
  // من غيره أي إجراء بعد 15 دقيقة من آخر تسجيل دخول/تجديد كان بيفشل برسالة
  // عامة غير مفهومة ("تعذر الحفظ"...) لأن التوكن بينتهي بصمت. تجديد فوري عند
  // تحميل الصفحة (الكوكي الموجود أصلاً ممكن يكون قريب من الانتهاء لو الصفحة
  // اتحمّلت بعد فترة طويلة من آخر تسجيل دخول) + تجديد دوري كل 10 دقائق
  // (أقل من مدة الصلاحية بهامش أمان) طول ما فيه جلسة فعّالة.
  useEffect(() => {
    if (!enabled) return;
    void refreshAccessToken();
    const id = setInterval(() => void refreshAccessToken(), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [enabled]);

  // --- reads ---
  const employeesFn = useServerFn(listEmployees);
  const packagesFn = useServerFn(listPackages);
  const customersFn = useServerFn(listCustomers);
  const bookingsFn = useServerFn(listBookings);
  const opportunitiesFn = useServerFn(listOpportunities);
  const ticketsFn = useServerFn(listTickets);
  const hotelsFn = useServerFn(listHotelStays);
  const paymentsFn = useServerFn(listPayments);
  const attachmentsFn = useServerFn(listAttachments);

  const employeesQ = useQuery({ queryKey: ["crm", "employees"], queryFn: () => employeesFn(), enabled });
  const packagesQ = useQuery({ queryKey: ["crm", "packages"], queryFn: () => packagesFn(), enabled });
  const customersQ = useQuery({ queryKey: ["crm", "customers"], queryFn: () => customersFn(), enabled });
  const bookingsQ = useQuery({ queryKey: ["crm", "bookings"], queryFn: () => bookingsFn(), enabled });
  const opportunitiesQ = useQuery({
    queryKey: ["crm", "opportunities"],
    queryFn: () => opportunitiesFn(),
    enabled,
  });
  const ticketsQ = useQuery({ queryKey: ["crm", "tickets"], queryFn: () => ticketsFn(), enabled });
  const hotelsQ = useQuery({ queryKey: ["crm", "hotels"], queryFn: () => hotelsFn(), enabled });
  const paymentsQ = useQuery({ queryKey: ["crm", "payments"], queryFn: () => paymentsFn(), enabled });
  const attachmentsQ = useQuery({
    queryKey: ["crm", "attachments"],
    queryFn: () => attachmentsFn(),
    enabled,
  });

  const employees = employeesQ.data ?? [];
  const packages = packagesQ.data ?? [];
  const customers = customersQ.data ?? [];
  const bookings = bookingsQ.data ?? [];
  const opportunities = opportunitiesQ.data ?? [];
  const tickets = ticketsQ.data ?? [];
  const hotelStays = hotelsQ.data ?? [];
  const payments = paymentsQ.data ?? [];
  const attachments = attachmentsQ.data ?? [];

  const currentUser: Employee =
    (profile ? employees.find((e) => e.id === profile.id) : undefined) ??
    (profile
      ? { id: profile.id, name: profile.full_name, email: profile.email, role: profile.role, active: true }
      : GUEST_EMPLOYEE);

  const can = useCallback(
    (p: Permission) => effectivePermissions(currentUser).includes(p),
    [currentUser],
  );

  const refreshAuth = useCallback(async () => {
    await reload();
    void qc.removeQueries({ queryKey: ["crm"] });
  }, [reload, qc]);

  // --- mutations ---
  const createPackageFn = useServerFn(createPackage);
  const updatePackageServerFn = useServerFn(updatePackageFn);
  const createCustomerFn = useServerFn(createCustomer);
  const addNoteFn = useServerFn(addCustomerNote);
  const createBookingFn = useServerFn(createBooking);
  const setBookingStatusServerFn = useServerFn(setBookingStatusFn);
  const convertOppServerFn = useServerFn(convertOppFn);
  const addTicketServerFn = useServerFn(addTicketFn);
  const addHotelServerFn = useServerFn(addHotelStayFn);
  const addPaymentServerFn = useServerFn(addPaymentFn);
  const createAttachmentFn = useServerFn(createAttachment);
  const removeAttachmentServerFn = useServerFn(removeAttachmentFn);
  const createOpportunityFn = useServerFn(createOpportunity);
  const updateOpportunityServerFn = useServerFn(updateOpportunityFn);
  const moveOpportunityServerFn = useServerFn(moveOpportunityFn);
  const createAccountFn = useServerFn(createAccount);
  const updateEmployeeSettingsFn = useServerFn(updateEmployeeSettings);

  const packageKey = ["crm", "packages"] as const;
  const customerKey = ["crm", "customers"] as const;
  const bookingKey = ["crm", "bookings"] as const;
  const opportunityKey = ["crm", "opportunities"] as const;
  const ticketKey = ["crm", "tickets"] as const;
  const hotelKey = ["crm", "hotels"] as const;
  const paymentKey = ["crm", "payments"] as const;
  const attachmentKey = ["crm", "attachments"] as const;
  const employeeKey = ["crm", "employees"] as const;

  const addPackageMutation = useOptimisticAdd<TourPackage, Omit<TourPackage, "id">>(
    qc,
    packageKey,
    (input) => createPackageFn({ data: input }),
    (input) => ({ ...input, id: tempId() }),
  );

  const updatePackageMutation = useOptimisticPatch<TourPackage, { id: string; patch: Partial<TourPackage> }>(
    qc,
    packageKey,
    (input) => updatePackageServerFn({ data: input }),
    (item, input) => ({ ...item, ...input.patch }),
  );

  const addCustomerMutation = useMutation({
    mutationFn: (input: Omit<Customer, "id" | "notes">) => createCustomerFn({ data: input }),
    onSuccess: (created) => {
      qc.setQueryData<Customer[]>(customerKey, (old) => [created, ...(old ?? [])]);
      trackMeta({
        eventName: "Lead",
        customerId: created.id,
        customerName: created.name,
        phone: created.phone,
        email: created.email,
        city: created.city,
        sentBy: currentUser.name,
      });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: customerKey }),
  });

  const addNoteMutation = useMutation({
    mutationFn: (input: { customerId: string; text: string }) => addNoteFn({ data: input }),
    onSuccess: (note, input) => {
      qc.setQueryData<Customer[]>(customerKey, (old) =>
        (old ?? []).map((c) => (c.id === input.customerId ? { ...c, notes: [note, ...c.notes] } : c)),
      );
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: customerKey }),
  });

  const addBookingMutation = useOptimisticAdd<Booking, Omit<Booking, "id" | "ref" | "createdAt">>(
    qc,
    bookingKey,
    (input) => createBookingFn({ data: input }),
    (input) => ({ ...input, id: tempId(), ref: "…", createdAt: nowIsoDate() }),
  );

  const setBookingStatusMutation = useOptimisticPatch<Booking, { id: string; status: BookingStatus }>(
    qc,
    bookingKey,
    (input) => setBookingStatusServerFn({ data: input }),
    (item, input) => ({ ...item, status: input.status }),
  );

  const addPaymentMutation = useMutation({
    mutationFn: (input: Omit<Payment, "id" | "collectedBy">) => addPaymentServerFn({ data: input }),
    onSuccess: (payment) => {
      qc.setQueryData<Payment[]>(paymentKey, (old) => [payment, ...(old ?? [])]);
      qc.setQueryData<Booking[]>(bookingKey, (old) =>
        (old ?? []).map((b) => {
          if (b.id !== payment.bookingId) return b;
          const paid = b.paid + payment.amount;
          return { ...b, paid, status: paid >= b.amount ? "paid" : b.status };
        }),
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: paymentKey });
      void qc.invalidateQueries({ queryKey: bookingKey });
    },
  });

  const addTicketMutation = useOptimisticAdd<Ticket, Omit<Ticket, "id">>(
    qc,
    ticketKey,
    (input) => addTicketServerFn({ data: input }),
    (input) => ({ ...input, id: tempId() }),
  );

  const addHotelMutation = useOptimisticAdd<HotelStay, Omit<HotelStay, "id">>(
    qc,
    hotelKey,
    (input) => addHotelServerFn({ data: input }),
    (input) => ({ ...input, id: tempId() }),
  );

  const addAttachmentMutation = useOptimisticAdd<
    Attachment,
    {
      customerId: string;
      kind: AttachmentKind;
      refId?: string | undefined;
      name: string;
      mime: string;
      size: number;
      dataUrl: string;
    }
  >(
    qc,
    attachmentKey,
    (input) => createAttachmentFn({ data: input }),
    (input) => ({
      id: tempId(),
      customerId: input.customerId,
      kind: input.kind,
      refId: input.refId,
      name: input.name,
      mime: input.mime,
      size: input.size,
      url: input.dataUrl,
      uploadedAt: nowIsoDate(),
      uploadedBy: currentUser.name,
    }),
  );

  const removeAttachmentMutation = useMutation({
    mutationFn: (id: string) => removeAttachmentServerFn({ data: { id } }),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: attachmentKey });
      const prev = qc.getQueryData<Attachment[]>(attachmentKey);
      qc.setQueryData<Attachment[]>(attachmentKey, (old) => (old ?? []).filter((a) => a.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(attachmentKey, ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: attachmentKey }),
  });

  const addOpportunityMutation = useOptimisticAdd<Opportunity, Omit<Opportunity, "id">>(
    qc,
    opportunityKey,
    (input) => createOpportunityFn({ data: input }),
    (input) => ({ ...input, id: tempId() }),
  );

  const updateOpportunityMutation = useOptimisticPatch<
    Opportunity,
    { id: string; patch: Partial<Pick<Opportunity, "stage" | "followUpDate" | "lostReason" | "bookingId">> }
  >(
    qc,
    opportunityKey,
    (input) => updateOpportunityServerFn({ data: input }),
    (item, input) => ({ ...item, ...input.patch }),
  );

  const moveOpportunityMutation = useOptimisticPatch<Opportunity, { id: string; stage: Stage }>(
    qc,
    opportunityKey,
    (input) => moveOpportunityServerFn({ data: input }),
    (item, input) => ({ ...item, stage: input.stage }),
  );

  const addEmployeeMutation = useMutation({
    mutationFn: (input: Omit<Employee, "id"> & { password: string }) =>
      createAccountFn({
        data: {
          email: input.email,
          fullName: input.name,
          password: input.password,
          role: input.role,
        },
      }),
    onSettled: () => void qc.invalidateQueries({ queryKey: employeeKey }),
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: (input: {
      id: string;
      role?: Role;
      active?: boolean;
      permissions?: Permission[] | null;
    }) => updateEmployeeSettingsFn({ data: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: employeeKey });
      const prev = qc.getQueryData<Employee[]>(employeeKey);
      qc.setQueryData<Employee[]>(employeeKey, (old) =>
        (old ?? []).map((e) =>
          e.id === input.id
            ? {
                ...e,
                ...(input.role !== undefined ? { role: input.role } : {}),
                ...(input.active !== undefined ? { active: input.active } : {}),
                ...(input.permissions !== undefined
                  ? { permissions: input.permissions ?? undefined }
                  : {}),
              }
            : e,
        ),
      );
      return { prev };
    },
    onError: (_e, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(employeeKey, ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: employeeKey }),
  });

  const value = useMemo<CrmState>(() => {
    const employeeName = (id: string) => employees.find((e) => e.id === id)?.name ?? "—";
    const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";
    const packageName = (id: string) => packages.find((p) => p.id === id)?.name ?? "—";

    return {
      employees,
      packages,
      customers,
      bookings,
      tickets,
      hotelStays,
      payments,
      attachments,
      opportunities,
      currentUser,
      refreshAuth,
      can,
      scopedCustomers: customers,
      scopedBookings: bookings,
      scopedOpportunities: opportunities,
      addPackage: async (p) => {
        await addPackageMutation.mutateAsync(p);
      },
      updatePackage: async (id, p) => {
        await updatePackageMutation.mutateAsync({ id, patch: p });
      },
      addCustomer: async (c) => {
        const created = await addCustomerMutation.mutateAsync(c);
        return created.id;
      },
      addNote: async (customerId, text) => {
        await addNoteMutation.mutateAsync({ customerId, text });
      },
      addBooking: async (b) => {
        await addBookingMutation.mutateAsync(b);
      },
      setBookingStatus: async (id, status) => {
        await setBookingStatusMutation.mutateAsync({ id, status });
      },
      addTicket: async (t) => {
        await addTicketMutation.mutateAsync(t);
      },
      addHotelStay: async (h) => {
        await addHotelMutation.mutateAsync(h);
      },
      addPayment: async (p) => {
        await addPaymentMutation.mutateAsync(p);
      },
      addAttachment: async (a) => {
        await addAttachmentMutation.mutateAsync(a);
      },
      removeAttachment: async (id) => {
        await removeAttachmentMutation.mutateAsync(id);
      },
      moveOpportunity: async (id, stage) => {
        await moveOpportunityMutation.mutateAsync({ id, stage });
      },
      addOpportunity: async (o) => {
        await addOpportunityMutation.mutateAsync(o);
      },
      updateOpportunity: async (id, o) => {
        await updateOpportunityMutation.mutateAsync({ id, patch: o });
      },
      convertOpportunityToBooking: async (oppId, data) => {
        const result = await convertOppServerFn({ data: { opportunityId: oppId, ...data } });
        if ("error" in result) throw new Error(result.error);
        qc.setQueryData<Booking[]>(bookingKey, (old) => [result.booking, ...(old ?? [])]);
        void qc.invalidateQueries({ queryKey: bookingKey });
        void qc.invalidateQueries({ queryKey: opportunityKey });
        return result.ref;
      },
      addEmployee: async (e) => {
        await addEmployeeMutation.mutateAsync(e);
      },
      updateEmployee: async (id, e) => {
        const payload: { id: string; role?: Role; active?: boolean; permissions?: Permission[] | null } = {
          id,
        };
        if (e.role !== undefined) payload.role = e.role;
        if (e.active !== undefined) payload.active = e.active;
        // مفتاح "permissions" حاضر بقيمة undefined يعني "أعد الصلاحيات لصلاحيات الدور"
        // (يُرسل null صراحةً للخادم)، بينما غيابه يعني "لا تُغيّر الصلاحيات إطلاقًا".
        if ("permissions" in e) payload.permissions = e.permissions ?? null;
        await updateEmployeeMutation.mutateAsync(payload);
      },
      employeeName,
      customerName,
      packageName,
    };
  }, [
    employees,
    packages,
    customers,
    bookings,
    tickets,
    hotelStays,
    payments,
    attachments,
    opportunities,
    currentUser,
    can,
    refreshAuth,
    qc,
    addPackageMutation,
    updatePackageMutation,
    addCustomerMutation,
    addNoteMutation,
    addBookingMutation,
    setBookingStatusMutation,
    addPaymentMutation,
    addTicketMutation,
    addHotelMutation,
    addAttachmentMutation,
    removeAttachmentMutation,
    addOpportunityMutation,
    updateOpportunityMutation,
    moveOpportunityMutation,
    convertOppServerFn,
    addEmployeeMutation,
    updateEmployeeMutation,
  ]);

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm must be used inside CrmProvider");
  return ctx;
}

/* ---------------- Helpers ---------------- */

const LOCALE = "ar-EG-u-nu-latn";

/** يعزل النص ثنائي الاتجاه (أرقام/لاتيني داخل عربي) حتى لا ينقلب ترتيبه */
const rtlIsolate = (s: string) => `⁧${s}⁩`;
const ltrIsolate = (s: string) => `⁦${s}⁩`;

export const money = (n: number) =>
  rtlIsolate(new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(n) + " ج.م");

export const num = (n: number) => ltrIsolate(new Intl.NumberFormat(LOCALE).format(n));

export const arDate = (iso: string) =>
  rtlIsolate(
    new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(iso),
    ),
  );

export const monthlySales = (bookings: Booking[]) => {
  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر"];
  return months.map((label, i) => {
    const total = bookings
      .filter((b) => b.status !== "cancelled" && new Date(b.createdAt).getMonth() === i)
      .reduce((s, b) => s + b.amount, 0);
    return { month: label, total };
  });
};
