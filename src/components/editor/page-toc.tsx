"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { collectHeadings } from "@/lib/collect-headings";
import type { PageContent } from "@/lib/types";

/** "Daftar isi" outline for the editor side panel — headings derived from the same content PageEditor renders, no separate outline data. Auto-highlights the section nearest the top of the scroll container. */
export function PageToc({ content, scrollRootRef }: { content: PageContent; scrollRootRef: RefObject<HTMLElement | null> }) {
  const headings = useMemo(() => collectHeadings(content), [content]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root || headings.length === 0) return;

    const elements = headings
      .map((h) => root.querySelector<HTMLElement>(`[data-id="${h.id}"]`))
      .filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topEntry = visible[0];
        if (topEntry) setActiveId(topEntry.target.getAttribute("data-id"));
      },
      { root, rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings, scrollRootRef]);

  if (headings.length === 0) {
    return <p className="px-2.5 py-6 text-center text-body-sm text-muted-foreground">Belum ada judul bagian di halaman ini.</p>;
  }

  function handleClick(id: string) {
    scrollRootRef.current?.querySelector<HTMLElement>(`[data-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav aria-label="Daftar isi" className="flex flex-col gap-0.5">
      {headings.map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={() => handleClick(h.id)}
          aria-current={activeId === h.id ? "location" : undefined}
          className={cn(
            "relative truncate rounded-md py-1.5 pr-2.5 text-left text-body-sm text-muted-foreground hover:bg-accent hover:text-foreground",
            h.level >= 3 ? "pl-8" : h.level === 2 ? "pl-5" : "pl-2.5",
            activeId === h.id &&
              "bg-accent font-medium text-primary-muted-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary",
          )}
        >
          {h.text}
        </button>
      ))}
    </nav>
  );
}
