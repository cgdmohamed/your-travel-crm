import { trackMeta } from "@/lib/meta-track";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from "react";

/* ---------------- Types ---------------- */

export type Role = "admin" | "sales_manager" | "agent" | "accountant";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير النظام",
  sales_manager: "مدير مبيعات",
  agent: "موظف مبيعات",
  accountant: "محاسب",
};

export type Permission =
  | "packages.view"
  | "packages.edit"
  | "customers.view"
  | "customers.edit"
  | "bookings.view"
  | "bookings.edit"
  | "pipeline.view"
  | "pipeline.edit"
  | "team.view"
  | "team.edit"
  | "reports.view"
  | "reports.all";

export const PERMISSION_LABELS: Record<Permission, string> = {
  "packages.view": "عرض الباقات",
  "packages.edit": "تعديل الباقات",
  "customers.view": "عرض العملاء",
  "customers.edit": "تعديل العملاء",
  "bookings.view": "عرض الحجوزات",
  "bookings.edit": "تعديل الحجوزات والتحصيل",
  "pipeline.view": "عرض الفرص",
  "pipeline.edit": "تعديل الفرص",
  "team.view": "عرض الموظفين",
  "team.edit": "إدارة الموظفين والصلاحيات",
  "reports.view": "عرض تقاريره الشخصية",
  "reports.all": "عرض تقارير كل الفريق",
};

export const PERMISSION_GROUPS: { title: string; items: Permission[] }[] = [
  { title: "الباقات", items: ["packages.view", "packages.edit"] },
  { title: "العملاء", items: ["customers.view", "customers.edit"] },
  { title: "الحجوزات والتحصيل", items: ["bookings.view", "bookings.edit"] },
  { title: "الفرص", items: ["pipeline.view", "pipeline.edit"] },
  { title: "التقارير", items: ["reports.view", "reports.all"] },
  { title: "الموظفون", items: ["team.view", "team.edit"] },
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "packages.view",
    "packages.edit",
    "customers.view",
    "customers.edit",
    "bookings.view",
    "bookings.edit",
    "pipeline.view",
    "pipeline.edit",
    "team.view",
    "team.edit",
    "reports.view",
    "reports.all",
  ],
  sales_manager: [
    "packages.view",
    "packages.edit",
    "customers.view",
    "customers.edit",
    "bookings.view",
    "bookings.edit",
    "pipeline.view",
    "pipeline.edit",
    "team.view",
    "reports.view",
    "reports.all",
  ],
  agent: [
    "packages.view",
    "customers.view",
    "customers.edit",
    "bookings.view",
    "bookings.edit",
    "pipeline.view",
    "pipeline.edit",
    "reports.view",
  ],
  accountant: ["packages.view", "customers.view", "bookings.view", "reports.view", "reports.all"],
};

export type Employee = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  /** صلاحيات مخصّصة يضبطها المدير؛ عند غيابها تُستخدم صلاحيات الدور */
  permissions?: Permission[] | undefined;
};

/** الصلاحيات الفعلية للموظف: المخصّصة إن وُجدت وإلا صلاحيات دوره */
export const effectivePermissions = (e: Employee): Permission[] =>
  e.permissions ?? ROLE_PERMISSIONS[e.role];

export type PackageStatus = "available" | "full" | "ended";

export const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
  available: "متاحة",
  full: "مكتملة",
  ended: "منتهية",
};

export type PackageCategory =
  | "flight"
  | "hotel"
  | "shared"
  | "full"
  | "cruise"
  | "visa";

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
  wpId?: number;
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

export const PIPELINE_STAGES: Stage[] = [
  "new",
  "contacted",
  "quote",
  "negotiation",
  "won",
  "lost",
];

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

/* ---------------- Seed data ---------------- */

