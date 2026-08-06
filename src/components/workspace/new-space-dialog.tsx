"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSession } from "@/hooks/use-session";
import { useCreateSpace } from "@/hooks/use-spaces";

export function NewSpaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { user } = useSession();
  const createSpace = useCreateSpace();
  const [name, setName] = useState("");
  const [isPublishable, setIsPublishable] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate() {
    if (!user || !name.trim()) return;
    setIsCreating(true);
    try {
      const space = await createSpace({
        organizationId: user.organizationId,
        name: name.trim(),
        isPublishable,
        createdByUserId: user.id,
      });
      setName("");
      setIsPublishable(false);
      onOpenChange(false);
      router.push(`/spaces/${space.id}`);
    } catch {
      toast.error("Tidak dapat membuat Space, silakan coba lagi.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[40rem]">
        <DialogHeader>
          <DialogTitle>Space baru</DialogTitle>
          <DialogDescription>Space mengelompokkan Page untuk satu platform, misalnya “Aplikasi Mobile”.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="space-name">Nama Space</Label>
            <Input
              id="space-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Aplikasi Mobile"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2.5">
            <div>
              <Label htmlFor="space-publishable" className="font-medium">Dapat dipublikasikan</Label>
              <p className="text-caption text-muted-foreground">Halaman di Space ini dapat dipublikasikan ke situs publik.</p>
            </div>
            <Switch id="space-publishable" checked={isPublishable} onCheckedChange={setIsPublishable} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={() => void handleCreate()} disabled={!name.trim() || isCreating}>
            {isCreating ? "Membuat…" : "Buat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
