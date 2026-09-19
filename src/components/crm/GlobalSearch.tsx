import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { money, useCrm } from "@/lib/crm-data";

type Result = {
  id: string;
  title: string;
  subtitle: string;
  group: string;
  go: () => void;
};

export function GlobalSearch() {
  const navigate = useNavigate();
  const { scopedCustomers, packages, scopedBookings, scopedOpportunities, customerName } = useCrm();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const hit = (...vals: (string | undefined)[]) =>
      vals.some((v) => (v ?? "").toLowerCase().includes(term));

    const out: Result[] = [];

    for (const c of scopedCustomers) {
      if (hit(c.name, c.phone, c.email, c.city)) {
        out.push({
          id: "c" + c.id,
          group: "العملاء",
          title: c.name,
          subtitle: `${c.phone} · ${c.city}`,
          go: () => navigate({ to: "/customers/$customerId", params: { customerId: c.id } }),
        });
      }
    }
    for (const p of packages) {
      if (hit(p.name, p.destination)) {
        out.push({
          id: "p" + p.id,
          group: "الباقات",
          title: p.name,
          subtitle: `${p.destination} · ${money(p.price)}`,
          go: () => navigate({ to: "/packages" }),
        });
      }
    }
    for (const b of scopedBookings) {
      if (hit(b.ref, customerName(b.customerId))) {
        out.push({
          id: "b" + b.id,
          group: "الحجوزات",
          title: `${b.ref} — ${customerName(b.customerId)}`,
          subtitle: money(b.amount),
          go: () => navigate({ to: "/bookings" }),
        });
      }
    }
    for (const o of scopedOpportunities) {
      if (hit(o.title, customerName(o.customerId))) {
        out.push({
          id: "o" + o.id,
          group: "الفرص",
          title: o.title,
          subtitle: `${customerName(o.customerId)} · ${money(o.value)}`,
          go: () => navigate({ to: "/pipeline" }),
        });
      }
    }
    return out.slice(0, 12);
  }, [q, scopedCustomers, packages, scopedBookings, scopedOpportunities, customerName, navigate]);

  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder="ابحث عن عميل، رقم موبايل، حجز أو باقة…"
        className="h-10 rounded-lg border-border bg-muted/60 pr-9 pl-8 shadow-none focus-visible:bg-card"
      />
      {q ? (
        <button
          type="button"
          onClick={() => setQ("")}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label="مسح البحث"
        >
          <X className="size-3.5" />
        </button>
      ) : null}

      {open && q.trim() ? (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">لا توجد نتائج</p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  r.go();
                  setQ("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-right hover:bg-accent/15"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                </span>
                <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                  {r.group}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
