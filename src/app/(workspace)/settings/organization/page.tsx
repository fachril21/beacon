"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Globe, CheckCircle2, AlertTriangle, Loader2, UserPlus, X, Trash2, Crown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NotFoundState } from "@/components/beacon/not-found-state";
import { DeleteConfirmDialog } from "@/components/workspace/delete-confirm-dialog";
import { useSession } from "@/hooks/use-session";
import {
  useCurrentOrganization,
  useOrganizationDomainActions,
  useOrganizationRole,
  useOrganizationMembers,
  useOrganizationInvitations,
  useInviteToOrganization,
  useRevokeInvitation,
  useRemoveOrgMember,
  useTransferOwnership,
} from "@/hooks/use-organizations";
import { useUsers } from "@/hooks/use-users";
import type { InvitableOrganizationRole, OrganizationRole } from "@/lib/types";

const ROLE_LABELS: Record<OrganizationRole, string> = { owner: "Owner", admin: "Admin", member: "Member" };
const INVITABLE_ROLE_LABELS: Record<InvitableOrganizationRole, string> = { admin: "Admin", member: "Member" };

export default function OrganizationSettingsPage() {
  const { user } = useSession();
  const organization = useCurrentOrganization();
  const role = useOrganizationRole(organization?.id, user?.id);

  if (!user || !organization || !role) {
    return <NotFoundState />;
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[42rem] px-8 py-10">
        <h1 className="text-h1 font-bold text-foreground">Pengaturan Organisasi</h1>
        <p className="mt-1.5 text-body text-muted-foreground">{organization.name}</p>

        <Tabs defaultValue="members" className="mt-8">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="domain">Domain</TabsTrigger>
          </TabsList>
          <TabsContent value="members" className="mt-6">
            <MembersTab organizationId={organization.id} currentUserId={user.id} currentUserRole={role} />
          </TabsContent>
          <TabsContent value="domain" className="mt-6">
            <DomainTab organizationId={organization.id} isOwner={role === "owner"} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function MembersTab({
  organizationId,
  currentUserId,
  currentUserRole,
}: {
  organizationId: string;
  currentUserId: string;
  currentUserRole: OrganizationRole;
}) {
  const members = useOrganizationMembers(organizationId);
  const invitations = useOrganizationInvitations(organizationId);
  const allUsers = useUsers();
  const inviteToOrganization = useInviteToOrganization();
  const revokeInvitation = useRevokeInvitation();
  const removeOrgMember = useRemoveOrgMember();
  const transferOwnership = useTransferOwnership();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InvitableOrganizationRole>("member");
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; name: string } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";
  const pendingInvitations = invitations.filter((i) => i.status === "pending");

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    try {
      const result = await inviteToOrganization(organizationId, inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      if (result.status === "added") {
        toast.success("Anggota langsung ditambahkan.");
      } else if (result.emailSent) {
        toast.success("Undangan terkirim.");
      } else {
        toast("Undangan dicatat, tapi email gagal dikirim.", {
          description: "Beri tahu orang tersebut secara langsung untuk mendaftar.",
        });
      }
    } catch {
      toast.error("Tidak dapat mengirim undangan, silakan coba lagi.");
    }
  }

  async function handleRevoke(invitationId: string) {
    try {
      await revokeInvitation(invitationId);
      toast("Undangan dibatalkan.");
    } catch {
      toast.error("Tidak dapat membatalkan undangan, silakan coba lagi.");
    }
  }

  async function handleRemoveMember() {
    if (!removeTarget) return;
    setIsRemoving(true);
    try {
      await removeOrgMember(organizationId, removeTarget.userId);
      toast("Anggota telah dihapus.");
      setRemoveTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("CANNOT_REMOVE_OWNER")) {
        toast.error("Pindahkan kepemilikan sebelum menghapus Owner.");
      } else {
        toast.error("Tidak dapat menghapus anggota, silakan coba lagi.");
      }
    } finally {
      setIsRemoving(false);
    }
  }

  async function handleTransferOwnership(newOwnerUserId: string) {
    try {
      await transferOwnership(organizationId, newOwnerUserId);
      toast.success("Kepemilikan Organisasi telah dipindahkan.");
    } catch {
      toast.error("Tidak dapat memindahkan kepemilikan, silakan coba lagi.");
    }
  }

  return (
    <div>
      {canManage && (
        <div className="flex gap-2">
          <Input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Undang lewat email…"
            type="email"
            className="flex-1"
          />
          <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v as InvitableOrganizationRole)}>
            <SelectTrigger className="w-32">
              <SelectValue>{INVITABLE_ROLE_LABELS[inviteRole]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => void handleInvite()} disabled={!inviteEmail.trim()}>
            <UserPlus className="size-3.5" />
            Undang
          </Button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-1">
        {members.map((member) => {
          const person = allUsers.find((u) => u.id === member.userId);
          if (!person) return null;
          return (
            <div key={member.id} className="flex items-center justify-between gap-3 rounded-md px-3 py-3 hover:bg-accent">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-caption font-semibold text-secondary-foreground">
                  {person.name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-body-sm text-foreground">{person.name}</p>
                  <p className="text-caption text-muted-foreground">{person.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={member.role === "owner" ? "published" : "secondary"}>{ROLE_LABELS[member.role]}</Badge>
                {currentUserRole === "owner" && member.role !== "owner" && member.userId !== currentUserId && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Jadikan Owner"
                    onClick={() => void handleTransferOwnership(member.userId)}
                  >
                    <Crown className="size-3.5" />
                  </Button>
                )}
                {canManage && member.role !== "owner" && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Hapus anggota"
                    onClick={() => setRemoveTarget({ userId: member.userId, name: person.name })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pendingInvitations.length > 0 && (
        <div className="mt-8">
          <p className="mb-2 text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">Undangan tertunda</p>
          <div className="flex flex-col gap-1">
            {pendingInvitations.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-3 rounded-md px-3 py-3">
                <span className="text-body-sm text-muted-foreground">{invite.email}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="pending">Menunggu</Badge>
                  {canManage && (
                    <Button size="icon-sm" variant="ghost" aria-label="Batalkan undangan" onClick={() => void handleRevoke(invite.id)}>
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Hapus ${removeTarget?.name ?? "anggota"} dari Organisasi ini?`}
        description="Mereka akan langsung kehilangan akses ke seluruh Space dalam Organisasi ini."
        confirmLabel="Hapus Anggota"
        isDeleting={isRemoving}
        onConfirm={() => void handleRemoveMember()}
      />
    </div>
  );
}

function DomainTab({ organizationId, isOwner }: { organizationId: string; isOwner: boolean }) {
  const { addDomain, verifyDomain, removeDomain } = useOrganizationDomainActions(organizationId);
  const organization = useCurrentOrganization();
  const [domainInput, setDomainInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyFailed, setVerifyFailed] = useState(false);

  if (!isOwner) {
    return <p className="text-body-sm text-muted-foreground">Hanya Owner Organisasi yang dapat mengelola domain.</p>;
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
    try {
      const success = await verifyDomain();
      if (success) {
        toast.success("Domain berhasil diverifikasi.");
      } else {
        setVerifyFailed(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verifikasi domain gagal, silakan coba lagi.");
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <Card className="p-6">
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
            <Input id="domain-input" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} placeholder="docs.dibimbing.id" />
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
  );
}
