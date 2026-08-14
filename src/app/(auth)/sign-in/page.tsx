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
import { useSession, InvalidCredentialsError } from "@/hooks/use-session";

class MockNetworkError extends Error {}

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useSession();
  const [email, setEmail] = useState("fachril@dibimbing.id");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simulateNetworkFailure, setSimulateNetworkFailure] = useState(false);

  async function attemptSignIn() {
    setError(null);
    setIsSubmitting(true);
    try {
      if (simulateNetworkFailure) throw new MockNetworkError();
      await signIn(email, password);
      router.push("/");
    } catch (err) {
      if (err instanceof MockNetworkError) {
        toast.error("Tidak dapat terhubung, silakan coba lagi.", {
          action: { label: "Coba lagi", onClick: () => void attemptSignIn() },
        });
      } else if (err instanceof InvalidCredentialsError) {
        setError(err.message);
        setPassword("");
      } else {
        setError("Terjadi kesalahan. Silakan coba lagi.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void attemptSignIn();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Masuk ke Beacon</CardTitle>
        <CardDescription>Masukkan email dan kata sandi akun Anda.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@dibimbing.id"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Kata sandi</Label>
              <Link href="/forgot-password" className="text-caption text-primary-muted-foreground underline underline-offset-4 hover:text-primary-hover">
                Lupa kata sandi?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!error}
            />
            {error && (
              <p className="flex items-center gap-1.5 text-caption text-destructive">
                <AlertCircle className="size-3.5 shrink-0" />
                {error}
              </p>
            )}
          </div>
          <Button type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? "Memproses…" : "Masuk"}
          </Button>
        </form>

        <div className="mt-5 flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2.5">
          <Label htmlFor="sim-network" className="text-caption font-normal text-muted-foreground">
            Simulasikan kegagalan jaringan (Tahap 1)
          </Label>
          <Switch id="sim-network" checked={simulateNetworkFailure} onCheckedChange={setSimulateNetworkFailure} />
        </div>

        <p className="mt-5 text-center text-body-sm text-muted-foreground">
          Belum punya akun?{" "}
          <Link href="/sign-up" className="text-primary-muted-foreground underline underline-offset-4 hover:text-primary-hover">
            Daftar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
