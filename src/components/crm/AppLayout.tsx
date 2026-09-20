import { Link, useNavigate } from "@tanstack/react-router";
import { logout } from "@/lib/auth";
import {
  Activity,
  MessageCircle,
  LayoutDashboard,
  Package,
  Users,
  CalendarCheck,
  Target,
  UserCog,
  BarChart3,
  Plane,
  Bell,
  Settings,
  CalendarDays,
  LogOut,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useCrm, ROLE_LABELS, type Permission } from "@/lib/crm-data";
import { useSettings } from "@/lib/settings";
import { GlobalSearch } from "@/components/crm/GlobalSearch";
import { QuickActions } from "@/components/crm/QuickActions";

const NAV: { to: string; label: string; icon: typeof Package; perm: Permission }[] = [
  { to: "/", label: "لوحة المؤشرات", icon: LayoutDashboard, perm: "packages.view" },
  { to: "/packages", label: "الباقات السياحية", icon: Package, perm: "packages.view" },
  { to: "/customers", label: "العملاء", icon: Users, perm: "customers.view" },
  { to: "/bookings", label: "الحجوزات والمبيعات", icon: CalendarCheck, perm: "bookings.view" },
  { to: "/pipeline", label: "الفرص والمتابعات", icon: Target, perm: "pipeline.view" },
  { to: "/whatsapp", label: "واتساب", icon: MessageCircle, perm: "customers.view" },
  { to: "/marketing", label: "تتبّع Meta", icon: Activity, perm: "reports.view" },
  { to: "/reports", label: "التقارير", icon: BarChart3, perm: "reports.view" },
  { to: "/team", label: "الموظفون والصلاحيات", icon: UserCog, perm: "team.view" },
  { to: "/settings", label: "الإعدادات", icon: Settings, perm: "team.view" },
];

export function AppLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { can, currentUser, refreshAuth } = useCrm();
  const navigate = useNavigate();
  const { settings } = useSettings();
  // يُحسب التاريخ بعد الترطيب حتى لا يختلف نص الخادم عن المتصفح (فرق التوقيت)
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(
      new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    );
  }, []);

  return (
    <div className="flex min-h-screen bg-background" dir="rtl">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <span className="flex size-10 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
            <Plane className="size-5" />
          </span>
          <div>
            <p className="text-base font-bold leading-tight">{settings.companyName}</p>
            <p className="text-xs text-sidebar-foreground/85">{settings.companyTagline}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-5">
          {NAV.filter((i) => can(i.perm)).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground data-[status=active]:shadow-sm"
            >
              <item.icon className="size-4.5" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
              {currentUser.name.slice(0, 1)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="w-full truncate text-right text-sm font-bold text-sidebar-foreground">
                {currentUser.name}
              </span>
              <span className="text-xs text-sidebar-foreground/75">
                {ROLE_LABELS[currentUser.role]}
              </span>
            </div>
            <button
              type="button"
              title="تسجيل الخروج"
              onClick={() => {
                void (async () => {
                  await logout();
                  await refreshAuth();
                  toast.success("تم تسجيل الخروج");
                  void navigate({ to: "/auth", replace: true });
                })();
              }}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center gap-4 border-b bg-card/95 px-5 py-3 shadow-sm backdrop-blur">
          <div className="min-w-0 flex-1 sm:max-w-md">
            <GlobalSearch />
          </div>
          <QuickActions />
          <div className="mr-auto hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
            <CalendarDays className="size-4" />
            <span>{today}</span>
          </div>
          <span className="relative flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground" title="الإشعارات">
            <Bell className="size-4" />
            <span className="absolute -left-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">3</span>
          </span>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b bg-card px-3 py-2 md:hidden">
          {NAV.filter((i) => can(i.perm)).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground data-[status=active]:bg-secondary data-[status=active]:text-secondary-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 p-4 sm:p-6">
          <div className="mb-5">
            <h1 className="text-2xl font-extrabold text-foreground">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
