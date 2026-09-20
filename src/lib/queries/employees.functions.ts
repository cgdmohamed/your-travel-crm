import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth-middleware";
import { query } from "@/lib/db.server";
import type { Employee } from "@/lib/crm-data";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Employee["role"];
  active: boolean;
  permissions: Employee["permissions"] | null;
};

function toEmployee(u: UserRow): Employee {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    permissions: u.permissions ?? undefined,
  };
}

/** قائمة الموظفين (لأي مستخدم مسجّل دخول — تُستخدم لعرض المسؤولين في نماذج الحجز/الفرص) */
export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<Employee[]> => {
    const { rows } = await query<UserRow>(
      `select id, name, email, role, active, permissions from users order by created_at asc`,
    );
    return rows.map(toEmployee);
  });
