"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { SearchX } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrganization } from "@/hooks/use-organizations";
import { useInternalSearch } from "@/hooks/use-search";
import { SearchResultRow } from "@/components/beacon/search-result-row";

export function SearchCommand({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { user } = useSession();
  const currentOrganization = useCurrentOrganization();
  const [query, setQuery] = useState("");
  const results = useInternalSearch(query, user?.id, currentOrganization?.id);

  function handleOpenChange(next: boolean) {
    if (!next) setQuery("");
    onOpenChange(next);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleOpenChange(!open);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onOpenChange]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Cari"
      description="Cari Space dan Page yang dapat Anda akses"
      shouldFilter={false}
    >
      <CommandInput placeholder="Cari halaman…" value={query} onValueChange={setQuery} />
      <CommandList>
        {query.trim() && results.length === 0 && (
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-4">
              <SearchX className="size-6 text-muted-foreground" />
              <p className="text-body-sm text-muted-foreground">Tidak ada hasil untuk “{query}”</p>
            </div>
          </CommandEmpty>
        )}
        {results.length > 0 && (
          <CommandGroup heading="Halaman">
            {results.map((result) => (
              <CommandItem
                key={result.pageId}
                value={`${result.pageTitle}-${result.pageId}`}
                onSelect={() => {
                  handleOpenChange(false);
                  router.push(`/spaces/${result.spaceId}/pages/${result.pageId}`);
                }}
                className="flex-col items-start gap-0.5"
              >
                <SearchResultRow result={result} />
                {result.snippet && (
                  <p className="pl-5.5 text-caption text-muted-foreground line-clamp-1">{result.snippet}</p>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