const employees: Employee[] = [
  { id: "e1", name: "سارة فهمي", email: "sara@tawaf-travel.com", role: "admin", active: true },
  { id: "e2", name: "خالد المصري", email: "khaled@tawaf-travel.com", role: "sales_manager", active: true },
  { id: "e3", name: "منى عبد الله", email: "mona@tawaf-travel.com", role: "agent", active: true },
  { id: "e4", name: "يوسف ناصر", email: "yousef@tawaf-travel.com", role: "agent", active: true },
  { id: "e5", name: "أحمد فؤاد", email: "ahmed@tawaf-travel.com", role: "accountant", active: true },
  { id: "e6", name: "ليلى سامي", email: "laila@tawaf-travel.com", role: "agent", active: false },
];

const packages: TourPackage[] = [
  {
    id: "p1",
    name: "عمرة رمضان – 10 ليالٍ",
    destination: "مكة والمدينة",
    nights: 10,
    price: 62000,
    seats: 60,
    seatsTaken: 47,
    status: "available",
    category: "full",
    roomBasis: "quad",
    image: null,
    wpId: 1201,
    wpSlug: "umrah-ramadan-10-nights",
    includes: [
      "تذاكر طيران ذهاب وعودة من القاهرة",
      "إقامة 10 ليالٍ بفنادق قريبة من الحرم",
      "وجبة إفطار وسحور يومياً",
      "تأشيرة العمرة والتأمين الصحي",
      "مواصلات داخلية بين مكة والمدينة",
    ],
    excludes: ["المصروفات الشخصية", "الهدي والأضاحي", "الوجبات خارج البرنامج"],
  },
  {
    id: "p2",
    name: "سحر إسطنبول وبورصة",
    destination: "تركيا",
    nights: 7,
    price: 48000,
    seats: 40,
    seatsTaken: 40,
    status: "full",
    category: "full",
    roomBasis: "double",
    image: null,
    wpId: 1202,
    wpSlug: "istanbul-bursa-7-nights",
    includes: [
      "طيران مباشر القاهرة – إسطنبول",
      "إقامة 7 ليالٍ فندق 4 نجوم مع الإفطار",
      "جولة بحرية في البسفور",
      "رحلة يوم كامل إلى بورصة",
      "استقبال وتوديع بالمطار",
    ],
    excludes: ["تأشيرة تركيا", "وجبات الغداء والعشاء", "الجولات الاختيارية"],
  },
  {
    id: "p3",
    name: "جزر المالديف – شهر عسل",
    destination: "المالديف",
    nights: 5,
    price: 145000,
    seats: 20,
    seatsTaken: 9,
    status: "available",
    category: "hotel",
    roomBasis: "double",
    image: null,
    wpId: 1203,
    wpSlug: "maldives-honeymoon-5-nights",
    includes: [
      "إقامة 5 ليالٍ في فيلا مائية",
      "نظام الإقامة الكاملة (All Inclusive)",
      "انتقالات بالقارب السريع من وإلى المطار",
      "ديكور وعشاء رومانسي للعرسان",
    ],
    excludes: ["تذاكر الطيران الدولية", "الأنشطة المائية المدفوعة", "السبا والعلاجات"],
  },
  {
    id: "p4",
    name: "جورجيا الخضراء",
    destination: "جورجيا",
    nights: 6,
    price: 41000,
    seats: 35,
    seatsTaken: 21,
    status: "available",
    category: "shared",
    roomBasis: "triple",
    image: null,
    wpId: 1204,
    wpSlug: "green-georgia-6-nights",
    includes: [
      "طيران القاهرة – تبليسي",
      "إقامة مشتركة 6 ليالٍ مع الإفطار",
      "جولات يومية بالحافلة مع مرشد عربي",
      "رحلة إلى كازبيجي وبورجومي",
    ],
    excludes: ["تذاكر دخول الأماكن السياحية", "الوجبات الرئيسية", "البقشيش"],
  },
  {
    id: "p5",
    name: "سفاري شرم الشيخ",
    destination: "شرم الشيخ",
    nights: 4,
    price: 18000,
    seats: 50,
    seatsTaken: 50,
    status: "ended",
    category: "hotel",
    roomBasis: "double",
    image: null,
    wpId: 1205,
    wpSlug: "sharm-safari-4-nights",
    includes: [
      "إقامة 4 ليالٍ نظام الكل شامل",
      "انتقالات من وإلى مطار شرم الشيخ",
      "رحلة سفاري صحراوية مع عشاء بدوي",
      "رحلة غطس في رأس محمد",
    ],
    excludes: ["تذاكر الطيران الداخلية", "المشروبات المستوردة", "المصروفات الشخصية"],
  },
  {
    id: "p6",
    name: "باريس وديزني للعائلات",
    destination: "فرنسا",
    nights: 8,
    price: 175000,
    seats: 25,
    seatsTaken: 12,
    status: "available",
    category: "flight",
    roomBasis: "quad",
    image: null,
    wpId: 1206,
    wpSlug: "paris-disney-family-8-nights",
    includes: [
      "طيران القاهرة – باريس ذهاب وعودة",
      "إقامة 8 ليالٍ فندق عائلي مع الإفطار",
      "تذاكر يومين ديزني لاند باريس",
      "جولة مدينة باريس ونهر السين",
    ],
    excludes: ["تأشيرة شنغن", "الوجبات داخل ديزني", "تذاكر القطار السريع"],
  },
];

