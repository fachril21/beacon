"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { UserPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotFoundState } from "@/components/beacon/not-found-state";
import { DeleteConfirmDialog } from "@/components/workspace/delete-confirm-dialog";
import { useSession } from "@/hooks/use-session";
import { useSpace, useSpaceRole, useSpacePermissions, useUpdateSpaceRole, useAddOrgMemberToSpace, useRemoveMember } from "@/hooks/use-spaces";
import { useOrganizationMembers } from "@/hooks/use-organizations";
import { useUsers } from "@/hooks/use-users";
import type { SpaceRole } from "@/lib/types";

const ROLE_LABELS: Record<SpaceRole, string> = { viewer: "Viewer", editor: "Editor", admin: "Admin" };

export default function SpaceMembersPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  const { user } = useSession();
  const space = useSpace(spaceId);
  const role = useSpaceRole(spaceId, user?.id);
  const permissions = useSpacePermissions(spaceId);
  const updateRole = useUpdateSpaceRole();
  const organizationMembers = useOrganizationMembers(space?.organizationId);
  const addOrgMemberToSpace = useAddOrgMemberToSpace();
  const removeMember = useRemoveMember();
  const allUsers = useUsers();
  const [pickedUserId, setPickedUserId] = useState("");
  const [addRole, setAddRole] = useState<SpaceRole>("viewer");
  const [removeTarget, setRemoveTarget] = useState<{ permissionId: string; name: string } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  if (!user || role !== "admin") {
    return <NotFoundState />;
  }
  if (!space) return null;

  // Bringing a brand new person into Beacon at all now goes exclusively
  // through an Organization invite (Organization Settings > Members) — this
  // roster only ever grants existing Organization members access to this
  // Space, never a second independent email path.
  const addableMembers = organizationMembers
    .filter((m) => !permissions.some((p) => p.userId === m.userId))
    .map((m) => allUsers.find((u) => u.id === m.userId))
    .filter((u): u is NonNullable<typeof u> => !!u);

  async function handleRoleChange(userId: string, newRole: SpaceRole) {
    try {
      await updateRole(spaceId, userId, newRole);
      toast.success("Peran diperbarui.");
    } catch {
      toast.error("Tidak dapat memperbarui peran, silakan coba lagi.");
    }
  }

  async function handleAddMember() {
    if (!pickedUserId) return;
    try {
      await addOrgMemberToSpace(spaceId, pickedUserId, addRole);
      setPickedUserId("");
      toast.success("Anggota ditambahkan ke Space.");
    } catch {
      toast.error("Tidak dapat menambahkan anggota, silakan coba lagi.");
    }
  }

  async function handleRemoveMember() {
    if (!removeTarget) return;
    setIsRemoving(true);
    try {
      await removeMember(removeTarget.permissionId);
      toast("Anggota telah dihapus.");
      setRemoveTarget(null);
    } catch {
      toast.error("Tidak dapat menghapus anggota, silakan coba lagi.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[42rem] px-8 py-10">
        <h1 className="text-h1 font-bold text-foreground">Anggota</h1>
        <p className="mt-1.5 text-body text-muted-foreground">{space.name}</p>

        <div className="mt-8 flex gap-2">
          <Select value={pickedUserId} onValueChange={(v) => v && setPickedUserId(v)}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Pilih anggota Organisasi…">
                {addableMembers.find((u) => u.id === pickedUserId)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {addableMembers.length === 0 && (
                <div className="px-2 py-1.5 text-caption text-muted-foreground">
                  Semua anggota Organisasi sudah memiliki akses.
                </div>
              )}
              {addableMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name} — {member.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={addRole} onValueChange={(v) => v && setAddRole(v as SpaceRole)}>
            <SelectTrigger className="w-32">
              <SelectValue>{ROLE_LABELS[addRole]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => void handleAddMember()} disabled={!pickedUserId}>
            <UserPlus className="size-3.5" />
            Tambah
          </Button>
        </div>

        <div className="mt-8 flex flex-col gap-1">
          {permissions.map((perm) => {
            const member = allUsers.find((u) => u.id === perm.userId);
            if (!member) return null;
            return (
              <div key={perm.id} className="flex items-center justify-between gap-3 rounded-md px-3 py-3 hover:bg-accent">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-caption font-semibold text-secondary-foreground">
                    {member.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-body-sm text-foreground">{member.name}</p>
                    <p className="text-caption text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={perm.role} onValueChange={(v) => v && void handleRoleChange(perm.userId, v as SpaceRole)}>
                    <SelectTrigger className="w-28">
                      <SelectValue>{ROLE_LABELS[perm.role]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Hapus anggota"
                    onClick={() => setRemoveTarget({ permissionId: perm.id, name: member.name })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <DeleteConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Hapus ${removeTarget?.name ?? "anggota"} dari Space ini?`}
        description="Mereka akan langsung kehilangan akses ke Space ini. Anda dapat menambahkan mereka kembali kapan saja."
        confirmLabel="Hapus Anggota"
        isDeleting={isRemoving}
        onConfirm={() => void handleRemoveMember()}
      />
    </main>
  );
}
