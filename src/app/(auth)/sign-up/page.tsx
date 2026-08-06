"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertCircle } from "lucide-react";
import { useSession, EmailAlreadyRegisteredError } from "@/hooks/use-session";

class MockNetworkError extends Error {}

export default function SignUpPage() {
  const router = useRouter();
  const { signUp } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simulateNetworkFailure, setSimulateNetworkFailure] = useState(false);

  async function attemptSignUp() {
    setEmailError(null);
    setConfirmError(null);
    if (password !== confirmPassword) {
      setConfirmError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (simulateNetworkFailure) throw new MockNetworkError();
      await signUp({ name, email, password });
      router.push("/verify-email");
    } catch (err) {
      if (err instanceof MockNetworkError) {
        toast.error("Tidak dapat terhubung, silakan coba lagi.", {
          action: { label: "Coba lagi", onClick: () => void attemptSignUp() },
        });
      } else if (err instanceof EmailAlreadyRegisteredError) {
        setEmailError(err.message);
      } else {
        setEmailError("Terjadi kesalahan. Silakan coba lagi.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void attemptSignUp();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Buat akun Beacon</CardTitle>
        <CardDescription>Untuk anggota tim Dibimbing Group.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nama lengkap</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama Anda" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@dibimbing.id"
              aria-invalid={!!emailError}
            />
            {emailError && (
              <p className="flex items-center gap-1.5 text-caption text-destructive">
                <AlertCircle className="size-3.5 shrink-0" />
                {emailError}{" "}
                <Link href="/sign-in" className="underline underline-offset-4">
                  Masuk ke akun Anda
                </Link>
              </p>
            )}
          </div>
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
            {isSubmitting ? "Memproses…" : "Buat akun"}
          </Button>
        </form>

        <div className="mt-5 flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2.5">
          <Label htmlFor="sim-network" className="text-caption font-normal text-muted-foreground">
            Simulasikan kegagalan jaringan (Tahap 1)
          </Label>
          <Switch id="sim-network" checked={simulateNetworkFailure} onCheckedChange={setSimulateNetworkFailure} />
        </div>

        <p className="mt-5 text-center text-body-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Link href="/sign-in" className="text-primary-muted-foreground underline underline-offset-4 hover:text-primary-hover">
            Masuk
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
