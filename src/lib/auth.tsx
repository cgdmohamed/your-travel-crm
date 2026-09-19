import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "sales_manager" | "agent" | "accountant";

export type AuthProfile = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
};

/** حالة جلسة المستخدم الحالية مع ملفه الشخصي ودوره */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (id: string, email: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").eq("id", id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", id).limit(1).maybeSingle(),
    ]);
    setProfile({
      id,
      full_name: p?.full_name || email.split("@")[0] || "مستخدم",
      email: p?.email || email,
      role: (r?.role as AppRole | undefined) ?? "agent",
    });
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (!s?.user) setProfile(null);
      else void loadProfile(s.user.id, s.user.email ?? "");
    });
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        void loadProfile(data.session.user.id, data.session.user.email ?? "");
      }
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  return { session, user, profile, loading };
}
