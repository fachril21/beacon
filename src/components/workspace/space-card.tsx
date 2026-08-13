"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { useChildPages, usePages } from "@/hooks/use-pages";
import { useSpaceRole, useDeleteSpace } from "@/hooks/use-spaces";
import { useSession } from "@/hooks/use-session";
import type { Space } from "@/lib/types";

export function SpaceCard({ space }: { space: Space }) {
  const { user } = useSession();
  const role = useSpaceRole(space.id, user?.id);
  const deleteSpace = useDeleteSpace();
  const pageCount = usePages(space.id).length;
  const rootPages = useChildPages(space.id, null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteSpace(space.id);
      setIsDeleteOpen(false);
      toast("Space telah dihapus.");
    } catch {
      toast.error("Gagal menghapus Space, silakan coba lagi.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="group relative">
      <Link href={`/spaces/${space.id}`}>
        <Card className="h-full cursor-pointer p-6 transition-colors hover:border-input">
          {space.category && (
            <p className="mb-2 text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">
              {space.category}
            </p>
          )}
          <h3 className="text-h4 font-semibold text-foreground pr-6">{space.name}</h3>
          <p className="mt-1.5 text-body-sm text-muted-foreground">
            {pageCount} halaman{rootPages.length > 0 ? ` · ${rootPages.length} di tingkat atas` : ""}
          </p>
          <Badge variant={space.isPublishable ? "published" : "secondary"} className="mt-4">
            {space.isPublishable ? "Dapat dipublikasikan" : "Hanya internal"}
          </Badge>
        </Card>
      </Link>

      {role === "admin" && (
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Menu Space"
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                />
              }
            >
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => setIsDeleteOpen(true)}>
                <Trash2 className="size-3.5" />
                Hapus Space
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title={`Hapus Space "${space.name}"?`}
        description="Seluruh Halaman di dalam Space ini akan ikut dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus Space"
        isDeleting={isDeleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