const customers: Customer[] = [
  { id: "c1", name: "عبد الرحمن عبد العزيز", phone: "01012345678", email: "a.abdelaziz@mail.com", city: "القاهرة", source: "whatsapp", ownerId: "e3", notes: [{ id: "n1", date: "2026-09-10", text: "يفضل السفر في إجازة منتصف العام مع العائلة.", author: "منى عبد الله" }] },
  { id: "c2", name: "نورهان الشربيني", phone: "01198765432", email: "nourhan@mail.com", city: "الإسكندرية", source: "website", ownerId: "e4", notes: [{ id: "n2", date: "2026-09-12", text: "طلبت عرض سعر لشهر العسل في المالديف.", author: "يوسف ناصر" }] },
  { id: "c3", name: "محمد الغنيمي", phone: "01221122334", email: "m.ghoneimy@mail.com", city: "الجيزة", source: "direct", ownerId: "e3", notes: [] },
  { id: "c4", name: "هند القاضي", phone: "01033344556", email: "hind@mail.com", city: "المنصورة", source: "whatsapp", ownerId: "e4", notes: [{ id: "n3", date: "2026-09-14", text: "تواصلت عبر واتساب وتسأل عن باقة جورجيا.", author: "يوسف ناصر" }] },
  { id: "c5", name: "فيصل عبد الحميد", phone: "01144455667", email: "faisal@mail.com", city: "طنطا", source: "website", ownerId: "e2", notes: [] },
  { id: "c6", name: "ريم السيد", phone: "01266677889", email: "reem@mail.com", city: "أسيوط", source: "whatsapp", ownerId: "e3", notes: [] },
];

