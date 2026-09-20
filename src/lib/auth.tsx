import { useCallback, useEffect, useState } from "react";
import type { Employee, Role } from "@/lib/crm-data";

export type AppRole = Role;

export type AuthProfile = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
};

async function fetchMe(): Promise<Employee | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  const body = (await res.json()) as { user: Employee | null };
  return body.user;
}

/** حالة جلسة المستخدم الحالية مع ملفه الشخصي ودوره — عبر الـJWT الذاتي (بدون Supabase) */
export function useAuth() {
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const user = await fetchMe();
    setProfile(
      user
        ? { id: user.id, full_name: user.name, email: user.email, role: user.role }
        : null,
    );
  }, []);

  useEffect(() => {
    void reload().finally(() => setLoading(false));
  }, [reload]);

  return { profile, loading, reload };
}

export async function login(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok: boolean;
    message?: string;
    user?: Employee;
  };
  return body;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}
