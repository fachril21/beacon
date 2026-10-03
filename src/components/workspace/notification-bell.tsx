"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSession } from "@/hooks/use-session";
import { useNotifications, useMarkNotificationRead, useUnreadNotificationCount } from "@/hooks/use-notifications";
import { useUser } from "@/hooks/use-users";
import { usePage } from "@/hooks/use-pages";
import { displayName } from "@/lib/display-name";
import { commentSnippet, notificationHref } from "@/lib/notification-link";
import { sidebarNavIconClass, sidebarNavRowClass } from "./sidebar-row";
import type { Notification } from "@/lib/types";

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function NotificationRow({ notification, onOpen }: { notification: Notification; onOpen: (id: string) => void }) {
  const actor = useUser(notification.actorUserId);
  const page = usePage(notification.pageId);
  const href = notificationHref(page ? { spaceId: page.spaceId, pageId: page.id } : undefined, notification.commentId) ?? "#";
  const snippet = commentSnippet(notification.commentBody);

  return (
    <Link
      href={href}
      onClick={() => onOpen(notification.id)}
      className="flex items-start gap-2 rounded-sm px-2 py-2 hover:bg-accent"
    >
      <span className="mt-1.5 flex size-2 shrink-0">
        {!notification.isRead && <span aria-label="Belum dibaca" className="size-2 rounded-full bg-primary" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body-sm text-foreground">
          <span className="font-medium break-all">{actor ? displayName(actor) : "Seseorang"}</span> menyebut Anda di{" "}
          <span className="font-medium">{page?.title || "Halaman tanpa judul"}</span>
        </span>
        {snippet && <span className="line-clamp-2 text-caption text-muted-foreground">{snippet}</span>}
        <span className="text-caption text-muted-foreground">{formatTimestamp(notification.createdAt)}</span>
      </span>
    </Link>
  );
}

export function NotificationBell() {
  const { user } = useSession();
  const notifications = useNotifications(user?.id);
  const markRead = useMarkNotificationRead();
  const unreadCount = useUnreadNotificationCount(user?.id);

  function handleOpen(notificationId: string) {
    void markRead(notificationId);
  }

  return (
    <Popover>
      <PopoverTrigger render={<button type="button" className={sidebarNavRowClass} />}>
        <Bell className={sidebarNavIconClass} />
        <span className="min-w-0 flex-1 truncate text-left">Notifikasi</span>
        {unreadCount > 0 && (
          <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-80 p-1">
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="py-4 text-center text-caption text-muted-foreground">Belum ada notifikasi.</p>
          ) : (
            notifications.map((n) => <NotificationRow key={n.id} notification={n} onOpen={handleOpen} />)
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
