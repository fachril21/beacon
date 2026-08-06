"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MailCheck } from "lucide-react";
import { useSession } from "@/hooks/use-session";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user } = useSession();
  const [resent, setResent] = useState(false);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary-muted text-primary-muted-foreground">
          <MailCheck className="size-6" />
        </div>
        <CardTitle>Periksa kotak masuk Anda</CardTitle>
        <CardDescription>
          Kami telah mengirimkan tautan verifikasi ke {user?.email ?? "email Anda"}. Buka email tersebut untuk
          mengaktifkan akun.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <Button variant="secondary" onClick={() => setResent(true)}>
          Kirim ulang email
        </Button>
        {resent && <p className="text-caption text-success">Email verifikasi telah dikirim ulang.</p>}
        <p className="mt-2 text-caption text-muted-foreground">
          (Tahap 1 — pratinjau UI) Belum ada pengiriman email sungguhan.
        </p>
        <Button className="mt-1 w-full" onClick={() => router.push("/")}>
          Saya sudah verifikasi, lanjutkan
        </Button>
      </CardContent>
    </Card>
  );
}
