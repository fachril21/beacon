"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  ArrowUpRight,
  FileText,
  FolderInput,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/beacon/empty-state";
import { StatusBadge } from "@/components/beacon/status-badge";
import { DeleteConfirmDialog } from "@/components/workspace/delete-confirm-dialog";
import { useSpace, useSpaceRole, updateSpaceRecord } from "@/hooks/use-spaces";
import {
  useCreatePage,
  useDeletePage,
  usePages,
  usePublishActions,
  useUpdatePageTitle,
  useUpdatePageVisibility,
  getPageStatus,
  hasUnpublishedChanges,
} from "@/hooks/use-pages";
import { useUsers } from "@/hooks/use-users";
import { useSession } from "@/hooks/use-session";
import { buildPageTree, flattenPageTree } from "@/lib/build-page-tree";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { titleOrUntitled } from "@/lib/page-label";
import { layoutPageIds, mergeLayoutWithPages, movePageInLayout, sectionForPage } from "@/lib/space-layout";
import type { Page, SpaceLayout } from "@/lib/types";

const STATUS_FILTERS = [
  { value: "all", label: "Semua" },
  { value: "draft", label: "Draf" },
  { value: "published", label: "Dipublikasikan" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

export default function SpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  const router = useRouter();
  const { user } = useSession();
  const space = useSpace(spaceId);
  const role = useSpaceRole(spaceId, user?.id);
  const canEdit = role === "editor" || role === "admin";
  const pages = usePages(spaceId);
  const authors = useUsers(space?.organizationId);
  const createPage = useCreatePage();
  const deletePage = useDeletePage();
  const updatePageTitle = useUpdatePageTitle();
  const updatePageVisibility = useUpdatePageVisibility();
  const publishActions = usePublishActions();
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<Page | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Page | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [layoutOverride, setLayoutOverride] = useState<SpaceLayout | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const authorsById = useMemo(() => new Map(authors.map((author) => [author.id, author])), [authors]);
  const baseLayout = useMemo(() => mergeLayoutWithPages(space?.layout, pages), [space?.layout, pages]);
  const layout = layoutOverride ?? baseLayout;
  const depthByPageId = useMemo(
    () => new Map(flattenPageTree(buildPageTree(pages)).map(({ page, depth }) => [page.id, depth])),
    [pages],
  );
  const pagesById = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);

  const rows = useMemo(
    () =>
      layoutPageIds(layout)
        .map((pageId) => pagesById.get(pageId))
        .filter((page): page is Page => Boolean(page))
        .map((page) => ({
          page,
          depth: depthByPageId.get(page.id) ?? 0,
          section: sectionForPage(layout, page.id),
        })),
    [layout, pagesById, depthByPageId],
  );

  const filteredRows = rows.filter(({ page }) => {
    if (statusFilter === "draft" && page.isPublished) return false;
    if (statusFilter === "published" && !page.isPublished) return false;
    if (filterText.trim() && !page.title.toLowerCase().includes(filterText.trim().toLowerCase())) return false;
    return true;
  });

  async function handleNewPage() {
    if (!user || !space) return;
    try {
      const page = await createPage({ spaceId: space.id, parentPageId: null, title: "", createdByUserId: user.id });
      router.push(`/spaces/${space.id}/pages/${page.id}`);
    } catch {
      toast.error("Tidak dapat membuat Halaman, silakan coba lagi.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deletePage(deleteTarget.id);
      toast("Halaman telah dihapus.");
      setDeleteTarget(null);
    } catch {
      toast.error("Gagal menghapus Halaman, silakan coba lagi.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRename() {
    if (!renameTarget) return;
    const nextTitle = renameValue.trim();
    if (!nextTitle) {
      toast.error("Nama halaman tidak boleh kosong.");
      return;
    }
    setIsRenaming(true);
    try {
      await updatePageTitle(renameTarget.id, nextTitle);
      toast.success("Nama halaman diperbarui.");
      setRenameTarget(null);
    } catch {
      toast.error("Gagal memperbarui nama halaman, silakan coba lagi.");
    } finally {
      setIsRenaming(false);
    }
  }

  async function handlePublishToggle(page: Page) {
    try {
      if (!page.isPublished) {
        await publishActions.publish(page.id);
        toast.success("Halaman dipublikasikan.");
      } else if (hasUnpublishedChanges(page)) {
        await publishActions.update(page.id);
        toast.success("Publikasi halaman diperbarui.");
      } else {
        await publishActions.unpublish(page.id);
        toast("Halaman dibatalkan publikasinya.");
      }
    } catch {
      toast.error("Gagal mengubah status publikasi, silakan coba lagi.");
    }
  }

  async function handleVisibilityToggle(page: Page) {
    const next = page.visibility === "publishable" ? "internal" : "publishable";
    try {
      await updatePageVisibility(page.id, next);
      toast.success(next === "publishable" ? "Halaman dapat dipublikasikan." : "Halaman dijadikan internal.");
    } catch {
      toast.error("Gagal mengubah visibilitas halaman, silakan coba lagi.");
    }
  }

  async function persistLayout(next: SpaceLayout, previous: SpaceLayout) {
    setLayoutOverride(next);
    try {
      await updateSpaceRecord(spaceId, { layout: next });
    } catch {
      setLayoutOverride(previous);
      toast.error("Gagal menyimpan urutan halaman, silakan coba lagi.");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const source = sectionForPage(layout, activeId);
    const target = sectionForPage(layout, overId);
    if (!source || !target) return;

    const sourceIndex = source.pages.findIndex((item) => item.pageId === activeId);
    const overIndex = target.pages.findIndex((item) => item.pageId === overId);
    let targetIndex = overIndex === -1 ? target.pages.length : overIndex;
    if (source.id === target.id && sourceIndex !== -1 && sourceIndex < targetIndex) targetIndex -= 1;
    if (source.id === target.id && sourceIndex === targetIndex) return;

    void persistLayout(movePageInLayout(layout, activeId, target.id, targetIndex), layout);
  }

  function movePageToSection(page: Page, sectionId: string) {
    const target = layout.sections.find((section) => section.id === sectionId);
    if (!target) return;
    void persistLayout(movePageInLayout(layout, page.id, sectionId, target.pages.length), layout);
  }

  if (!space) return null;

  if (pages.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Belum ada halaman"
        description="Mulai menulis panduan pertama untuk Space ini."
        actionLabel="+ Halaman baru"
        onAction={() => void handleNewPage()}
        className="mt-16"
      />
    );
  }

  const targetHasChildren = deleteTarget ? pages.some((page) => page.parentPageId === deleteTarget.id) : false;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          placeholder="Cari halaman…"
          className="h-9 max-w-xs"
        />
        <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                "rounded-sm px-2.5 py-1 text-body-sm font-medium text-muted-foreground",
                statusFilter === filter.value && "bg-background text-foreground shadow-sm",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-caption text-muted-foreground">
          {filteredRows.length} dari {rows.length} halaman
        </span>
      </div>

      {filteredRows.length === 0 ? (
        <p className="mt-8 text-body-sm text-muted-foreground">Tidak ada halaman yang cocok.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredRows.map(({ page }) => page.id)} strategy={verticalListSortingStrategy}>
            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <div className="hidden grid-cols-[1.5rem_minmax(0,1fr)_9rem_8rem_9rem_8rem_2rem] items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 text-caption font-semibold tracking-[0.03em] text-muted-foreground uppercase lg:grid">
                <span className="sr-only">Urutan</span>
                <span>Judul</span>
                <span>Bagian</span>
                <span>Status</span>
                <span>Penulis</span>
                <span>Diubah</span>
                <span className="sr-only">Menu</span>
              </div>
              <div className="divide-y divide-border">
                {filteredRows.map(({ page, depth, section }) => (
                  <SortablePageRow
                    key={page.id}
                    page={page}
                    depth={depth}
                    sectionTitle={section?.title ?? "Halaman"}
                    authorName={authorsById.get(page.createdByUserId)?.name}
                    canEdit={canEdit}
                    sections={layout.sections}
                    onRename={() => {
                      setRenameTarget(page);
                      setRenameValue(page.title);
                    }}
                    onDelete={() => setDeleteTarget(page)}
                    onPublishToggle={() => void handlePublishToggle(page)}
                    onVisibilityToggle={() => void handleVisibilityToggle(page)}
                    onMoveToSection={(sectionId) => movePageToSection(page, sectionId)}
                  />
                ))}
              </div>
            </div>
          </SortableContext>
        </DndContext>
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Hapus "${titleOrUntitled(deleteTarget?.title)}"?`}
        description={
          targetHasChildren
            ? "Halaman ini beserta seluruh sub-halaman di dalamnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
            : "Halaman ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        }
        isDeleting={isDeleting}
        onConfirm={() => void handleDelete()}
      />

      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah nama halaman</DialogTitle>
            <DialogDescription>Nama ini tampil di sidebar, daftar halaman, dan halaman publik.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rename-page-title">Nama halaman</Label>
            <Input
              id="rename-page-title"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleRename();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameTarget(null)} disabled={isRenaming}>
              Batal
            </Button>
            <Button onClick={() => void handleRename()} disabled={isRenaming || !renameValue.trim()}>
              {isRenaming ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortablePageRow({
  page,
  depth,
  sectionTitle,
  authorName,
  canEdit,
  sections,
  onRename,
  onDelete,
  onPublishToggle,
  onVisibilityToggle,
  onMoveToSection,
}: {
  page: Page;
  depth: number;
  sectionTitle: string;
  authorName: string | undefined;
  canEdit: boolean;
  sections: SpaceLayout["sections"];
  onRename: () => void;
  onDelete: () => void;
  onPublishToggle: () => void;
  onVisibilityToggle: () => void;
  onMoveToSection: (sectionId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  const isPublic = page.visibility === "publishable";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/row grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 bg-card px-3 py-2.5 transition-colors hover:bg-accent lg:grid-cols-[1.5rem_minmax(0,1fr)_9rem_8rem_9rem_8rem_2rem]",
        isDragging && "relative z-10 opacity-60",
      )}
    >
      {canEdit ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Seret ${titleOrUntitled(page.title)}`}
          className="cursor-grab touch-none text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      ) : (
        <span />
      )}

      <Link
        href={`/spaces/${page.spaceId}/pages/${page.id}`}
        className="flex min-w-0 items-center gap-2 text-body-sm text-foreground"
        style={{ paddingLeft: `${depth * 18}px` }}
      >
        {page.emoji ? (
          <span className="shrink-0 text-[13px] leading-none">{page.emoji}</span>
        ) : (
          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{titleOrUntitled(page.title)}</span>
      </Link>

      <span className="hidden truncate text-caption text-muted-foreground lg:block">{sectionTitle}</span>

      <div className="hidden items-center gap-1.5 lg:flex">
        <StatusBadge status={getPageStatus(page)} />
      </div>

      <span className="hidden truncate text-body-sm text-muted-foreground lg:block">{authorName ?? "—"}</span>
      <span className="hidden truncate text-body-sm text-muted-foreground lg:block">{formatRelativeTime(page.updatedAt)}</span>

      <div className="flex items-center justify-end gap-1">
        <span className="lg:hidden">
          <StatusBadge status={getPageStatus(page)} />
        </span>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Menu halaman"
                  className="opacity-100 lg:opacity-0 lg:group-hover/row:opacity-100"
                />
              }
            >
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRename}>
                <Pencil className="size-3.5" />
                Ubah nama
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPublishToggle}>
                <Send className="size-3.5" />
                {!page.isPublished ? "Publikasikan" : hasUnpublishedChanges(page) ? "Perbarui publikasi" : "Batalkan publikasi"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onVisibilityToggle}>
                <ArrowUpRight className="size-3.5" />
                {isPublic ? "Jadikan internal" : "Jadikan publik"}
              </DropdownMenuItem>
              {sections.length > 1 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderInput className="size-3.5" />
                    Pindahkan ke bagian
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {sections.map((section) => (
                      <DropdownMenuItem
                        key={section.id}
                        disabled={section.title === sectionTitle}
                        onClick={() => onMoveToSection(section.id)}
                      >
                        {section.title || "Tanpa judul"}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="size-3.5" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
