"use client";

import { useSyncExternalStore } from "react";
import { usersStore } from "@/lib/data-store";

export function useUsers(organizationId?: string) {
  const users = useSyncExternalStore(usersStore.subscribe, usersStore.getState, usersStore.getState);
  return organizationId ? users.filter((u) => u.organizationId === organizationId) : users;
}

export function useUser(id: string | undefined) {
  const users = useUsers();
  return id ? users.find((u) => u.id === id) : undefined;
}
