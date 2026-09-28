"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DeleteConfirmDialog } from "@/components/workspace/delete-confirm-dialog";
import { useSession } from "@/hooks/use-session";
import { useSpace, useUpdateSpace, useDeleteSpace } from "@/hooks/use-spaces";
import type { Space } from "@/lib/types";

export default function SpaceSettingsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  const { user } = useSession();
  const space = useSpace(spaceId);

  if (!user || !space) return null;

  return (
    <div className="max-w-[42rem]">
      <SpaceSettingsForm space={space} />
    </div>
  );
}

/**
 * The editable settings themselves. Split out so its `useState(space.name)`
 * initializer only runs once the Space is actually loaded (mirrors
 * OrganizationSettings' GeneralTab, which receives an already-loaded name).
 */
function SpaceSettingsForm({ space }: { space: Space }) {
  const router = useRouter();
  const updateSpace = useUpdateSpace();
  const deleteSpace = useDeleteSpace();
  const [nameInput, setNameInput] = useState(space.name);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingPublishable, setIsSavingPublishable] = useState(false);
  const [isConfirmInternalOpen, setIsConfirmInternalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  async function handleDeleteSpace() {
    setIsDeleting(true);
    try {
      await deleteSpace(space.id);
      toast("Space telah dihapus.");
      router.push("/");
    } catch {
      toast.error("Gagal menghapus Space, silakan coba lagi.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
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

      <Card className="border-destructive/40 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-foreground">Hapus Space</p>
            <p className="mt-1 text-caption text-muted-foreground">
              Seluruh Halaman di dalam Space ini akan ikut dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setIsDeleteOpen(true)}>
            <Trash2 className="size-3.5" />
            Hapus Space
          </Button>
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

      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title={`Hapus Space "${space.name}"?`}
        description="Seluruh Halaman di dalam Space ini akan ikut dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus Space"
        isDeleting={isDeleting}
        onConfirm={() => void handleDeleteSpace()}
      />
    </div>
  );
}
