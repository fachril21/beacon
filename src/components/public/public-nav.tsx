"use client";

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePublicOrgContext } from "@/hooks/use-public-org";
import { PublicSearchCommand } from "./public-search-command";
import type { Organization } from "@/lib/types";

export function PublicNav({ organization }: { organization: Organization }) {
  const { organizations, setOrgId } = usePublicOrgContext();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/95 px-6 py-4 backdrop-blur-sm">
      <Link href="/public" className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" fill="none" className="size-4.5" aria-hidden>
            <path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4Z" fill="currentColor" />
          </svg>
        </div>
        <span className="text-h4 font-semibold text-foreground">{organization.name} Docs</span>
      </Link>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="flex w-56 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-body-sm text-muted-foreground hover:bg-accent"
        >
          <Search className="size-3.5" />
          Cari dokumentasi…
        </button>
        {organizations.length > 1 && (
          <Select value={organization.id} onValueChange={(value) => value && setOrgId(value)}>
            <SelectTrigger className="w-44" title="Pratinjau developer — mensimulasikan domain Organisasi">
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
    </header>
  );
}
