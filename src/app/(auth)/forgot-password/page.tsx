"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useSession();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
    } catch {
      // Supabase's own anti-enumeration response never reveals whether the
      // email has an account — show the same confirmation either way so a
      // failed send can't be distinguished from "no such account" either.
    } finally {
      setIsSubmitting(false);
      setIsSent(true);
    }
  }

  if (isSent) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Periksa email Anda</CardTitle>
          <CardDescription>
            Jika {email} terdaftar, kami telah mengirim tautan untuk mengatur ulang kata sandi Anda.
          </CardDescription>
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
        <CardTitle>Lupa kata sandi?</CardTitle>
        <CardDescription>Masukkan email Anda dan kami akan mengirimkan tautan untuk mengatur ulang kata sandi.</CardDescription>
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
          <Button type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? "Mengirim…" : "Kirim tautan atur ulang"}
          </Button>
        </form>

        <p className="mt-5 text-center text-body-sm text-muted-foreground">
          <Link href="/sign-in" className="text-primary-muted-foreground underline underline-offset-4 hover:text-primary-hover">
            Kembali ke halaman masuk
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
