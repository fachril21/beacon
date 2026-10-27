"use client";

import { use, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/beacon/empty-state";
import { NotFoundState } from "@/components/beacon/not-found-state";
import { useSession } from "@/hooks/use-session";
import { useSpace, useSpaceRole } from "@/hooks/use-spaces";
import { useOrganization } from "@/hooks/use-organizations";
import { useCreatePage } from "@/hooks/use-pages";

const TABS: { label: string; segment: string | null; adminOnly: boolean }[] = [
  { label: "Halaman", segment: null, adminOnly: false },
  { label: "Layout", segment: "builder", adminOnly: true },
  { label: "Pengaturan", segment: "settings", adminOnly: true },
];

/**
 * Lives in the (overview) route group so it wraps only the Space's own
 * Halaman/Anggota/Pengaturan tabs — the sibling pages/[pageId] editor route
 * sits outside this group and keeps its own full-bleed topbar untouched
 * (see node_modules/next/dist/docs's "opting specific segments into a
 * layout" pattern).
 */
export default function SpaceOverviewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = use(params);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();
  const space = useSpace(spaceId);
  const role = useSpaceRole(spaceId, user?.id);
  const organization = useOrganization(space?.organizationId);
  const createPage = useCreatePage();
  const [isCreating, setIsCreating] = useState(false);

  const isAdmin = role === "admin";
  const activeSegment = TABS.find((tab) => tab.segment && pathname === `/spaces/${spaceId}/${tab.segment}`)?.segment ?? null;

  if (!space) {
    return (
      <main className="flex-1 overflow-y-auto">
        <EmptyState icon={FileText} title="Space tidak ditemukan" className="mt-16" />
      </main>
    );
  }

  if (activeSegment !== null && !isAdmin) {
    return <NotFoundState />;
  }

  async function handleNewPage() {
    if (!user) return;
    setIsCreating(true);
    try {
      const page = await createPage({ spaceId, parentPageId: null, title: "", createdByUserId: user.id });
      router.push(`/spaces/${spaceId}/pages/${page.id}`);
    } catch {
      toast.error("Tidak dapat membuat Halaman, silakan coba lagi.");
      setIsCreating(false);
    }
  }

  async function handleCopyPublicUrl() {
    if (!organization || !space) return;
    const publicUrl = `${window.location.origin}/public/${organization.slug}/spaces/${space.slug}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link publik disalin ke clipboard.");
    } catch {
      toast.error("Gagal menyalin link, silakan coba lagi.");
    }
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1040px] px-4 pt-6 sm:px-8 sm:pt-9 lg:px-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {space.category && (
              <p className="mb-1.5 text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">{space.category}</p>
            )}
            <div className="flex items-center gap-2.5">
              {space.icon && (
                <span className="shrink-0 text-2xl leading-none sm:text-3xl" aria-hidden>
                  {space.icon}
                </span>
              )}
              <h1 className="text-h1 font-bold text-foreground">{space.name}</h1>
            </div>
            {space.description && <p className="mt-2 max-w-2xl text-body text-muted-foreground">{space.description}</p>}
            <Badge variant={space.isPublishable ? "published" : "secondary"} className="mt-3">
              {space.isPublishable ? "Dapat dipublikasikan" : "Hanya internal"}
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {space.isPublishable && organization && (
              <Button variant="secondary" size="icon-sm" aria-label="Salin link publik" onClick={() => void handleCopyPublicUrl()}>
                <Copy className="size-3.5" />
              </Button>
            )}
            <Button size="sm" onClick={() => void handleNewPage()} disabled={isCreating}>
              <Plus className="size-3.5" />
              Halaman baru
            </Button>
          </div>
        </div>

        <nav aria-label="Tab Space" className="mt-6 flex gap-4 overflow-x-auto border-b border-border">
          {TABS.filter((tab) => !tab.adminOnly || isAdmin).map((tab) => {
            const href = tab.segment ? `/spaces/${spaceId}/${tab.segment}` : `/spaces/${spaceId}`;
            const isActive = activeSegment === tab.segment;
            return (
              <Link
                key={tab.label}
                href={href}
                className={cn(
                  "shrink-0 border-b-2 pb-3 text-body-sm font-medium text-muted-foreground hover:text-foreground",
                  isActive ? "border-primary text-foreground" : "border-transparent",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mx-auto max-w-[1040px] px-4 py-6 sm:px-8 lg:px-12">{children}</div>
    </main>
  );
}
