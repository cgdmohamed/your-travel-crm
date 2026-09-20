/**
 * Self-hosted JWT authentication — replaces Supabase Auth entirely.
 * Modeled after the sibling `oneclick` codebase's auth pattern:
 * bcrypt password hashing, short-lived access JWT + hashed refresh token
 * stored in the `refresh_tokens` table, explicit role/permission checks in
 * server-side code (no RLS to rely on).
 *
 * Server-only module.
 */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { query, queryOne } from "@/lib/db.server";
import type { Employee, Role } from "@/lib/crm-data";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_DAYS = 30;

function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

function getJwtRefreshSecret(): string {
  const secret = process.env["JWT_REFRESH_SECRET"];
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not set");
  return secret;
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  active: boolean;
  permissions: string[] | null;
};

export function toEmployee(u: UserRow): Employee {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    permissions: (u.permissions ?? undefined) as Employee["permissions"],
  };
}

function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: ACCESS_TOKEN_TTL });
}

async function issueRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  await query(
    `insert into refresh_tokens (user_id, token_hash, expires_at)
     values ($1, $2, now() + interval '${REFRESH_TOKEN_TTL_DAYS} days')`,
    [userId, tokenHash],
  );
  // Sign a JWT wrapper around the opaque token so it can be verified cheaply
  // before hitting the DB, while the DB row remains the source of truth for revocation.
  return jwt.sign({ sub: userId, t: "r", tok: token }, getJwtRefreshSecret(), {
    expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d`,
  });
}

export type LoginResult =
  | { ok: true; accessToken: string; refreshToken: string; user: Employee }
  | { ok: false; message: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await queryOne<UserRow>(
    `select id, email, password_hash, name, role, active, permissions
     from users where email = $1`,
    [email.trim().toLowerCase()],
  );
  if (!user) return { ok: false, message: "بيانات الدخول غير صحيحة" };
  if (!user.active) return { ok: false, message: "هذا الحساب معطّل" };

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return { ok: false, message: "بيانات الدخول غير صحيحة" };

  const accessToken = signAccessToken(user.id);
  const refreshToken = await issueRefreshToken(user.id);
  return { ok: true, accessToken, refreshToken, user: toEmployee(user) };
}

export async function refresh(
  refreshToken: string,
): Promise<{ ok: true; accessToken: string } | { ok: false; message: string }> {
  let payload: { sub: string; tok: string };
  try {
    payload = jwt.verify(refreshToken, getJwtRefreshSecret()) as { sub: string; tok: string };
  } catch {
    return { ok: false, message: "الجلسة منتهية، الرجاء تسجيل الدخول مجددًا" };
  }
  const row = await queryOne<{ id: string; revoked: boolean; expires_at: string }>(
    `select id, revoked, expires_at from refresh_tokens where token_hash = $1`,
    [sha256(payload.tok)],
  );
  if (!row || row.revoked || new Date(row.expires_at) < new Date()) {
    return { ok: false, message: "الجلسة منتهية، الرجاء تسجيل الدخول مجددًا" };
  }
  return { ok: true, accessToken: signAccessToken(payload.sub) };
}

export async function logout(refreshToken: string): Promise<void> {
  let payload: { tok: string };
  try {
    payload = jwt.verify(refreshToken, getJwtRefreshSecret()) as { tok: string };
  } catch {
    return;
  }
  await query(`update refresh_tokens set revoked = true where token_hash = $1`, [
    sha256(payload.tok),
  ]);
}

/** Verifies an access token and returns the current user, or null. */
export async function currentUserFromAccessToken(
  accessToken: string | undefined,
): Promise<Employee | null> {
  if (!accessToken) return null;
  let payload: { sub: string };
  try {
    payload = jwt.verify(accessToken, getJwtSecret()) as { sub: string };
  } catch {
    return null;
  }
  const user = await queryOne<UserRow>(
    `select id, email, password_hash, name, role, active, permissions
     from users where id = $1`,
    [payload.sub],
  );
  if (!user || !user.active) return null;
  return toEmployee(user);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/** True only when the users table is empty — gates the first-admin bootstrap flow. */
export async function hasZeroUsers(): Promise<boolean> {
  const row = await queryOne<{ count: string }>(`select count(*)::text as count from users`);
  return (row?.count ?? "0") === "0";
}
