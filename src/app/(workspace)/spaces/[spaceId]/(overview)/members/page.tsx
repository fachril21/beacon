"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SpaceMembersPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/spaces/${spaceId}`);
  }, [router, spaceId]);

  return null;
}
