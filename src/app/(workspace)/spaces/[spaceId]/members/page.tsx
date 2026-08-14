"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { NotFoundState } from "@/components/beacon/not-found-state";
import { useSession } from "@/hooks/use-session";
import {
  useSpace,
  useSpaceRole,
  useSpacePermissions,
  useUpdateSpaceRole,
  useSpacePendingInvites,
  useInviteToSpace,
  useCancelInvite,
} from "@/hooks/use-spaces";
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
  const pendingInvites = useSpacePendingInvites(spaceId);
  const inviteToSpace = useInviteToSpace();
  const cancelInvite = useCancelInvite();
  const allUsers = useUsers(space?.organizationId);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SpaceRole>("viewer");

  if (!user || role !== "admin") {
    return <NotFoundState />;
  }
  if (!space) return null;

  async function handleRoleChange(userId: string, newRole: SpaceRole) {
    try {
      await updateRole(spaceId, userId, newRole);
      toast.success("Peran diperbarui.");
    } catch {
      toast.error("Tidak dapat memperbarui peran, silakan coba lagi.");
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    try {
      const result = await inviteToSpace(spaceId, inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      toast.success(result.status === "added" ? "Anggota langsung ditambahkan." : "Undangan terkirim.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("EMAIL_BELONGS_TO_ANOTHER_ORGANIZATION")) {
        toast.error("Email ini terdaftar di Organisasi lain.");
      } else {
        toast.error("Tidak dapat mengirim undangan, silakan coba lagi.");
      }
    }
  }

  async function handleCancelInvite(inviteId: string) {
    try {
      await cancelInvite(inviteId);
      toast("Undangan dibatalkan.");
    } catch {
      toast.error("Tidak dapat membatalkan undangan, silakan coba lagi.");
    }
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[42rem] px-8 py-10">
        <h1 className="text-h1 font-bold text-foreground">Anggota</h1>
        <p className="mt-1.5 text-body text-muted-foreground">{space.name}</p>

        <div className="mt-8 flex gap-2">
          <Input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Undang lewat email…"
            type="email"
            className="flex-1"
          />
          <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v as SpaceRole)}>
            <SelectTrigger className="w-32">
              <SelectValue>{ROLE_LABELS[inviteRole]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => void handleInvite()} disabled={!inviteEmail.trim()}>
            <UserPlus className="size-3.5" />
            Undang
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
              </div>
            );
          })}
        </div>

        {pendingInvites.length > 0 && (
          <div className="mt-8">
            <p className="mb-2 text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">
              Undangan tertunda
            </p>
            <div className="flex flex-col gap-1">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between gap-3 rounded-md px-3 py-3">
                  <span className="text-body-sm text-muted-foreground">{invite.email}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="pending">Menunggu</Badge>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Batalkan undangan"
                      onClick={() => void handleCancelInvite(invite.id)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