const bookings: Booking[] = [
  { id: "b1", time: "10:20", ref: "BK-1041", customerId: "c1", packageId: "p1", travelDate: "2026-10-02", pax: 4, amount: 248000, paid: 248000, status: "paid", ownerId: "e3", createdAt: "2026-09-01" },
  { id: "b2", time: "13:45", ref: "BK-1042", customerId: "c2", packageId: "p3", travelDate: "2026-11-15", pax: 2, amount: 290000, paid: 100000, status: "confirmed", ownerId: "e4", createdAt: "2026-09-04" },
  { id: "b3", time: "09:10", ref: "BK-1043", customerId: "c3", packageId: "p4", travelDate: "2026-10-20", pax: 3, amount: 123000, paid: 0, status: "draft", ownerId: "e3", createdAt: "2026-09-08" },
  { id: "b4", time: "17:30", ref: "BK-1044", customerId: "c4", packageId: "p2", travelDate: "2026-09-28", pax: 2, amount: 96000, paid: 96000, status: "paid", ownerId: "e4", createdAt: "2026-08-22" },
  { id: "b5", time: "11:05", ref: "BK-1045", customerId: "c5", packageId: "p6", travelDate: "2026-12-05", pax: 5, amount: 875000, paid: 300000, status: "confirmed", ownerId: "e2", createdAt: "2026-09-11" },
  { id: "b6", time: "20:40", ref: "BK-1046", customerId: "c6", packageId: "p1", travelDate: "2026-10-02", pax: 1, amount: 62000, paid: 0, status: "cancelled", ownerId: "e3", createdAt: "2026-07-30" },
  { id: "b7", time: "15:15", ref: "BK-1047", customerId: "c1", packageId: "p4", travelDate: "2026-08-10", pax: 2, amount: 82000, paid: 82000, status: "paid", ownerId: "e3", createdAt: "2026-07-12" },
  { id: "b8", time: "12:00", ref: "BK-1048", customerId: "c2", packageId: "p2", travelDate: "2026-07-18", pax: 2, amount: 96000, paid: 96000, status: "paid", ownerId: "e4", createdAt: "2026-06-25" },
];

const tickets: Ticket[] = [
  { id: "t1", bookingId: "b1", customerId: "c1", passenger: "عبد الرحمن عبد العزيز", airline: "مصر للطيران", flightNo: "MS 651", route: "القاهرة → جدة", departDate: "2026-10-02", returnDate: "2026-10-12", pnr: "MS7QK2", cabin: "economy", price: 14500, status: "issued" },
  { id: "t2", bookingId: "b1", customerId: "c1", passenger: "سلمى عبد الرحمن", airline: "مصر للطيران", flightNo: "MS 651", route: "القاهرة → جدة", departDate: "2026-10-02", returnDate: "2026-10-12", pnr: "MS7QK2", cabin: "economy", price: 14500, status: "issued" },
  { id: "t3", bookingId: "b2", customerId: "c2", passenger: "نورهان الشربيني", airline: "الاتحاد للطيران", flightNo: "EY 654", route: "القاهرة → ماليه", departDate: "2026-11-15", returnDate: "2026-11-21", pnr: "EY3LM9", cabin: "business", price: 42000, status: "pending" },
  { id: "t4", bookingId: "b4", customerId: "c4", passenger: "هند القاضي", airline: "الخطوط التركية", flightNo: "TK 693", route: "القاهرة → إسطنبول", departDate: "2026-09-28", returnDate: "2026-10-05", pnr: "TK8PR1", cabin: "economy", price: 12800, status: "issued" },
  { id: "t5", bookingId: "b5", customerId: "c5", passenger: "فيصل عبد الحميد", airline: "إير فرانس", flightNo: "AF 571", route: "القاهرة → باريس", departDate: "2026-12-05", returnDate: "2026-12-13", pnr: "AF5XD4", cabin: "economy", price: 23000, status: "pending" },
];

const hotels: HotelStay[] = [
  { id: "h1", bookingId: "b1", customerId: "c1", hotel: "فندق دار التوحيد إنتركونتيننتال", city: "مكة المكرمة", roomBasis: "quad", board: "hb", checkIn: "2026-10-02", checkOut: "2026-10-08", rooms: 1, guests: 4, confirmationNo: "HTL-55120", price: 68000 },
  { id: "h2", bookingId: "b1", customerId: "c1", hotel: "فندق المدينة موفنبيك", city: "المدينة المنورة", roomBasis: "quad", board: "bb", checkIn: "2026-10-08", checkOut: "2026-10-12", rooms: 1, guests: 4, confirmationNo: "HTL-55121", price: 41000 },
  { id: "h3", bookingId: "b2", customerId: "c2", hotel: "Sun Siyam Iru Fushi", city: "المالديف", roomBasis: "double", board: "ai", checkIn: "2026-11-15", checkOut: "2026-11-20", rooms: 1, guests: 2, confirmationNo: "HTL-77340", price: 190000 },
  { id: "h4", bookingId: "b4", customerId: "c4", hotel: "Golden Age Hotel Taksim", city: "إسطنبول", roomBasis: "double", board: "bb", checkIn: "2026-09-28", checkOut: "2026-10-05", rooms: 1, guests: 2, confirmationNo: "HTL-31022", price: 36000 },
  { id: "h5", bookingId: "b5", customerId: "c5", hotel: "Novotel Paris Est", city: "باريس", roomBasis: "quad", board: "bb", checkIn: "2026-12-05", checkOut: "2026-12-13", rooms: 2, guests: 5, confirmationNo: "HTL-90811", price: 420000 },
];

