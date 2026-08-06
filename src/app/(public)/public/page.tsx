"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { usePublicOrgContext } from "@/hooks/use-public-org";
import { usePublicToc } from "@/hooks/use-public-content";
import { EmptyState } from "@/components/beacon/empty-state";

export default function PublicHomePage() {
  const { organization } = usePublicOrgContext();
  const toc = usePublicToc(organization?.id);

  if (!organization) return null;

  return (
    <main className="flex-1 px-8 py-12">
      <div className="mx-auto max-w-reading-column">
        <h1 className="text-display font-bold tracking-tight text-foreground">Dokumentasi {organization.name}</h1>
        <p className="mt-3 text-body-lg text-muted-foreground">
          Panduan penggunaan produk {organization.name}, ditulis oleh tim internal.
        </p>

        {toc.length === 0 ? (
          <EmptyState icon={BookOpen} title="Belum ada panduan yang dipublikasikan" className="mt-16" />
        ) : (
          <div className="mt-10 flex flex-col gap-8">
            {toc.map(({ space, pages }) => (
              <div key={space.id}>
                <h2 className="text-h3 font-semibold text-foreground">{space.name}</h2>
                <div className="mt-3 flex flex-col gap-1">
                  {pages.map((page) => (
                    <Link
                      key={page.id}
                      href={`/public/pages/${page.id}`}
                      className="rounded-md px-3 py-2 text-body text-foreground hover:bg-accent"
                    >
                      {page.title}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
