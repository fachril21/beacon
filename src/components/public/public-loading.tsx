"use client";

import { Skeleton } from "@/components/ui/skeleton";

function LoadingStatus({ label }: { label: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}

/** Page-shaped placeholder shown while a published Page lookup is in flight. */
export function PublicPageSkeleton() {
  return (
    <main className="flex-1 px-6 py-10 lg:px-8 lg:py-12" aria-busy="true">
      <div className="flex gap-10">
        <div className="min-w-0 max-w-(--width-reading-column) flex-1">
          <div className="mb-4 flex items-center gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="size-3 rounded-sm" />
            <Skeleton className="h-3.5 w-20" />
          </div>
          <Skeleton className="h-10 w-4/5 sm:w-3/5" />
          <Skeleton className="mt-3 h-4 w-40" />

          <div className="mt-10 flex flex-col gap-3">
            {["w-full", "w-11/12", "w-[96%]", "w-3/5", "w-full", "w-10/12", "w-4/5"].map((width) => (
              <Skeleton key={width} className={`h-4 ${width}`} />
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>

        <aside className="hidden w-toc-rail shrink-0 xl:block">
          <div className="flex flex-col gap-2">
            <Skeleton className="mb-1 h-3 w-28" />
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-36" />
          </div>
        </aside>
      </div>
      <LoadingStatus label="Memuat halaman…" />
    </main>
  );
}

/** Space-landing placeholder — never the "page no longer available" copy. */
export function PublicSpaceSkeleton() {
  return (
    <main className="flex-1 px-6 py-12 lg:px-8" aria-busy="true">
      <div className="mx-auto max-w-(--width-reading-column)">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="mt-2 h-12 w-3/5" />

        <div className="mt-10 flex flex-col gap-2">
          {["w-56", "w-64", "w-48", "w-72", "w-52"].map((width) => (
            <Skeleton key={width} className={`h-5 ${width}`} />
          ))}
        </div>
      </div>
      <LoadingStatus label="Memuat Space…" />
    </main>
  );
}

/** Sidebar placeholder while the current Space's page tree resolves. */
export function PublicTocSkeleton() {
  return (
    <nav aria-label="Daftar halaman Space" aria-busy="true" className="flex flex-col gap-4 px-4 py-6">
      <Skeleton className="ml-2 h-3.5 w-32" />
      <div className="flex flex-col gap-2">
        <Skeleton className="ml-2 h-4 w-28" />
        <Skeleton className="ml-2 h-4 w-40" />
        <Skeleton className="ml-2 h-4 w-32" />
        <Skeleton className="ml-2 h-4 w-36" />
      </div>
      <LoadingStatus label="Memuat daftar halaman…" />
    </nav>
  );
}