const payments: Payment[] = [
  { id: "pay1", time: "09:40", bookingId: "b1", customerId: "c1", date: "2026-09-01", amount: 120000, method: "bank", reference: "TRX-88120", collectedBy: "e5" },
  { id: "pay2", time: "14:20", bookingId: "b1", customerId: "c1", date: "2026-09-12", amount: 128000, method: "instapay", reference: "IP-4471", collectedBy: "e5" },
  { id: "pay3", time: "11:15", bookingId: "b2", customerId: "c2", date: "2026-09-05", amount: 100000, method: "card", reference: "VISA-2031", collectedBy: "e5" },
  { id: "pay4", time: "18:05", bookingId: "b4", customerId: "c4", date: "2026-08-25", amount: 96000, method: "cash", reference: "REC-1180", collectedBy: "e5" },
  { id: "pay5", time: "10:50", bookingId: "b5", customerId: "c5", date: "2026-09-11", amount: 300000, method: "bank", reference: "TRX-88455", collectedBy: "e5" },
  { id: "pay6", time: "16:35", bookingId: "b7", customerId: "c1", date: "2026-07-12", amount: 82000, method: "wallet", reference: "WL-6620", collectedBy: "e5" },
  { id: "pay7", time: "21:10", bookingId: "b8", customerId: "c2", date: "2026-06-25", amount: 96000, method: "cash", reference: "REC-1044", collectedBy: "e5" },
];

const opportunities: Opportunity[] = [
  { id: "o1", title: "رحلة عائلية لجورجيا", customerId: "c4", packageId: "p4", value: 123000, stage: "new", ownerId: "e4", followUpDate: "2026-09-19", source: "whatsapp" },
  { id: "o2", title: "عمرة لمجموعة من 6 أفراد", customerId: "c6", packageId: "p1", value: 372000, stage: "contacted", ownerId: "e3", followUpDate: "2026-09-19", source: "whatsapp" },
  { id: "o3", title: "شهر عسل في المالديف", customerId: "c2", packageId: "p3", value: 290000, stage: "quote", ownerId: "e4", followUpDate: "2026-09-21", source: "website" },
  { id: "o4", title: "باريس للعائلة", customerId: "c5", packageId: "p6", value: 875000, stage: "negotiation", ownerId: "e2", followUpDate: "2026-09-20", source: "website" },
  { id: "o5", title: "إسطنبول لشخصين", customerId: "c3", packageId: "p2", value: 96000, stage: "won", ownerId: "e3", followUpDate: "2026-09-15", source: "direct" },
  { id: "o6", title: "استفسار عمرة فردي", customerId: "c1", packageId: "p1", value: 62000, stage: "contacted", ownerId: "e3", followUpDate: "2026-09-22", source: "whatsapp" },
];

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
  dataUrl: string;
  uploadedAt: string;
  uploadedBy: string;
};

