"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, ExternalLink, History, MessageSquare, PanelRight, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/workspace/delete-confirm-dialog";
import { SaveStatusIndicator } from "./save-status-indicator";
import { useOrganization } from "@/hooks/use-organizations";
import { usePublishActions, useDeletePage, hasUnpublishedChanges, getPageStatus } from "@/hooks/use-pages";
import { isPageNearlyEmpty } from "@/lib/content-empty";
import { buildPublicPageUrl } from "@/lib/public-url";
import { describePublishError } from "@/lib/publish-error";
import { StatusBadge } from "@/components/beacon/status-badge";
import { cn } from "@/lib/utils";
import { EDITOR_PANEL_TOGGLE_ID, EDITOR_SIDE_PANEL_ID, type EditorSidePanelTab } from "./editor-side-panel-tab";
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
  /** Parent Page for the middle breadcrumb crumb; null/undefined for a top-level Page. */
  parentPage?: Page | null;
  /** Which side-panel tab is showing, or null when the panel is closed. */
  panelTab?: EditorSidePanelTab | null;
  /** Comments/Riwayat icons: open the panel on that tab, or close it if that tab is already showing. */
  onTogglePanelTab?: (tab: EditorSidePanelTab) => void;
  /** Panel toggle button: open (on the last-used tab) or close the side panel. */
  onTogglePanel?: () => void;
  /** "Riwayat Versi" menu item — opens the side panel on the Riwayat tab. */
  onOpenVersionHistory?: () => void;
}

export function PageEditorToolbar({
  page,
  space,
  title,
  saveStatus,
  role,
  parentPage,
  panelTab = null,
  onTogglePanelTab,
  onTogglePanel,
  onOpenVersionHistory,
}: PageEditorToolbarProps) {
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

  // Publishing only ever depends on the Space's own isPublishable flag — a
  // verified custom domain is no longer required, since every Organization
  // can publish under the platform domain (/public/{orgSlug}) by default.
  const disabledReason = !space.isPublishable
    ? "Minta admin Space untuk menandai Space ini sebagai dapat dipublikasikan."
    : null;

  const pendingChanges = hasUnpublishedChanges(page);
  const status = getPageStatus(page);
  const publicUrl = buildPublicPageUrl(organization?.slug, page.slug);

  function reportFailure(headline: string, error: unknown) {
    console.error("[beacon] publish action failed:", error);
    toast.error(headline, { description: describePublishError(error) });
  }

  async function doPublish() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOffline(true);
      toast("Akan dipublikasikan setelah kembali online", { description: "Tindakan ini disimpan dan akan dijalankan otomatis." });
      return;
    }
    try {
      const publishedPage = await publish(page.id);
      const publishedUrl = buildPublicPageUrl(organization?.slug, publishedPage.slug);
      toast.success(
        "Halaman berhasil dipublikasikan",
        publishedUrl ? { action: { label: "Lihat halaman publik", onClick: () => router.push(publishedUrl) } } : undefined,
      );
    } catch (error) {
      reportFailure("Gagal memublikasikan halaman, silakan coba lagi.", error);
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
    } catch (error) {
      reportFailure("Gagal memublikasikan pembaruan, silakan coba lagi.", error);
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
      <div className="flex h-topbar items-center justify-between gap-4 px-5">
        {/* Breadcrumb, left: Space / parent Page / this Page */}
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-1.5 text-body-sm text-muted-foreground">
            <li className="min-w-0 truncate">
              <Link href={`/spaces/${space.id}`} className="rounded-sm hover:text-foreground">
                {space.name}
              </Link>
            </li>
            {parentPage && (
              <>
                <li aria-hidden className="shrink-0">
                  <ChevronRight className="size-3.5 text-muted-foreground/60" />
                </li>
                <li className="min-w-0 truncate">
                  <Link href={`/spaces/${space.id}/pages/${parentPage.id}`} className="rounded-sm hover:text-foreground">
                    {parentPage.title || "Halaman tanpa judul"}
                  </Link>
                </li>
              </>
            )}
            <li aria-hidden className="shrink-0">
              <ChevronRight className="size-3.5 text-muted-foreground/60" />
            </li>
            <li aria-current="page" className="min-w-0 truncate text-foreground">
              {title || "Halaman tanpa judul"}
            </li>
          </ol>
        </nav>

        {/* Right cluster: save status, panel shortcuts, then status + the primary action/overflow joined as one control */}
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1.5">
            <SaveStatusIndicator status={saveStatus} />
          </span>
          <PanelIconButton
            label="Komentar"
            active={panelTab === "comments"}
            onClick={() => onTogglePanelTab?.("comments")}
          >
            <MessageSquare className="size-4" />
          </PanelIconButton>
          <PanelIconButton label="Riwayat versi" active={panelTab === "history"} onClick={() => onTogglePanelTab?.("history")}>
            <History className="size-4" />
          </PanelIconButton>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  id={EDITOR_PANEL_TOGGLE_ID}
                  size="icon"
                  variant="ghost"
                  aria-label="Panel samping"
                  aria-expanded={panelTab !== null}
                  aria-controls={panelTab !== null ? EDITOR_SIDE_PANEL_ID : undefined}
                  onClick={() => onTogglePanel?.()}
                  className={cn("text-muted-foreground", panelTab !== null && "bg-accent text-foreground")}
                />
              }
            >
              <PanelRight className="size-4" />
            </TooltipTrigger>
            <TooltipContent>{panelTab !== null ? "Tutup panel samping" : "Buka panel samping"}</TooltipContent>
          </Tooltip>
          {page.isPublished && publicUrl && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Lihat halaman publik"
                    className={cn(buttonVariants({ size: "icon", variant: "ghost" }), "text-muted-foreground")}
                  />
                }
              >
                <ExternalLink className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Lihat halaman publik</TooltipContent>
            </Tooltip>
          )}

          <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />
          <StatusBadge status={status} className="mr-1.5" />

          <div data-slot="button-group" className="flex items-stretch overflow-hidden rounded-md">
            {!canEdit ? null : page.isPublished ? (
              <Button size="sm" variant="secondary" onClick={handleUpdate} disabled={!pendingChanges} className="h-8 rounded-r-none">
                Perbarui
              </Button>
            ) : disabledReason ? (
              <Tooltip>
                <TooltipTrigger render={<span tabIndex={0} />}>
                  <Button
                    size="sm"
                    disabled
                    className="pointer-events-none h-8 rounded-r-none bg-secondary text-muted-foreground opacity-100 hover:bg-secondary"
                  >
                    Publikasikan
                  </Button>
                </TooltipTrigger>
                <TooltipContent className={!space.isPublishable ? "" : "border-t-2 border-t-warning"}>{disabledReason}</TooltipContent>
              </Tooltip>
            ) : (
              <Button size="sm" onClick={handlePublishClick} className="h-8 rounded-r-none">
                Publikasikan
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="icon"
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
                  .catch((error: unknown) => reportFailure("Gagal membatalkan publikasi, silakan coba lagi.", error));
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

function PanelIconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            aria-label={label}
            aria-pressed={active}
            onClick={onClick}
            className={cn("text-muted-foreground", active && "bg-accent text-foreground")}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
