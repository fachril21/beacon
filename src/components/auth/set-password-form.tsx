"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";

interface SetPasswordFormProps {
  /** invite: landed here from an invite email (no account yet, joining a Space). recovery: landed here from a forgot-password email. Copy differs; the mechanism (an active session from the email link + updatePassword) is identical. */
  mode: "invite" | "recovery";
}

const COPY = {
  invite: {
    title: "Selesaikan pendaftaran Anda",
    description: "Anda telah diundang ke Beacon. Buat kata sandi untuk mengaktifkan akun Anda.",
    submitLabel: "Buat akun",
    submitLabelSubmitting: "Membuat akun…",
  },
  recovery: {
    title: "Atur ulang kata sandi",
    description: "Masukkan kata sandi baru untuk akun Anda.",
    submitLabel: "Simpan kata sandi",
    submitLabelSubmitting: "Menyimpan…",
  },
};

export function SetPasswordForm({ mode }: SetPasswordFormProps) {
  const router = useRouter();
  const { isLoading, isAuthenticated, updatePassword } = useSession();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const copy = COPY[mode];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setConfirmError(null);
    if (password !== confirmPassword) {
      setConfirmError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setIsSubmitting(true);
    try {
      await updatePassword(password);
      router.push("/");
    } catch {
      toast.error("Tidak dapat menyimpan kata sandi. Tautan mungkin sudah kedaluwarsa, silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="py-8 text-center text-body-sm text-muted-foreground">Memuat…</CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Tautan tidak valid</CardTitle>
          <CardDescription>Tautan ini tidak valid atau telah kedaluwarsa.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/sign-in" className="text-primary-muted-foreground underline underline-offset-4 hover:text-primary-hover">
            Kembali ke halaman masuk
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Kata sandi</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password">Konfirmasi kata sandi</Label>
            <Input
              id="confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={!!confirmError}
            />
            {confirmError && (
              <p className="flex items-center gap-1.5 text-caption text-destructive">
                <AlertCircle className="size-3.5 shrink-0" />
                {confirmError}
              </p>
            )}
          </div>
          <Button type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? copy.submitLabelSubmitting : copy.submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
