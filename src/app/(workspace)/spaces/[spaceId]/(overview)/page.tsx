"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/beacon/empty-state";
import { StatusBadge } from "@/components/beacon/status-badge";
import { DeleteConfirmDialog } from "@/components/workspace/delete-confirm-dialog";
import { useSpace, useSpaceRole } from "@/hooks/use-spaces";
import { useCreatePage, useDeletePage, usePages, getPageStatus } from "@/hooks/use-pages";
import { useUsers } from "@/hooks/use-users";
import { useSession } from "@/hooks/use-session";
import { buildPageTree, flattenPageTree } from "@/lib/build-page-tree";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { Page } from "@/lib/types";

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
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<Page | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const authorsById = useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);

  const rows = useMemo(() => flattenPageTree(buildPageTree(pages)), [pages]);

  const filteredRows = rows.filter(({ page }) => {
    if (statusFilter === "draft" && page.isPublished) return false;
    if (statusFilter === "published" && !page.isPublished) return false;
    if (filterText.trim() && !page.title.toLowerCase().includes(filterText.trim().toLowerCase())) return false;
    return true;
  });

  async function handleNewPage() {
    if (!user || !space) return;
    try {
      const page = await createPage({ spaceId: space.id, parentPageId: null, title: "Halaman tanpa judul", createdByUserId: user.id });
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

  const targetHasChildren = deleteTarget ? pages.some((p) => p.parentPageId === deleteTarget.id) : false;

  return (
    <div>
      <div className="flex items-center gap-3">
        <Input
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Cari halaman…"
          className="h-8 max-w-xs"
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
      </div>

      {filteredRows.length === 0 ? (
        <p className="mt-8 text-body-sm text-muted-foreground">Tidak ada halaman yang cocok.</p>
      ) : (
        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr className="border-b border-border text-left text-caption font-semibold text-muted-foreground uppercase">
              <th className="py-2 pr-3 font-semibold">Judul</th>
              <th className="w-32 py-2 pr-3 font-semibold">Status</th>
              <th className="w-40 py-2 pr-3 font-semibold">Penulis</th>
              <th className="w-32 py-2 pr-3 font-semibold">Diubah</th>
              <th className="w-10 py-2" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(({ page, depth }) => {
              const author = authorsById.get(page.createdByUserId);
              return (
                <tr key={page.id} className="group/row border-b border-border last:border-0 hover:bg-accent">
                  <td className="py-2.5 pr-3">
                    <Link
                      href={`/spaces/${spaceId}/pages/${page.id}`}
                      className="flex items-center gap-2 text-body-sm text-foreground"
                      style={{ paddingLeft: `${depth * 20}px` }}
                    >
                      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{page.title || "Halaman tanpa judul"}</span>
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3">
                    <StatusBadge status={getPageStatus(page)} />
                  </td>
                  <td className="py-2.5 pr-3 text-body-sm text-muted-foreground">{author?.name ?? "—"}</td>
                  <td className="py-2.5 pr-3 text-body-sm text-muted-foreground">{formatRelativeTime(page.updatedAt)}</td>
                  <td className="py-2.5 text-right">
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Menu halaman"
                              className="opacity-0 group-hover/row:opacity-100"
                            />
                          }
                        >
                          <MoreHorizontal className="size-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(page)}>
                            <Trash2 className="size-3.5" />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Hapus "${deleteTarget?.title || "Halaman tanpa judul"}"?`}
        description={
          targetHasChildren
            ? "Halaman ini beserta seluruh sub-halaman di dalamnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
            : "Halaman ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        }
        isDeleting={isDeleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
