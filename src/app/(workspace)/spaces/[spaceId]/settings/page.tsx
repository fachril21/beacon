"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NotFoundState } from "@/components/beacon/not-found-state";
import { DeleteConfirmDialog } from "@/components/workspace/delete-confirm-dialog";
import { useSession } from "@/hooks/use-session";
import { useSpace, useSpaceRole, useUpdateSpace } from "@/hooks/use-spaces";
import type { Space } from "@/lib/types";

export default function SpaceSettingsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  const { user } = useSession();
  const space = useSpace(spaceId);
  const role = useSpaceRole(spaceId, user?.id);

  // Hidden entirely for non-admins, never just disabled (mirrors the Members
  // screen and Flow 7's "never reveal the screen exists" rule).
  if (!user || role !== "admin") {
    return <NotFoundState />;
  }
  if (!space) return null;

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[42rem] px-8 py-10">
        <h1 className="text-h1 font-bold text-foreground">Pengaturan Space</h1>
        <p className="mt-1.5 text-body text-muted-foreground">{space.name}</p>

        <SpaceSettingsForm space={space} />
      </div>
    </main>
  );
}

/**
 * The editable settings themselves. Split out so its `useState(space.name)`
 * initializer only runs once the Space is actually loaded (mirrors
 * OrganizationSettings' GeneralTab, which receives an already-loaded name).
 */
function SpaceSettingsForm({ space }: { space: Space }) {
  const updateSpace = useUpdateSpace();
  const [nameInput, setNameInput] = useState(space.name);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingPublishable, setIsSavingPublishable] = useState(false);
  const [isConfirmInternalOpen, setIsConfirmInternalOpen] = useState(false);

  const trimmedName = nameInput.trim();
  const canSaveName = !isSavingName && trimmedName.length > 0 && trimmedName !== space.name;

  async function handleSaveName() {
    if (!canSaveName) return;
    setIsSavingName(true);
    try {
      await updateSpace(space.id, { name: trimmedName });
      toast.success("Nama Space diperbarui.");
    } catch {
      toast.error("Tidak dapat memperbarui nama, silakan coba lagi.");
      setNameInput(space.name);
    } finally {
      setIsSavingName(false);
    }
  }

  async function setPublishable(next: boolean) {
    if (next === space.isPublishable) return;
    setIsSavingPublishable(true);
    try {
      await updateSpace(space.id, { isPublishable: next });
      toast.success("Pengaturan Space diperbarui.");
    } catch {
      toast.error("Tidak dapat memperbarui pengaturan, silakan coba lagi.");
    } finally {
      setIsSavingPublishable(false);
      setIsConfirmInternalOpen(false);
    }
  }

  function handleToggle(next: boolean) {
    // Turning publishing OFF can pull already-published Pages from the public
    // site, so confirm first; turning it ON has no destructive side effect.
    if (next) {
      void setPublishable(true);
    } else {
      setIsConfirmInternalOpen(true);
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      <Card className="p-6">
        <Label htmlFor="space-name">Nama Space</Label>
        <div className="mt-2 flex gap-2">
          <Input
            id="space-name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            disabled={isSavingName}
          />
          <Button onClick={() => void handleSaveName()} disabled={!canSaveName}>
            {isSavingName ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="space-publishable" className="font-medium">
              Dapat dipublikasikan
            </Label>
            <p className="mt-1 text-caption text-muted-foreground">
              Halaman di Space ini dapat dipublikasikan ke situs publik. Mematikannya membuat Space kembali internal saja
              dan menyembunyikan Halaman yang sudah terbit dari publik.
            </p>
          </div>
          <Switch
            id="space-publishable"
            checked={space.isPublishable}
            disabled={isSavingPublishable}
            onCheckedChange={handleToggle}
          />
        </div>
      </Card>

      <DeleteConfirmDialog
        open={isConfirmInternalOpen}
        onOpenChange={(open) => !open && setIsConfirmInternalOpen(false)}
        title="Jadikan Space ini internal saja?"
        description="Halaman yang sudah dipublikasikan akan langsung hilang dari situs publik sampai Space ini diaktifkan kembali. Konten dan riwayatnya tetap tersimpan."
        confirmLabel="Jadikan Internal"
        isDeleting={isSavingPublishable}
        onConfirm={() => void setPublishable(false)}
      />
    </div>
  );
}
