"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { SearchX } from "lucide-react";
import { usePublicSearch } from "@/hooks/use-search";
import { SearchResultRow } from "@/components/beacon/search-result-row";

export function PublicSearchCommand({
  organizationId,
  open,
  onOpenChange,
}: {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const results = usePublicSearch(query, organizationId);

  function handleOpenChange(next: boolean) {
    if (!next) setQuery("");
    onOpenChange(next);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Cari dokumentasi"
      description="Cari halaman yang dipublikasikan"
      shouldFilter={false}
    >
      <CommandInput placeholder="Cari…" value={query} onValueChange={setQuery} />
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
                  onOpenChange(false);
                  router.push(`/public/pages/${result.pageId}`);
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