/* ---------------- Store ---------------- */


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
  setCurrentUserId: (id: string) => void;
  can: (p: Permission) => boolean;
  scopedCustomers: Customer[];
  scopedBookings: Booking[];
  scopedOpportunities: Opportunity[];
  addPackage: (p: Omit<TourPackage, "id">) => void;
  updatePackage: (id: string, p: Partial<TourPackage>) => void;
  addCustomer: (c: Omit<Customer, "id" | "notes">) => string;
  addNote: (customerId: string, text: string) => void;
  addBooking: (b: Omit<Booking, "id" | "ref" | "createdAt">) => void;
  setBookingStatus: (id: string, status: BookingStatus) => void;
  addTicket: (t: Omit<Ticket, "id">) => void;
  addHotelStay: (h: Omit<HotelStay, "id">) => void;
  addPayment: (p: Omit<Payment, "id" | "collectedBy">) => void;
  addAttachment: (a: Omit<Attachment, "id" | "uploadedAt" | "uploadedBy">) => void;
  removeAttachment: (id: string) => void;
  moveOpportunity: (id: string, stage: Stage) => void;
  addOpportunity: (o: Omit<Opportunity, "id">) => void;
  updateOpportunity: (id: string, o: Partial<Opportunity>) => void;
  convertOpportunityToBooking: (
    oppId: string,
    data: { travelDate: string; pax: number; amount: number; paid: number },
  ) => string;
  addEmployee: (e: Omit<Employee, "id">) => void;
  updateEmployee: (id: string, e: Partial<Employee>) => void;
  employeeName: (id: string) => string;
  customerName: (id: string) => string;
  packageName: (id: string) => string;
};

// Shared across duplicate module instances (HMR / route code-splitting)
const g = globalThis as unknown as { __crmContext?: Context<CrmState | null> };
const CrmContext = (g.__crmContext ??= createContext<CrmState | null>(null));

const uid = () => Math.random().toString(36).slice(2, 9);

