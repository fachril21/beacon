"use client";

import { BeaconLogo } from "@/components/brand/beacon-logo";
import Link from "next/link";
import { useState } from "react";
import { Search, Menu } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePublicOrgContext } from "@/hooks/use-public-org";
import { usePublicSpace } from "@/hooks/public-space-context";
import { PublicSearchCommand } from "./public-search-command";
import { PublicToc } from "./public-toc";
import type { Organization } from "@/lib/types";

export function PublicNav({ organization }: { organization: Organization }) {
  const { organizations, setOrgId, basePath } = usePublicOrgContext();
  const currentSpace = usePublicSpace();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTreeOpen, setIsTreeOpen] = useState(false);

  // The dev-only localStorage org switcher (usePublicOrgContext's fallback
  // branch, when no custom-domain header or orgSlug resolved the
  // Organization) can technically be reached in a production deployment too
  // — gate on NODE_ENV as well, not just organizations.length, so a
  // production visitor can never see that other Organizations exist
  // (wireframe v2 §3.5 / PRD Flow 5).
  const showDevOrgSwitcher = process.env.NODE_ENV !== "production" && organizations.length > 1;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-sm lg:h-public-nav lg:gap-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {currentSpace && (
          <button
            type="button"
            aria-label="Buka daftar halaman"
            onClick={() => setIsTreeOpen(true)}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          >
            <Menu className="size-4.5" />
          </button>
        )}
        <Link href={basePath} className="flex min-w-0 items-center gap-2.5">
          <BeaconLogo decorative className="size-8 shrink-0" />
          <span className="truncate text-body-sm font-semibold text-foreground lg:text-h4">{organization.name} Docs</span>
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-2 lg:gap-3">
        <button
          type="button"
          aria-label="Cari dokumentasi"
          onClick={() => setIsSearchOpen(true)}
          className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-body-sm text-muted-foreground hover:bg-accent lg:w-56 lg:px-3"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="hidden lg:inline">Cari dokumentasi…</span>
        </button>
        {showDevOrgSwitcher && (
          <Select value={organization.id} onValueChange={(value) => value && setOrgId(value)}>
            <SelectTrigger className="hidden w-44 lg:flex" title="Pratinjau developer — mensimulasikan domain Organisasi">
              <SelectValue>{organization.name}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <PublicSearchCommand organizationId={organization.id} open={isSearchOpen} onOpenChange={setIsSearchOpen} />
      {currentSpace && (
        <Sheet open={isTreeOpen} onOpenChange={setIsTreeOpen}>
          <SheetContent side="left" className="w-public-tree p-0 sm:max-w-none">
            <SheetHeader className="sr-only">
              <SheetTitle>Daftar halaman</SheetTitle>
            </SheetHeader>
            <PublicToc onNavigate={() => setIsTreeOpen(false)} />
          </SheetContent>
        </Sheet>
      )}
    </header>
  );
}
