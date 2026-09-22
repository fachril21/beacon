"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getKerjainResetPasswordUrl } from "@/lib/supabase/env";
import { mapProfileRow, type ProfileRow } from "@/lib/supabase/mappers";
import type { User } from "@/lib/types";

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export class EmailAlreadyRegisteredError extends Error {}
export class InvalidCredentialsError extends Error {}

async function fetchProfile(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  userId: string,
): Promise<User | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error || !data) return null;
  return mapProfileRow(data as ProfileRow);
}

interface SessionContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Mounted once in the root layout. Every `useSession()` caller used to run
 * its own `getSession()` fetch and its own `onAuthStateChange()`
 * subscription — with ~20 call sites (sidebar, every page-tree row, every
 * comment panel, etc.) that meant a burst of dozens of redundant `profiles`
 * fetches per page load, each queued behind Supabase's internal auth lock,
 * taking 15-20s to fully drain. That churn was enough to knock loose
 * unrelated in-flight UI state (e.g. the screenshot annotator closing right
 * after opening) whenever it landed mid-interaction. A single Provider does
 * the fetch/subscribe once and every caller just reads the shared value.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function syncFromAuthUserId(userId: string | undefined) {
      const profile = userId ? await fetchProfile(supabase, userId) : null;
      if (active) setUser(profile);
    }

    supabase.auth.getSession().then(({ data }: { data: { session: { user?: { id: string } } | null } }) => {
      void syncFromAuthUserId(data.session?.user?.id).finally(() => {
        if (active) setIsLoading(false);
      });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user?: { id: string } } | null) => {
        void syncFromAuthUserId(session?.user?.id);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.toLowerCase().includes("invalid login credentials")) {
          throw new InvalidCredentialsError("Email atau kata sandi salah.");
        }
        throw error;
      }
    },
    [supabase],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { name: input.name } },
      });
      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes("already registered") || message.includes("already exists")) {
          throw new EmailAlreadyRegisteredError("Email ini sudah terdaftar.");
        }
        throw error;
      }
      // Supabase's anti-enumeration behavior: signUp for an already-registered,
      // already-confirmed email returns success with `identities: []` instead
      // of an error, so it doesn't leak which emails have accounts.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        throw new EmailAlreadyRegisteredError("Email ini sudah terdaftar.");
      }
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  /**
   * Sends a real recovery email via whatever SMTP is configured in the
   * project's Auth settings (same delivery path as signup-confirmation and
   * invite emails). Supabase's own response never reveals whether the email
   * actually has an account — the anti-enumeration behavior is already
   * built into the API, so no extra handling is needed here.
   *
   * redirectTo points at Kerjain, not Beacon: this Supabase project is
   * shared between the two internal platforms, and auth (including
   * password recovery) is consolidated on Kerjain's side.
   */
  const requestPasswordReset = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getKerjainResetPasswordUrl(),
      });
      if (error) throw error;
    },
    [supabase],
  );

  /**
   * Requires an active session — valid either because the recovery/invite
   * email's link just established one (Supabase's client auto-detects the
   * URL's token on load), or because a signed-in User is changing their own
   * password. Both SetPasswordForm (invite/recovery) and a future
   * account-settings change-password screen can share this one method.
   */
  const updatePassword = useCallback(
    async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    [supabase],
  );

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, isLoading, signIn, signUp, signOut, requestPasswordReset, updatePassword }),
    [user, isLoading, signIn, signUp, signOut, requestPasswordReset, updatePassword],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Real Supabase Auth session (Epic 10) — replaces Stage 1's localStorage mock session. */
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
