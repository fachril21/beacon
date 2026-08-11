"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSession } from "@/hooks/use-session";
import { useNotifications, useMarkNotificationRead } from "@/hooks/use-notifications";
import { useUser } from "@/hooks/use-users";
import { usePage } from "@/hooks/use-pages";
import { sidebarNavIconClass, sidebarNavRowClass } from "./sidebar-row";
import type { Notification } from "@/lib/types";

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function NotificationRow({ notification, onOpen }: { notification: Notification; onOpen: (id: string) => void }) {
  const actor = useUser(notification.actorUserId);
  const page = usePage(notification.pageId);

  return (
    <Link
      href={page ? `/spaces/${page.spaceId}/pages/${page.id}` : "#"}
      onClick={() => onOpen(notification.id)}
      className="flex flex-col gap-0.5 rounded-sm px-2 py-2 hover:bg-accent"
    >
      <p className="text-body-sm text-foreground">
        <span className="font-medium">{actor?.name ?? "Seseorang"}</span> menyebut Anda di{" "}
        <span className="font-medium">{page?.title || "Halaman tanpa judul"}</span>
      </p>
      <span className="text-caption text-muted-foreground">{formatTimestamp(notification.createdAt)}</span>
    </Link>
  );
}

export function NotificationBell() {
  const { user } = useSession();
  const notifications = useNotifications(user?.id);
  const markRead = useMarkNotificationRead();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

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
