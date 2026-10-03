"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronRight, Home, Lock, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import { useOrganizationSpaces } from "@/hooks/use-spaces";
import { useCurrentOrganization } from "@/hooks/use-organizations";
import { useChildPages, usePages, useReorderPages } from "@/hooks/use-pages";
import { PageTreeItem } from "./page-tree-item";
import { NewSpaceDialog } from "./new-space-dialog";
import { AccountMenu } from "./account-menu";
import { NotificationBell } from "./notification-bell";
import { OrganizationSwitcher } from "./organization-switcher";
import { sidebarNavIconClass, sidebarNavRowClass } from "./sidebar-row";
import type { Space } from "@/lib/types";

function SpaceSection({ space, defaultExpanded }: { space: Space; defaultExpanded: boolean }) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const rootPages = useChildPages(space.id, null);
  const isSpaceActive = pathname === `/spaces/${space.id}`;

  return (
    <div className="flex flex-col">
      <div className="group/space flex h-8 items-center gap-1 pr-2 pl-2">
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="flex size-4 shrink-0 items-center justify-center text-sidebar-foreground/60"
          aria-label={isExpanded ? "Ciutkan Space" : "Perluas Space"}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
        </button>
        {!space.isPublishable && (
          <Lock className="size-3 shrink-0 text-sidebar-foreground/40" aria-label="Hanya internal" />
        )}
        <Link
          href={`/spaces/${space.id}`}
          className={cn(
            "min-w-0 flex-1 truncate text-body-sm font-semibold text-sidebar-foreground hover:text-sidebar-accent-foreground",
            isSpaceActive && "text-sidebar-primary",
          )}
        >
          {space.name}
        </Link>
      </div>
      {isExpanded && (
        <SortableContext items={rootPages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {rootPages.map((page) => (
            <PageTreeItem key={page.id} page={page} spaceId={space.id} depth={1} />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

export function WorkspaceSidebar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const pathname = usePathname();
  const { user } = useSession();
  const currentOrganization = useCurrentOrganization();
  const spaces = useOrganizationSpaces(user?.id, currentOrganization?.id);
  const allPages = usePages();
  const reorderPages = useReorderPages();
  const [isNewSpaceOpen, setIsNewSpaceOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const activeSpaceId =
    spaces.find((s) => pathname === `/spaces/${s.id}` || pathname.startsWith(`/spaces/${s.id}/`))?.id ??
    spaces[0]?.id;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activePage = allPages.find((p) => p.id === active.id);
    const overPage = allPages.find((p) => p.id === over.id);
    if (!activePage || !overPage) return;
    if (activePage.spaceId !== overPage.spaceId || activePage.parentPageId !== overPage.parentPageId) return;

    const siblings = allPages
      .filter((p) => p.spaceId === activePage.spaceId && p.parentPageId === activePage.parentPageId)
      .sort((a, b) => a.order - b.order)
      .map((p) => p.id);
    const from = siblings.indexOf(active.id as string);
    const to = siblings.indexOf(over.id as string);
    const reordered = [...siblings];
    reordered.splice(from, 1);
    reordered.splice(to, 0, active.id as string);
    reorderPages(activePage.spaceId, activePage.parentPageId, reordered);
  }

  return (
    <aside className="flex h-full w-sidebar shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Organization switcher, pinned at the top */}
      <div className="px-2 pt-3">
        <OrganizationSwitcher />
      </div>

      <div className="px-2 pt-2 pb-1">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-body-sm text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Cari…</span>
          <kbd className="rounded-sm border border-sidebar-border px-1.5 py-0.5 text-[10px] text-sidebar-foreground/60">⌘K</kbd>
        </button>
      </div>

      {/* Primary nav — Beranda and Notifikasi live above the Space tree */}
      <div className="flex flex-col gap-0.5 px-2 pb-2">
        <Link href="/" className={sidebarNavRowClass}>
          <Home className={sidebarNavIconClass} />
          Beranda
        </Link>
        <NotificationBell />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="flex items-center justify-between px-2 pt-2 pb-1.5">
          <span className="text-caption font-semibold tracking-[0.04em] text-sidebar-foreground/50 uppercase">Space</span>
          <button
            type="button"
            aria-label="Space baru"
            onClick={() => setIsNewSpaceOpen(true)}
            className="flex size-5 items-center justify-center rounded-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        {spaces.length === 0 ? (
          <p className="px-2 py-3 text-caption text-sidebar-foreground/60">Belum ada Space.</p>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex flex-col gap-1">
              {spaces.map((space) => (
                <SpaceSection key={space.id} space={space} defaultExpanded={space.id === activeSpaceId} />
              ))}
            </div>
          </DndContext>
        )}
      </div>

      <AccountMenu />

      <NewSpaceDialog open={isNewSpaceOpen} onOpenChange={setIsNewSpaceOpen} />
    </aside>
  );
}
