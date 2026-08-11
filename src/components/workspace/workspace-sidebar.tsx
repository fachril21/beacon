"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronRight, LogOut, Plus, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import { useUserSpaces } from "@/hooks/use-spaces";
import { useChildPages, usePages, useReorderPages } from "@/hooks/use-pages";
import { PageTreeItem } from "./page-tree-item";
import { NewSpaceDialog } from "./new-space-dialog";
import { NotificationBell } from "./notification-bell";
import { sidebarNavIconClass, sidebarNavRowClass } from "./sidebar-row";

function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pt-4 pb-1.5 text-caption font-semibold tracking-[0.04em] text-sidebar-foreground/50 uppercase first:pt-0">
      {children}
    </p>
  );
}

function SpaceSection({ spaceId, name }: { spaceId: string; name: string }) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);
  const rootPages = useChildPages(spaceId, null);
  const isSpaceActive = pathname === `/spaces/${spaceId}`;

  return (
    <div className="flex flex-col">
      <div className="group/space flex items-center gap-1 py-2 pr-2 pl-2">
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="flex size-4 shrink-0 items-center justify-center text-sidebar-foreground/60"
          aria-label={isExpanded ? "Ciutkan Space" : "Perluas Space"}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
        </button>
        <Link
          href={`/spaces/${spaceId}`}
          className={cn(
            "min-w-0 flex-1 truncate text-caption font-semibold tracking-wide text-sidebar-foreground uppercase hover:text-sidebar-accent-foreground",
            isSpaceActive && "text-sidebar-primary",
          )}
        >
          {name}
        </Link>
      </div>
      {isExpanded && (
        <SortableContext items={rootPages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {rootPages.map((page) => (
            <PageTreeItem key={page.id} page={page} spaceId={spaceId} depth={1} />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

export function WorkspaceSidebar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { user, signOut } = useSession();
  const spaces = useUserSpaces(user?.id);
  const allPages = usePages();
  const reorderPages = useReorderPages();
  const [isNewSpaceOpen, setIsNewSpaceOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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
      {/* Compact workspace switcher, pinned at the top */}
      <div className="px-2 pt-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md px-1.5 py-2 hover:bg-sidebar-accent"
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
              <path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4Z" fill="currentColor" />
            </svg>
          </div>
          <span className="min-w-0 flex-1 truncate text-body-sm font-semibold text-sidebar-accent-foreground">Beacon</span>
        </Link>
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

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <SidebarSectionLabel>Space</SidebarSectionLabel>
        {spaces.length === 0 ? (
          <p className="px-2 py-3 text-caption text-sidebar-foreground/60">Belum ada Space.</p>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex flex-col gap-1">
              {spaces.map((space) => (
                <SpaceSection key={space.id} spaceId={space.id} name={space.name} />
              ))}
            </div>
          </DndContext>
        )}
      </div>

      <div className="border-t border-sidebar-border px-2 pt-1 pb-2">
        <SidebarSectionLabel>Umum</SidebarSectionLabel>
        <div className="flex flex-col gap-0.5">
          <button type="button" className={sidebarNavRowClass} onClick={() => setIsNewSpaceOpen(true)}>
            <Plus className={sidebarNavIconClass} />
            Space baru
          </button>
          <NotificationBell />
          <Link href="/settings/organization" className={sidebarNavRowClass}>
            <Settings className={sidebarNavIconClass} />
            Pengaturan Organisasi
          </Link>
          <button type="button" className={sidebarNavRowClass} onClick={signOut}>
            <LogOut className={sidebarNavIconClass} />
            Keluar
          </button>
        </div>
      </div>

      {/* Footer meta row — identity only, low-emphasis */}
      <div className="flex items-center gap-2.5 border-t border-sidebar-border px-3 py-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-caption font-semibold text-secondary-foreground">
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <p className="min-w-0 flex-1 truncate text-body-sm text-sidebar-foreground/70">{user?.name}</p>
      </div>

      <NewSpaceDialog open={isNewSpaceOpen} onOpenChange={setIsNewSpaceOpen} />
    </aside>
  );
}
