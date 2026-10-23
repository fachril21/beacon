"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import { useAcceptOrganizationInvite } from "@/hooks/use-organizations";

/** sessionStorage key the workspace onboarding gate checks on first load post-signup (Phase 8). */
export const PENDING_ORG_INVITE_TOKEN_KEY = "beacon.pendingOrgInviteToken";

/**
 * Landing target for an Organization invite link
 * (/api/organizations/[id]/invite/route.ts's redirectTo). An already
 * signed-in user (existing Account, or one who just finished
 * complete-invite's set-password step) accepts immediately. A signed-out
 * visitor stashes the token and is sent to sign in/up first — the
 * workspace's zero-Organization onboarding gate consumes the stashed token
 * once a session exists, so this also covers "brand-new signup, verified,
 * first ever workspace load" without threading the token through Supabase's
 * own email-confirmation redirect chain.
 */
export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { user, isLoading: isSessionLoading } = useSession();
  const acceptInvite = useAcceptOrganizationInvite();
  const [status, setStatus] = useState<"idle" | "accepted" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Flips true only from inside the grace-period timer below (never the
  // effect's synchronous prologue — react-hooks/set-state-in-effect).
  const [hasGraceElapsed, setHasGraceElapsed] = useState(false);
  // Derived, not stored: "accepting" is implicit whenever we're about to call
  // the RPC and haven't settled yet — avoids a synchronous setState at the
  // top of the effect body (react-hooks/set-state-in-effect), which is only
  // safe inside a .then/.catch callback, not the effect's sync prologue.
  const isAccepting = !isSessionLoading && !!token && !!user && status === "idle";
  // The invite email link lands here with Supabase's session-exchange code
  // still in flight — the session only exists a moment later. Hold the
  // "Memproses undangan…" state through a grace period so a brand-new
  // invitee (whose Masuk/Daftar options are both dead ends: no password set,
  // auth account pre-created) never sees that fallback flash first.
  const isWaitingForSession = !!token && !isSessionLoading && !user && !hasGraceElapsed;

  useEffect(() => {
    if (!token || isSessionLoading || user) return;
    const timer = setTimeout(() => setHasGraceElapsed(true), 5000);
    return () => clearTimeout(timer);
  }, [token, user, isSessionLoading]);

  useEffect(() => {
    if (isSessionLoading || !token) return;

    if (!user) {
      sessionStorage.setItem(PENDING_ORG_INVITE_TOKEN_KEY, token);
      return;
    }

    let active = true;
    acceptInvite(token)
      .then(() => {
        if (!active) return;
        sessionStorage.removeItem(PENDING_ORG_INVITE_TOKEN_KEY);
        setStatus("accepted");
        // A pending invitation only ever exists for an email that had no
        // Beacon Account at invite time — and inviteUserByEmail creates that
        // auth account WITHOUT a password. Every acceptor arriving here is
        // therefore signed in via the one-time email link and still
        // passwordless; route them to the set-password step so they can
        // actually sign back in later, instead of dropping them in the
        // workspace with an account they can never log into again.
        router.push("/complete-invite");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setErrorMessage(err instanceof Error ? err.message : "Undangan tidak valid.");
        setStatus("error");
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- acceptInvite/router are stable; re-running on their identity would refire the accept call
  }, [token, user, isSessionLoading]);

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Tautan undangan tidak valid</CardTitle>
          <CardDescription>Tautan ini tidak menyertakan kode undangan.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isSessionLoading || isAccepting || isWaitingForSession) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-body-sm text-muted-foreground">Memproses undangan…</p>
        </CardContent>
      </Card>
    );
  }

  if (status === "accepted") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <CheckCircle2 className="mb-2 size-8 text-success" />
          <CardTitle>Bergabung dengan Organisasi</CardTitle>
          <CardDescription>Mengalihkan ke pembuatan kata sandi…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <AlertCircle className="mb-2 size-8 text-destructive" />
          <CardTitle>Tidak dapat menerima undangan</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Anda diundang ke sebuah Organisasi</CardTitle>
        <CardDescription>
          Sesi dari tautan email belum terbentuk. Buka lagi tautan terbaru dari email undangan — tautan itu langsung
          membuat Anda bergabung tanpa perlu kata sandi.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Link href="/sign-in" className={cn(buttonVariants({ variant: "default" }))}>
          Masuk
        </Link>
        <Link href="/sign-up" className={cn(buttonVariants({ variant: "secondary" }))}>
          Buat akun baru
        </Link>
      </CardContent>
    </Card>
  );
}
