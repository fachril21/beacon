"use client";

import { use } from "react";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/beacon/empty-state";
import { SpaceBuilder } from "@/components/space/space-builder";
import { useSpace } from "@/hooks/use-spaces";
import { usePages } from "@/hooks/use-pages";

export default function SpaceBuilderPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  const space = useSpace(spaceId);
  const pages = usePages(spaceId);

  if (!space) {
    return <EmptyState icon={FileText} title="Space tidak ditemukan" className="mt-16" />;
  }

  return <SpaceBuilder space={space} pages={pages} />;
}
