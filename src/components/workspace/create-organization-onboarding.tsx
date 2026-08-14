"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";
import { useCreateOrganization } from "@/hooks/use-organizations";

/**
 * Full-screen gate rendered by the workspace layout whenever a signed-in
 * User has zero Organization memberships — self-serve creation (any User
 * can create their own Organization, no approval needed) is the only way
 * out of this screen other than accepting a pending invite elsewhere.
 */
export function CreateOrganizationOnboarding() {
  const { user } = useSession();
  const createOrganization = useCreateOrganization();
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setIsCreating(true);
    try {
      await createOrganization({ name: name.trim(), createdByUserId: user.id });
    } catch {
      toast.error("Tidak dapat membuat Organisasi, silakan coba lagi.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary-muted text-primary-muted-foreground">
            <Building2 className="size-6" />
          </div>
          <CardTitle>Buat Organisasi Anda</CardTitle>
          <CardDescription>
            Anda belum tergabung dalam Organisasi manapun. Buat Organisasi baru untuk mulai menggunakan Beacon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-name">Nama Organisasi</Label>
              <Input
                id="org-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama perusahaan atau tim Anda"
              />
            </div>
            <Button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating ? "Membuat…" : "Buat Organisasi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
