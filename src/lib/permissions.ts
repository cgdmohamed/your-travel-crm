/**
 * Pure role/permission data and logic — no React, no server-only imports.
 * Shared between the client (crm-data.tsx re-exports these) and server
 * function handlers (which import this directly to enforce owner-scoping /
 * permission checks without pulling React into the server bundle).
 */

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

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

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

export type PermissionCarrier = { role: Role; permissions?: Permission[] | undefined };

/** الصلاحيات الفعلية: المخصّصة إن وُجدت وإلا صلاحيات الدور */
export const effectivePermissions = (e: PermissionCarrier): Permission[] =>
  e.permissions ?? ROLE_PERMISSIONS[e.role];
