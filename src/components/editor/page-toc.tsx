"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { extractBlockOwnText } from "@/lib/extract-text";
import type { PageContent } from "@/lib/types";

interface TocHeading {
  id: string;
  text: string;
  level: number;
}

function collectHeadings(blocks: PageContent, out: TocHeading[] = []): TocHeading[] {
  for (const block of blocks) {
    if (block.type === "heading" && block.id) {
      const text = extractBlockOwnText(block.content);
      const level = Number((block.props as { level?: number } | undefined)?.level) || 1;
      if (text) out.push({ id: block.id, text, level });
    }
    if (block.children) collectHeadings(block.children as PageContent, out);
  }
  return out;
}

/** Sticky "On this page" rail — headings derived from the same content PageEditor renders, no separate outline data. Auto-highlights the section nearest the top of the scroll container. */
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

  if (headings.length === 0) return null;

  function handleClick(id: string) {
    scrollRootRef.current?.querySelector<HTMLElement>(`[data-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav
      aria-label="Pada halaman ini"
      className="hidden w-toc-rail shrink-0 flex-col gap-0.5 self-start xl:sticky xl:top-10 xl:flex xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:py-10 xl:pr-2 xl:pl-6"
    >
      <p className="mb-1.5 text-caption font-semibold tracking-[0.04em] text-muted-foreground uppercase">Pada halaman ini</p>
      {headings.map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={() => handleClick(h.id)}
          className={cn(
            "truncate rounded-sm py-1 text-left text-body-sm text-muted-foreground hover:text-foreground",
            h.level >= 3 ? "pl-5" : h.level === 2 ? "pl-2.5" : "pl-0",
            activeId === h.id && "font-medium text-primary-muted-foreground",
          )}
        >
          {h.text}
        </button>
      ))}
    </nav>
  );
}
