"use client";

import { useSyncExternalStore, useEffect } from "react";
import { usersStore } from "@/lib/supabase/stores";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapProfileRow, type ProfileRow } from "@/lib/supabase/mappers";

export function useUsers(organizationId?: string) {
  const users = useSyncExternalStore(usersStore.subscribe, usersStore.getState, usersStore.getState);

  useEffect(() => {
    usersStore.ensureLoaded(
      "all",
      async () => {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.from("profiles").select("*");
        if (error) throw error;
        return ((data ?? []) as ProfileRow[]).map(mapProfileRow);
      },
      (error) => console.error("[beacon] failed to load users:", error),
    );
  }, []);

  return organizationId ? users.filter((u) => u.organizationId === organizationId) : users;
}

export function useUser(id: string | undefined) {
  const users = useUsers();
  return id ? users.find((u) => u.id === id) : undefined;
}
