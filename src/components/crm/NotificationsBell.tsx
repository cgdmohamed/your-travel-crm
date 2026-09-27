import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from "@/lib/notifications.functions";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} ي`;
}

export function NotificationsBell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listNotifications);
  const markReadFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
    refetchInterval: 25000,
  });

  const items: NotificationRow[] = query.data?.items ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markReadFn({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllFn({}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleClick = (n: NotificationRow) => {
    if (!n.readAt) void markReadMutation.mutateAsync(n.id);
    if (n.link) void navigate({ to: n.link });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="الإشعارات"
          className="relative flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -left-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent dir="rtl" align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-bold">الإشعارات</p>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={() => void markAllMutation.mutateAsync()}
            >
              <CheckCheck className="size-3.5" /> تعليم الكل كمقروء
            </Button>
          ) : null}
        </div>
        <ScrollArea className="h-80">
          {items.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">لا توجد إشعارات بعد</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`block w-full px-3 py-2.5 text-right transition-colors hover:bg-accent ${
                      n.readAt ? "" : "bg-accent/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{n.title}</p>
                      {!n.readAt ? <span className="size-2 shrink-0 rounded-full bg-primary" /> : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
