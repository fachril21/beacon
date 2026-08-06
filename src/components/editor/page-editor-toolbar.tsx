"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SaveStatusIndicator } from "./save-status-indicator";
import { useOrganization } from "@/hooks/use-organizations";
import { usePublishActions, hasUnpublishedChanges, getPageStatus } from "@/hooks/use-pages";
import { isPageNearlyEmpty } from "@/lib/content-empty";
import { StatusBadge } from "@/components/beacon/status-badge";
import type { Page, Space } from "@/lib/types";
import type { SaveStatus } from "@/hooks/use-page-autosave";

interface PageEditorToolbarProps {
  page: Page;
  space: Space;
  title: string;
  saveStatus: SaveStatus;
  onOpenVersionHistory?: () => void;
}

export function PageEditorToolbar({ page, space, title, saveStatus, onOpenVersionHistory }: PageEditorToolbarProps) {
  const router = useRouter();
  const organization = useOrganization(space.organizationId);
  const { publish, update, unpublish } = usePublishActions();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [emptyWarningOpen, setEmptyWarningOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);

  const orgVerified = organization?.isDomainVerified ?? false;
  const disabledReason = !space.isPublishable
    ? "Minta admin Space untuk menandai Space ini sebagai dapat dipublikasikan."
    : !orgVerified
      ? "Organisasi Anda memerlukan domain terverifikasi sebelum dapat memublikasikan — lihat Pengaturan Organisasi."
      : null;

  const pendingChanges = hasUnpublishedChanges(page);
  const status = getPageStatus(page);

  function doPublish() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOffline(true);
      toast("Akan dipublikasikan setelah kembali online", { description: "Tindakan ini disimpan dan akan dijalankan otomatis." });
      return;
    }
    publish(page.id);
    toast.success("Halaman berhasil dipublikasikan", {
      action: { label: "Lihat halaman publik", onClick: () => router.push(`/public/pages/${page.id}`) },
    });
  }

  function handlePublishClick() {
    if (disabledReason) return;
    if (isPageNearlyEmpty(title, page.content)) {
      setEmptyWarningOpen(true);
      return;
    }
    setConfirmOpen(true);
  }

  function handleUpdate() {
    update(page.id);
    toast.success("Pembaruan telah dipublikasikan.");
  }

  return (
    <header className="flex shrink-0 flex-col border-b border-border">
      <div className="flex items-center justify-between gap-4 px-6 py-3">
        <nav className="flex min-w-0 items-center gap-1.5 text-body-sm text-muted-foreground">
          <Link href={`/spaces/${space.id}`} className="truncate hover:text-foreground">
            {space.name}
          </Link>
          <span>/</span>
          <span className="truncate text-foreground">{title || "Halaman tanpa judul"}</span>
          {page.isPublished && <StatusBadge status={status} className="ml-1" />}
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          <SaveStatusIndicator status={saveStatus} />

          {page.isPublished ? (
            <Button size="sm" variant="secondary" onClick={handleUpdate} disabled={!pendingChanges}>
              Perbarui
            </Button>
          ) : disabledReason ? (
            <Tooltip>
              <TooltipTrigger render={<span tabIndex={0} />}>
                <Button
                  size="sm"
                  disabled
                  className="pointer-events-none bg-secondary text-muted-foreground opacity-100 hover:bg-secondary"
                >
                  Publikasikan
                </Button>
              </TooltipTrigger>
              <TooltipContent className={!space.isPublishable ? "" : "border-t-2 border-t-warning"}>{disabledReason}</TooltipContent>
            </Tooltip>
          ) : (
            <Button size="sm" onClick={handlePublishClick}>
              Publikasikan
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Menu lainnya" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpenVersionHistory?.()}>
                <History className="size-3.5" />
                Riwayat Versi
              </DropdownMenuItem>
              {page.isPublished && (
                <DropdownMenuItem variant="destructive" onClick={() => setUnpublishOpen(true)}>
                  Batalkan Publikasi
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {page.isPublished && pendingChanges && (
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
                unpublish(page.id);
                setUnpublishOpen(false);
                toast("Halaman telah dibatalkan publikasinya.");
              }}
            >
              Batalkan Publikasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
