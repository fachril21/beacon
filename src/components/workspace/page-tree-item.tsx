"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, FileText, GripVertical, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { useChildPages, useCreatePage, useDeletePage } from "@/hooks/use-pages";
import { useSpaceRole } from "@/hooks/use-spaces";
import { useSession } from "@/hooks/use-session";
import type { Page } from "@/lib/types";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

interface PageTreeItemProps {
  page: Page;
  spaceId: string;
  depth: number;
}

export function PageTreeItem({ page, spaceId, depth }: PageTreeItemProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();
  const role = useSpaceRole(spaceId, user?.id);
  const canEdit = role === "editor" || role === "admin";
  const createPage = useCreatePage();
  const deletePage = useDeletePage();
  const children = useChildPages(spaceId, page.id);
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });

  const isActive = pathname === `/spaces/${spaceId}/pages/${page.id}`;
  const hasChildren = children.length > 0;

  async function handleAddSubPage(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    try {
      const newPage = await createPage({ spaceId, parentPageId: page.id, title: "Halaman tanpa judul", createdByUserId: user.id });
      setIsExpanded(true);
      router.push(`/spaces/${spaceId}/pages/${newPage.id}`);
    } catch {
      toast.error("Tidak dapat membuat Halaman, silakan coba lagi.");
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deletePage(page.id);
      setIsDeleteOpen(false);
      toast("Halaman telah dihapus.");
      if (isActive) {
        router.push(`/spaces/${spaceId}`);
      }
    } catch {
      toast.error("Gagal menghapus Halaman, silakan coba lagi.");
      setIsDeleting(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-60")}
    >
      <div
        className={cn(
          "group/row relative flex items-center gap-1 rounded-sm py-3 pr-2 text-body-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "bg-sidebar-accent text-sidebar-primary before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary",
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-sidebar-foreground/40 opacity-0 group-hover/row:opacity-100 active:cursor-grabbing"
          aria-label="Seret untuk mengurutkan ulang"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className={cn("flex size-4 shrink-0 items-center justify-center text-sidebar-foreground/60", !hasChildren && "invisible")}
          aria-label={isExpanded ? "Ciutkan" : "Perluas"}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
        </button>
        <Link href={`/spaces/${spaceId}/pages/${page.id}`} className="flex min-w-0 flex-1 items-center gap-1.5">
          <FileText className="size-3.5 shrink-0 text-sidebar-foreground/60" />
          <span className="truncate">{page.title || "Halaman tanpa judul"}</span>
        </Link>
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-sidebar-foreground/60 opacity-0 hover:bg-sidebar-accent group-hover/row:opacity-100"
          onClick={handleAddSubPage}
          aria-label="Tambah sub-halaman"
        >
          <Plus className="size-3.5" />
        </Button>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-sidebar-foreground/60 opacity-0 hover:bg-sidebar-accent group-hover/row:opacity-100 aria-expanded:opacity-100"
                  aria-label="Menu halaman"
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                />
              }
            >
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem variant="destructive" onClick={() => setIsDeleteOpen(true)}>
                <Trash2 className="size-3.5" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {isExpanded && hasChildren && (
        <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {children.map((child) => (
            <PageTreeItem key={child.id} page={child} spaceId={spaceId} depth={depth + 1} />
          ))}
        </SortableContext>
      )}

      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title={`Hapus "${page.title || "Halaman tanpa judul"}"?`}
        description={
          hasChildren
            ? "Halaman ini beserta seluruh sub-halaman di dalamnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
            : "Halaman ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        }
        isDeleting={isDeleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
