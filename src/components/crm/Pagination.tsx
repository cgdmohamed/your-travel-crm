import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);
  // إعادة الصفحة للأولى عند تغيّر القائمة (بحث/فلتر)
  useEffect(() => {
    setPage(1);
  }, [items.length, pageSize]);
  const paged = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );
  return { page: safePage, setPage, pageCount, paged, total: items.length };
}

export function Pagination({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (total === 0) return null;
  const pages = pageNumbers(page, pageCount);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <span className="text-xs text-muted-foreground">
        صفحة {page} من {pageCount} — إجمالي {total} نتيجة
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="الصفحة السابقة"
        >
          <ChevronRight className="size-4" />
        </Button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              size="icon"
              className="size-8 text-xs"
              onClick={() => onPage(p)}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          aria-label="الصفحة التالية"
        >
          <ChevronLeft className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function pageNumbers(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const set = new Set<number>([1, 2, page - 1, page, page + 1, pageCount - 1, pageCount]);
  const nums = [...set].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < nums.length; i++) {
    const n = nums[i];
    const prev = nums[i - 1];
    if (n === undefined) continue;
    if (prev !== undefined && n - prev > 1) out.push("…");
    out.push(n);
  }
  return out;
}
