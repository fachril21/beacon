"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Globe, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NotFoundState } from "@/components/beacon/not-found-state";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrganization, useOrganizationDomainActions } from "@/hooks/use-organizations";

export default function OrganizationSettingsPage() {
  const { user } = useSession();
  const organization = useCurrentOrganization();
  const { addDomain, verifyDomain, removeDomain } = useOrganizationDomainActions(organization?.id ?? "");
  const [domainInput, setDomainInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyFailed, setVerifyFailed] = useState(false);

  if (!user || user.organizationRole !== "owner") {
    return <NotFoundState />;
  }
  if (!organization) return null;

  function handleAddDomain() {
    setError(null);
    if (!domainInput.trim()) return;
    try {
      addDomain(domainInput.trim());
      setDomainInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    }
  }

  async function handleVerify() {
    setIsVerifying(true);
    setVerifyFailed(false);
    const success = await verifyDomain();
    setIsVerifying(false);
    if (success) {
      toast.success("Domain berhasil diverifikasi.");
    } else {
      setVerifyFailed(true);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[42rem] px-8 py-10">
        <h1 className="text-h1 font-bold text-foreground">Pengaturan Organisasi</h1>
        <p className="mt-1.5 text-body text-muted-foreground">{organization.name}</p>

        <div className="mt-8 flex items-center gap-1 border-b border-border">
          <div className="border-b-2 border-primary px-3 py-2 text-body-sm font-medium text-foreground">Domain</div>
        </div>

        <Card className="mt-6 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Globe className="size-5" />
            </div>
            <div className="flex-1">
              <p className="text-body-sm font-medium text-foreground">Domain publik</p>
              {!organization.domain && <p className="text-caption text-muted-foreground">Belum ada domain dikonfigurasi</p>}
              {organization.domain && !organization.isDomainVerified && (
                <p className="text-caption text-muted-foreground">Menunggu verifikasi — {organization.domain}</p>
              )}
              {organization.domain && organization.isDomainVerified && (
                <p className="text-caption text-muted-foreground">Aktif di {organization.domain}</p>
              )}
            </div>
            {organization.domain && (
              <Badge variant={organization.isDomainVerified ? "published" : "pending"}>
                {organization.isDomainVerified ? "Terverifikasi" : "Menunggu"}
              </Badge>
            )}
          </div>

          {!organization.domain && (
            <div className="mt-5 flex flex-col gap-2 border-t border-border pt-5">
              <Label htmlFor="domain-input">Tambahkan domain kustom</Label>
              <div className="flex gap-2">
                <Input
                  id="domain-input"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="docs.dibimbing.id"
                />
                <Button onClick={handleAddDomain} disabled={!domainInput.trim()}>
                  Tambah domain
                </Button>
              </div>
              {error && (
                <p className="flex items-center gap-1.5 text-caption text-destructive">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>
          )}

          {organization.domain && !organization.isDomainVerified && (
            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5">
              <p className="text-body-sm text-foreground">
                Tambahkan TXT record berikut di pengaturan DNS domain Anda untuk membuktikan kepemilikan:
              </p>
              <div className="rounded-md border border-border bg-card px-3 py-2.5 font-mono text-mono text-foreground">
                {organization.pendingDnsToken}
              </div>
              {verifyFailed && (
                <p className="flex items-center gap-1.5 text-caption text-warning">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  Belum ditemukan — perubahan DNS bisa memakan waktu beberapa jam.
                </p>
              )}
              <div className="flex gap-2">
                <Button onClick={handleVerify} disabled={isVerifying}>
                  {isVerifying ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                  Verifikasi
                </Button>
                <Button variant="secondary" onClick={removeDomain}>
                  Batalkan
                </Button>
              </div>
            </div>
          )}

          {organization.domain && organization.isDomainVerified && (
            <div className="mt-5 flex gap-2 border-t border-border pt-5">
              <Button variant="secondary" onClick={removeDomain}>
                Hapus domain
              </Button>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
