"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, History, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/workspace/delete-confirm-dialog";
import { SaveStatusIndicator } from "./save-status-indicator";
import { useOrganization } from "@/hooks/use-organizations";
import { usePublishActions, useDeletePage, hasUnpublishedChanges, getPageStatus } from "@/hooks/use-pages";
import { useHelpfulnessRate } from "@/hooks/use-feedback";
import { isPageNearlyEmpty } from "@/lib/content-empty";
import { StatusBadge } from "@/components/beacon/status-badge";
import type { Page, Space, SpaceRole } from "@/lib/types";
import type { SaveStatus } from "@/hooks/use-page-autosave";

interface PageEditorToolbarProps {
  page: Page;
  space: Space;
  title: string;
  saveStatus: SaveStatus;
  /** The current user's role in this Page's Space. Publish/Update/Unpublish are
   * editor/admin-only (US17.2) — RLS already rejects the write; this hides the
   * dead-click affordance so a viewer never sees actions they can't use. */
  role: SpaceRole | null;
  onOpenVersionHistory?: () => void;
}

export function PageEditorToolbar({ page, space, title, saveStatus, role, onOpenVersionHistory }: PageEditorToolbarProps) {
  const router = useRouter();
  const organization = useOrganization(space.organizationId);
  const { publish, update, unpublish } = usePublishActions();
  const deletePage = useDeletePage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [emptyWarningOpen, setEmptyWarningOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [deletePageOpen, setDeletePageOpen] = useState(false);
  const [isDeletingPage, setIsDeletingPage] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  const canEdit = role === "editor" || role === "admin";

  const orgVerified = organization?.isDomainVerified ?? false;
  const disabledReason = !space.isPublishable
    ? "Minta admin Space untuk menandai Space ini sebagai dapat dipublikasikan."
    : !orgVerified
      ? "Organisasi Anda memerlukan domain terverifikasi sebelum dapat memublikasikan — lihat Pengaturan Organisasi."
      : null;

  const pendingChanges = hasUnpublishedChanges(page);
  const status = getPageStatus(page);
  const helpfulness = useHelpfulnessRate(canEdit && page.isPublished ? page.id : undefined);

  async function doPublish() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOffline(true);
      toast("Akan dipublikasikan setelah kembali online", { description: "Tindakan ini disimpan dan akan dijalankan otomatis." });
      return;
    }
    try {
      await publish(page.id);
      toast.success("Halaman berhasil dipublikasikan", {
        action: { label: "Lihat halaman publik", onClick: () => router.push(`/public/pages/${page.id}`) },
      });
    } catch {
      toast.error("Gagal memublikasikan halaman, silakan coba lagi.");
    }
  }

  function handlePublishClick() {
    if (disabledReason) return;
    if (isPageNearlyEmpty(title, page.content)) {
      setEmptyWarningOpen(true);
      return;
    }
    setConfirmOpen(true);
  }

  async function handleUpdate() {
    try {
      await update(page.id);
      toast.success("Pembaruan telah dipublikasikan.");
    } catch {
      toast.error("Gagal memublikasikan pembaruan, silakan coba lagi.");
    }
  }

  async function handleDeletePage() {
    setIsDeletingPage(true);
    try {
      await deletePage(page.id);
      setDeletePageOpen(false);
      toast("Halaman telah dihapus.");
      router.push(`/spaces/${space.id}`);
    } catch {
      toast.error("Gagal menghapus Halaman, silakan coba lagi.");
      setIsDeletingPage(false);
    }
  }

  return (
    <header className="flex shrink-0 flex-col border-b border-border">
      <div className="flex items-center justify-between gap-4 px-6 py-3">
        {/* Breadcrumb, left — status/mode badges sit inline beside it */}
        <nav className="flex min-w-0 items-center gap-1.5 text-body-sm text-muted-foreground">
          <Link href={`/spaces/${space.id}`} className="truncate hover:text-foreground">
            {space.name}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate text-foreground">{title || "Halaman tanpa judul"}</span>
          {page.isPublished && <StatusBadge status={status} className="ml-1" />}
          {canEdit && helpfulness.total > 0 && (
            <Badge variant="outline" className="ml-1 shrink-0 font-normal text-muted-foreground">
              {Math.round((helpfulness.rate ?? 0) * 100)}% membantu · {helpfulness.total} respons
            </Badge>
          )}
        </nav>

        {/* Right-aligned utility row, then the primary action + overflow joined as one control */}
        <div className="flex shrink-0 items-center gap-3">
          <SaveStatusIndicator status={saveStatus} />

          <div data-slot="button-group" className="flex items-stretch overflow-hidden rounded-md">
            {!canEdit ? null : page.isPublished ? (
              <Button size="sm" variant="secondary" onClick={handleUpdate} disabled={!pendingChanges} className="rounded-r-none">
                Perbarui
              </Button>
            ) : disabledReason ? (
              <Tooltip>
                <TooltipTrigger render={<span tabIndex={0} />}>
                  <Button
                    size="sm"
                    disabled
                    className="pointer-events-none rounded-r-none bg-secondary text-muted-foreground opacity-100 hover:bg-secondary"
                  >
                    Publikasikan
                  </Button>
                </TooltipTrigger>
                <TooltipContent className={!space.isPublishable ? "" : "border-t-2 border-t-warning"}>{disabledReason}</TooltipContent>
              </Tooltip>
            ) : (
              <Button size="sm" onClick={handlePublishClick} className="rounded-r-none">
                Publikasikan
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant={!canEdit ? "ghost" : canEdit && !page.isPublished && !disabledReason ? "default" : "secondary"}
                    aria-label="Menu lainnya"
                    className={canEdit ? "rounded-l-none border-l border-l-background/20" : ""}
                  />
                }
              >
                <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpenVersionHistory?.()}>
                  <History className="size-3.5" />
                  Riwayat Versi
                </DropdownMenuItem>
                {canEdit && page.isPublished && (
                  <DropdownMenuItem variant="destructive" onClick={() => setUnpublishOpen(true)}>
                    Batalkan Publikasi
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeletePageOpen(true)}>
                      <Trash2 className="size-3.5" />
                      Hapus Halaman
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {canEdit && page.isPublished && pendingChanges && (
        <div className="flex items-center justify-between gap-3 border-t border-warning/30 bg-warning-muted px-6 py-2.5">
          <p className="text-body-sm text-warning-muted-foreground">Anda memiliki perubahan yang belum dipublikasikan.</p>
          <Button size="sm" variant="secondary" onClick={handleUpdate}>
            Perbarui
          </Button>
        </div>
      )}
      {isOffline && (
        <div className="border-t border-warning/30 bg-warning-muted px-6 py-2 text-caption text-warning-muted-foreground">
          Akan dipublikasikan setelah kembali online.
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publikasikan halaman ini?</DialogTitle>
            <DialogDescription>Halaman akan langsung terlihat di situs publik.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                doPublish();
              }}
            >
              Publikasikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emptyWarningOpen} onOpenChange={setEmptyWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Halaman ini masih kosong</DialogTitle>
            <DialogDescription>
              Sebaiknya tambahkan judul dan konten terlebih dahulu. Anda tetap dapat memublikasikan apa adanya jika yakin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEmptyWarningOpen(false)}>
              Kembali menulis
            </Button>
            <Button
              onClick={() => {
                setEmptyWarningOpen(false);
                setConfirmOpen(true);
              }}
            >
              Publikasikan tetap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unpublishOpen} onOpenChange={setUnpublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan publikasi halaman ini?</DialogTitle>
            <DialogDescription>Pengunjung tidak akan lagi dapat melihat halaman ini.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setUnpublishOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setUnpublishOpen(false);
                unpublish(page.id)
                  .then(() => toast("Halaman telah dibatalkan publikasinya."))
                  .catch(() => toast.error("Gagal membatalkan publikasi, silakan coba lagi."));
              }}
            >
              Batalkan Publikasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deletePageOpen}
        onOpenChange={setDeletePageOpen}
        title="Hapus Halaman ini?"
        description="Halaman ini beserta seluruh sub-halaman di dalamnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus Halaman"
        isDeleting={isDeletingPage}
        onConfirm={() => void handleDeletePage()}
      />
    </header>
  );
}