const nowTime = () =>
  `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;

export function CrmProvider({ children }: { children: ReactNode }) {
  const [team, setTeam] = useState<Employee[]>(employees);
  const [pkgs, setPkgs] = useState<TourPackage[]>(packages);
  const [custs, setCusts] = useState<Customer[]>(customers);
  const [books, setBooks] = useState<Booking[]>(bookings);
  const [tks, setTks] = useState<Ticket[]>(tickets);
  const [stays, setStays] = useState<HotelStay[]>(hotels);
  const [pays, setPays] = useState<Payment[]>(payments);
  const [opps, setOpps] = useState<Opportunity[]>(opportunities);
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [currentUserId, setCurrentUserId] = useState("e1");

  const currentUser = team.find((e) => e.id === currentUserId) ?? team[0]!;

  const can = useCallback(
    (p: Permission) => effectivePermissions(currentUser).includes(p),
    [currentUser],
  );

  // الموظف الذي لا يملك «تقارير كل الفريق» يرى بياناته فقط
  const onlyOwn = !effectivePermissions(currentUser).includes("reports.all");

  const value = useMemo<CrmState>(() => {
    const employeeName = (id: string) => team.find((e) => e.id === id)?.name ?? "—";
    const customerName = (id: string) => custs.find((c) => c.id === id)?.name ?? "—";
    const packageName = (id: string) => pkgs.find((p) => p.id === id)?.name ?? "—";

    return {
      employees: team,
      packages: pkgs,
      customers: custs,
      bookings: books,
      tickets: tks,
      hotelStays: stays,
      payments: pays,
      attachments: atts,
      opportunities: opps,
      currentUser,
      setCurrentUserId,
      can,
      scopedCustomers: onlyOwn ? custs.filter((c) => c.ownerId === currentUser.id) : custs,
      scopedBookings: onlyOwn ? books.filter((b) => b.ownerId === currentUser.id) : books,
      scopedOpportunities: onlyOwn ? opps.filter((o) => o.ownerId === currentUser.id) : opps,
      addPackage: (p) => setPkgs((prev) => [{ ...p, id: uid() }, ...prev]),
      updatePackage: (id, p) =>
        setPkgs((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x))),
      addCustomer: (c) => {
        const id = uid();
        setCusts((prev) => [{ ...c, id, notes: [] }, ...prev]);
        trackMeta({
          eventName: "Lead",
          customerId: id,
          customerName: c.name,
          phone: c.phone,
          email: c.email,
          city: c.city,
          sentBy: currentUser.name,
        });
        return id;
      },
      addNote: (customerId, text) =>
        setCusts((prev) =>
          prev.map((c) =>
            c.id === customerId
              ? {
                  ...c,
                  notes: [
                    {
                      id: uid(),
                      date: new Date().toISOString().slice(0, 10),
                      text,
                      author: currentUser.name,
                    },
                    ...c.notes,
                  ],
                }
              : c,
          ),
        ),
      addBooking: (b) =>
        setBooks((prev) => [
          {
            ...b,
            id: uid(),
            ref: `BK-${1049 + prev.length}`,
            createdAt: new Date().toISOString().slice(0, 10),
            time: nowTime(),
          },
          ...prev,
        ]),
      setBookingStatus: (id, status) =>
        setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b))),
      addTicket: (t) => setTks((prev) => [{ ...t, id: uid() }, ...prev]),
      addHotelStay: (h) => setStays((prev) => [{ ...h, id: uid() }, ...prev]),
      addPayment: (p) => {
        setPays((prev) => [{ time: nowTime(), ...p, id: uid(), collectedBy: currentUser.id }, ...prev]);
        const bk = books.find((b) => b.id === p.bookingId);
        const cust = bk ? custs.find((c) => c.id === bk.customerId) : undefined;
        trackMeta({
          eventName: "Purchase",
          customerId: cust?.id,
          customerName: cust?.name,
          phone: cust?.phone,
          email: cust?.email,
          city: cust?.city,
          value: p.amount,
          sentBy: currentUser.name,
        });
        setBooks((prev) =>
          prev.map((b) => {
            if (b.id !== p.bookingId) return b;
            const paid = b.paid + p.amount;
            return { ...b, paid, status: paid >= b.amount ? "paid" : b.status };
          }),
        );
      },
      addAttachment: (a) =>
        setAtts((prev) => [
          {
            ...a,
            id: uid(),
            uploadedAt: new Date().toISOString().slice(0, 10),
            uploadedBy: currentUser.name,
          },
          ...prev,
        ]),
      removeAttachment: (id) => setAtts((prev) => prev.filter((a) => a.id !== id)),
      moveOpportunity: (id, stage) =>
        setOpps((prev) => prev.map((o) => (o.id === id ? { ...o, stage } : o))),
      addOpportunity: (o) => setOpps((prev) => [{ ...o, id: uid() }, ...prev]),
      updateOpportunity: (id, o) =>
        setOpps((prev) => prev.map((x) => (x.id === id ? { ...x, ...o } : x))),
      convertOpportunityToBooking: (oppId, data) => {
        const opp = opps.find((o) => o.id === oppId);
        if (!opp) return "";
        const id = uid();
        const ref = `BK-${1049 + books.length}`;
        const booking: Booking = {
          id,
          ref,
          customerId: opp.customerId,
          packageId: opp.packageId,
          travelDate: data.travelDate,
          pax: data.pax,
          amount: data.amount,
          paid: data.paid,
          status: data.paid >= data.amount ? "paid" : data.paid > 0 ? "confirmed" : "draft",
          ownerId: opp.ownerId,
          createdAt: new Date().toISOString().slice(0, 10),
          time: nowTime(),
        };
        setBooks((prev) => [booking, ...prev]);
        setOpps((prev) =>
          prev.map((o) => (o.id === oppId ? { ...o, stage: "won", bookingId: id } : o)),
        );
        return ref;
      },
      addEmployee: (e) => setTeam((prev) => [...prev, { ...e, id: uid() }]),
      updateEmployee: (id, e) =>
        setTeam((prev) => prev.map((x) => (x.id === id ? { ...x, ...e } : x))),
      employeeName,
      customerName,
      packageName,
    };
  }, [team, pkgs, custs, books, opps, tks, stays, pays, atts, currentUser, can, onlyOwn]);

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
