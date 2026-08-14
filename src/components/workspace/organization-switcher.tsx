"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";
import { useMyOrganizations, useCurrentOrganization, useSetActiveOrganization, useCreateOrganization } from "@/hooks/use-organizations";

/**
 * Replaces the static "Beacon" logo link previously pinned at the top of
 * the sidebar (the comment there already called it out as a placeholder:
 * "Compact workspace switcher, pinned at the top"). Lists every
 * Organization the signed-in user belongs to; switching re-scopes which
 * Spaces WorkspaceSidebar shows.
 */
export function OrganizationSwitcher() {
  const router = useRouter();
  const { user } = useSession();
  const myOrganizations = useMyOrganizations();
  const currentOrganization = useCurrentOrganization();
  const setActiveOrganization = useSetActiveOrganization();
  const createOrganization = useCreateOrganization();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  if (!user || !currentOrganization) return null;

  function handleSwitch(organizationId: string) {
    if (!user) return;
    setActiveOrganization(user.id, organizationId);
    router.push("/");
  }

  async function handleCreate() {
    if (!user || !newOrgName.trim()) return;
    setIsCreating(true);
    try {
      const organization = await createOrganization({ name: newOrgName.trim(), createdByUserId: user.id });
      setActiveOrganization(user.id, organization.id);
      setNewOrgName("");
      setIsCreateOpen(false);
      router.push("/");
    } catch {
      toast.error("Tidak dapat membuat Organisasi, silakan coba lagi.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-2 hover:bg-sidebar-accent"
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
                  <path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4Z" fill="currentColor" />
                </svg>
              </div>
              <span className="min-w-0 flex-1 truncate text-left text-body-sm font-semibold text-sidebar-accent-foreground">
                {currentOrganization.name}
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/50" />
            </button>
          }
        />

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Organisasi</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {myOrganizations.map((organization) => (
              <DropdownMenuItem key={organization.id} onClick={() => handleSwitch(organization.id)}>
                <span className="min-w-0 flex-1 truncate">{organization.name}</span>
                {organization.id === currentOrganization.id && <Check className="size-3.5 shrink-0" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-3.5" />
            Buat Organisasi baru
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Organisasi baru</DialogTitle>
            <DialogDescription>Anda akan menjadi Owner dari Organisasi ini.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-org-name">Nama Organisasi</Label>
            <Input id="new-org-name" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="Nama perusahaan atau tim Anda" />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
              Batal
            </Button>
            <Button onClick={() => void handleCreate()} disabled={isCreating || !newOrgName.trim()}>
              {isCreating ? "Membuat…" : "Buat Organisasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
