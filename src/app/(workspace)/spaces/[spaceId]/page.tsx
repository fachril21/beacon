"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/beacon/empty-state";
import { useSpace, useSpaceRole } from "@/hooks/use-spaces";
import { useChildPages, useCreatePage } from "@/hooks/use-pages";
import { useSession } from "@/hooks/use-session";

export default function SpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  const router = useRouter();
  const { user } = useSession();
  const space = useSpace(spaceId);
  const role = useSpaceRole(spaceId, user?.id);
  const rootPages = useChildPages(spaceId, null);
  const createPage = useCreatePage();
  const [isCreating, setIsCreating] = useState(false);

  async function handleNewPage() {
    if (!user) return;
    setIsCreating(true);
    const page = createPage({ spaceId, parentPageId: null, title: "Halaman tanpa judul", createdByUserId: user.id });
    router.push(`/spaces/${spaceId}/pages/${page.id}`);
  }

  if (!space) {
    return (
      <main className="flex-1 overflow-y-auto">
        <EmptyState icon={FileText} title="Space tidak ditemukan" className="mt-16" />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[60rem] px-8 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            {space.category && (
              <p className="mb-1.5 text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                {space.category}
              </p>
            )}
            <h1 className="text-h1 font-bold text-foreground">{space.name}</h1>
            <Badge variant={space.isPublishable ? "published" : "secondary"} className="mt-3">
              {space.isPublishable ? "Dapat dipublikasikan" : "Hanya internal"}
            </Badge>
          </div>
          <div className="flex shrink-0 gap-2">
            {role === "admin" && (
              <Link href={`/spaces/${spaceId}/members`}>
                <Button variant="secondary" size="sm">
                  <Settings className="size-3.5" />
                  Anggota
                </Button>
              </Link>
            )}
            <Button size="sm" onClick={handleNewPage} disabled={isCreating}>
              <Plus className="size-3.5" />
              Halaman baru
            </Button>
          </div>
        </div>

        {rootPages.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Belum ada halaman"
            description="Mulai menulis panduan pertama untuk Space ini."
            actionLabel="+ Halaman baru"
            onAction={handleNewPage}
            className="mt-16"
          />
        ) : (
          <div className="mt-8 flex flex-col gap-1">
            {rootPages.map((page) => (
              <Link
                key={page.id}
                href={`/spaces/${spaceId}/pages/${page.id}`}
                className="flex items-center gap-2.5 rounded-md px-3 py-3 text-body text-foreground hover:bg-accent"
              >
                <FileText className="size-4 text-muted-foreground" />
                {page.title || "Halaman tanpa judul"}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
