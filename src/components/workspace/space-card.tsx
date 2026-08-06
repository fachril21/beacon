"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useChildPages, usePages } from "@/hooks/use-pages";
import type { Space } from "@/lib/types";

export function SpaceCard({ space }: { space: Space }) {
  const pageCount = usePages(space.id).length;
  const rootPages = useChildPages(space.id, null);

  return (
    <Link href={`/spaces/${space.id}`}>
      <Card className="h-full cursor-pointer p-6 transition-colors hover:border-input">
        {space.category && (
          <p className="mb-2 text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">
            {space.category}
          </p>
        )}
        <h3 className="text-h4 font-semibold text-foreground">{space.name}</h3>
        <p className="mt-1.5 text-body-sm text-muted-foreground">
          {pageCount} halaman{rootPages.length > 0 ? ` · ${rootPages.length} di tingkat atas` : ""}
        </p>
        <Badge variant={space.isPublishable ? "published" : "secondary"} className="mt-4">
          {space.isPublishable ? "Dapat dipublikasikan" : "Hanya internal"}
        </Badge>
      </Card>
    </Link>
  );
}
