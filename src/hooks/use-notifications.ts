"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import { notificationsStore } from "@/lib/supabase/stores";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapNotificationRow, type NotificationRow } from "@/lib/supabase/mappers";

/** No Realtime subscription (Epic 18 is Stage 4) -- a periodic reload is
 * what satisfies US16.2's "within 1 minute" delivery AC instead. */
const NOTIFICATION_POLL_INTERVAL_MS = 20_000;

async function loadNotifications(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("notifications").select("*").eq("recipient_user_id", userId);
  if (error) throw error;
  return ((data ?? []) as NotificationRow[]).map(mapNotificationRow);
}

/** The current user's own notifications (notifications_select_own RLS already scopes this server-side), newest first. */
export function useNotifications(userId: string | undefined) {
  const notifications = useSyncExternalStore(
    notificationsStore.subscribe,
    notificationsStore.getState,
    notificationsStore.getState,
  );

  useEffect(() => {
    if (!userId) return;
    notificationsStore.ensureLoaded(`user:${userId}`, () => loadNotifications(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      notificationsStore.invalidate(`user:${userId}`);
      notificationsStore.ensureLoaded(`user:${userId}`, () => loadNotifications(userId));
    }, NOTIFICATION_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId]);

  const mine = userId ? notifications.filter((n) => n.recipientUserId === userId) : [];
  return [...mine].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

export function useUnreadNotificationCount(userId: string | undefined) {
  return useNotifications(userId).filter((n) => !n.isRead).length;
}

export function useMarkNotificationRead() {
  return useCallback(async (notificationId: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
    if (error) throw error;

    notificationsStore.setState((prev) => prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)));
  }, []);
}
