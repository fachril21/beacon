"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderPlus, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";
import { useOrganizationSpaces } from "@/hooks/use-spaces";
import { useCurrentOrganization } from "@/hooks/use-organizations";
import { usePages, useCreatePage, hasUnpublishedChanges } from "@/hooks/use-pages";
import { useUnreadNotificationCount } from "@/hooks/use-notifications";
import { SpaceCard } from "@/components/workspace/space-card";
import { EmptyState } from "@/components/beacon/empty-state";
import { NewSpaceDialog } from "@/components/workspace/new-space-dialog";
import { formatRelativeTime } from "@/lib/format-relative-time";

const RECENT_PAGES_LIMIT = 3;

export default function WorkspaceHomePage() {
  const router = useRouter();
  const { user } = useSession();
  const currentOrganization = useCurrentOrganization();
  const spaces = useOrganizationSpaces(user?.id, currentOrganization?.id);
  const allPages = usePages();
  const createPage = useCreatePage();
  const unreadCount = useUnreadNotificationCount(user?.id);
  const [isNewSpaceOpen, setIsNewSpaceOpen] = useState(false);

  // usePages() with no spaceId returns whatever the workspace sidebar has
  // already loaded into the shared store — scope to this org's own Spaces
  // rather than trusting it holds every Space's pages.
  const spaceIds = new Set(spaces.map((s) => s.id));
  const orgPages = allPages.filter((p) => spaceIds.has(p.spaceId));

  const recentPages = [...orgPages]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, RECENT_PAGES_LIMIT);

  const unpublishedCount = orgPages.filter(hasUnpublishedChanges).length;

  async function handleNewPage() {
    if (!user) return;
    if (spaces.length === 0) {
      setIsNewSpaceOpen(true);
      return;
    }
    const targetSpace = spaces[0];
    try {
      const page = await createPage({
        spaceId: targetSpace.id,
        parentPageId: null,
        title: "Halaman tanpa judul",
        createdByUserId: user.id,
      });
      router.push(`/spaces/${targetSpace.id}/pages/${page.id}`);
    } catch {
      // Home page has no dedicated inline error slot; the destination Space's
      // own "Halaman baru" action is the fallback if this silently no-ops.
    }
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1040px] px-12 py-9">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-h1 font-bold text-foreground">Selamat datang, {user?.name?.split(" ")[0]}</h1>
            <p className="mt-1.5 text-body text-muted-foreground">Pilih Space untuk mulai menulis, atau buat yang baru.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" onClick={() => setIsNewSpaceOpen(true)}>
              <FolderPlus className="size-3.5" />
              Space baru
            </Button>
            <Button size="sm" onClick={() => void handleNewPage()}>
              <Plus className="size-3.5" />
              Halaman baru
            </Button>
          </div>
        </div>

        {spaces.length === 0 ? (
          <EmptyState
            icon={FolderPlus}
            title="Buat Space pertama Anda"
            description="Space mengelompokkan panduan untuk satu platform, misalnya Aplikasi Mobile atau Dashboard Admin."
            actionLabel="+ Space baru"
            onAction={() => setIsNewSpaceOpen(true)}
            className="mt-16"
          />
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_18.75rem]">
            <div className="flex flex-col gap-8">
              {recentPages.length > 0 && (
                <section>
                  <h2 className="text-h4 font-semibold text-foreground">Lanjutkan menulis</h2>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {recentPages.map((page) => {
                      const pageSpace = spaces.find((s) => s.id === page.spaceId);
                      return (
                        <Link key={page.id} href={`/spaces/${page.spaceId}/pages/${page.id}`}>
                          <Card className="h-full p-4 transition-colors hover:border-input">
                            <FileText className="size-4 text-muted-foreground" />
                            <p className="mt-2 truncate text-body-sm font-medium text-foreground">
                              {page.title || "Halaman tanpa judul"}
                            </p>
                            <p className="mt-1 truncate text-caption text-muted-foreground">
                              {pageSpace?.name} · diubah {formatRelativeTime(page.updatedAt)}
                            </p>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              <section>
                <h2 className="text-h4 font-semibold text-foreground">Space</h2>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {spaces.map((space) => (
                    <SpaceCard key={space.id} space={space} />
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsNewSpaceOpen(true)}
                    className="flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-body-sm text-muted-foreground hover:border-input hover:text-foreground"
                  >
                    <Plus className="size-4" />
                    Space baru
                  </button>
                </div>
              </section>
            </div>

            <aside className="flex flex-col gap-3">
              <h2 className="text-h4 font-semibold text-foreground">Perlu perhatian</h2>
              <Card className="flex flex-col divide-y divide-border p-0">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-body-sm text-foreground">Perubahan belum dipublikasikan</span>
                  <span className="text-body-sm font-semibold text-foreground">{unpublishedCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-body-sm text-foreground">Notifikasi baru</span>
                  <span className="text-body-sm font-semibold text-foreground">{unreadCount}</span>
                </div>
              </Card>
            </aside>
          </div>
        )}
      </div>
      <NewSpaceDialog open={isNewSpaceOpen} onOpenChange={setIsNewSpaceOpen} />
    </main>
  );
}
