"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { usersStore, organizationsStore, nextId } from "@/lib/data-store";
import { DEFAULT_MOCK_USER_ID } from "@/lib/mock/users";
import type { User, OrganizationRole } from "@/lib/types";

const SESSION_KEY = "beacon.mockSession";

interface SessionState {
  userId: string | null;
}

let sessionState: SessionState = { userId: null };
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function readPersisted(): SessionState {
  if (typeof window === "undefined") return { userId: null };
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionState) : { userId: null };
  } catch {
    return { userId: null };
  }
}

function persist(state: SessionState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SessionState {
  return sessionState;
}

const SERVER_SNAPSHOT: SessionState = { userId: null };
function getServerSnapshot(): SessionState {
  return SERVER_SNAPSHOT;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export class EmailAlreadyRegisteredError extends Error {}
export class InvalidCredentialsError extends Error {}

/** Mock session — persisted to localStorage, no real auth (Epic 2). */
export function useSession() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const users = useSyncExternalStore(usersStore.subscribe, usersStore.getState, usersStore.getState);

  useEffect(() => {
    const persisted = readPersisted();
    if (persisted.userId !== sessionState.userId) {
      sessionState = persisted;
      notify();
    }
  }, []);

  const user: User | null = state.userId ? users.find((u) => u.id === state.userId) ?? null : null;

  const signIn = useCallback(async (email: string, password: string) => {
    await simulateLatency();
    if (!password) {
      throw new InvalidCredentialsError("Email atau kata sandi salah.");
    }
    const match = usersStore.getState().find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!match) {
      throw new InvalidCredentialsError("Email atau kata sandi salah.");
    }
    sessionState = { userId: match.id };
    persist(sessionState);
    notify();
    return match;
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    await simulateLatency();
    const existing = usersStore.getState().find((u) => u.email.toLowerCase() === input.email.toLowerCase());
    if (existing) {
      throw new EmailAlreadyRegisteredError("Email ini sudah terdaftar.");
    }
    const org = organizationsStore.getState()[0];
    const newUser: User = {
      id: nextId("user"),
      email: input.email,
      name: input.name,
      avatarUrl: null,
      organizationId: org.id,
      organizationRole: "member" as OrganizationRole,
      createdAt: new Date().toISOString(),
    };
    usersStore.setState((prev) => [...prev, newUser]);
    sessionState = { userId: newUser.id };
    persist(sessionState);
    notify();
    return newUser;
  }, []);

  const signOut = useCallback(() => {
    sessionState = { userId: null };
    persist(sessionState);
    notify();
  }, []);

  /** Convenience for demoing without a full sign-up — Flow 1 note: "any mock credentials". */
  const signInAsDefault = useCallback(() => {
    sessionState = { userId: DEFAULT_MOCK_USER_ID };
    persist(sessionState);
    notify();
  }, []);

  return { user, isAuthenticated: !!user, signIn, signUp, signOut, signInAsDefault };
}

function simulateLatency() {
  return new Promise((resolve) => setTimeout(resolve, 500));
}
