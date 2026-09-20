/**
 * Server-only helpers shared by every entity query/mutation module under
 * src/lib/queries/. Kept separate from src/lib/permissions.ts (pure, no DB)
 * so that module can stay importable from client code without pulling `pg`.
 */
import { queryOne } from "@/lib/db.server";
import { ROLE_PERMISSIONS, type Permission, type Role } from "@/lib/permissions";

/**
 * True when this user's *effective* permissions (role defaults, or a custom
 * per-user override in users.permissions) do NOT include "reports.all" —
 * meaning list/read queries for customers/bookings/opportunities must be
 * restricted to rows this user owns. Mirrors crm-data.tsx's ROLE_PERMISSIONS
 * exactly (currently: only "agent" lacks reports.all) instead of hardcoding
 * a role check, so a future custom-permission grant/revoke is respected too.
 */
export async function isOwnerScoped(userId: string, role: Role): Promise<boolean> {
  const row = await queryOne<{ permissions: Permission[] | null }>(
    `select permissions from users where id = $1`,
    [userId],
  );
  const perms = row?.permissions ?? ROLE_PERMISSIONS[role];
  return !perms.includes("reports.all");
}

export function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

/**
 * Formats a Postgres date/timestamp column as "YYYY-MM-DD". node-postgres
 * parses `date`/`timestamp[tz]` columns into native JS `Date` objects by
 * default (NOT strings) -- using `.toISOString()` (UTC) rather than
 * re-slicing a string keeps this correct regardless of which driver
 * behavior a given column ends up with.
 */
export function toDateStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return "";
}
