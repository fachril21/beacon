import { buildPageTree, flattenPageTree } from "@/lib/build-page-tree";
import type { Page, SpaceLayout, SpaceLayoutPage, SpaceSection } from "@/lib/types";

export const MAX_SECTION_COLUMNS = 4;
export const MIN_SECTION_COLUMNS = 1;

export function createSpaceSection(title = "Bagian baru", columns = 2): SpaceSection {
  return {
    id: makeId(),
    title,
    columns: clampColumns(columns),
    pages: [],
  };
}

export function clampColumns(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_SECTION_COLUMNS, Math.max(MIN_SECTION_COLUMNS, Math.round(value)));
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Reads a `spaces.layout` JSONB value defensively. The column is user/admin
 * authored data fetched over the network, so a malformed/older document must
 * degrade to the automatic page tree instead of crashing a page.
 */
export function normalizeSpaceLayout(value: unknown): SpaceLayout | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { version?: unknown; sections?: unknown };
  if (raw.version !== undefined && raw.version !== 1) return null;
  if (!Array.isArray(raw.sections)) return null;

  const sections: SpaceSection[] = [];
  for (const entry of raw.sections) {
    if (!entry || typeof entry !== "object") continue;
    const section = entry as Record<string, unknown>;
    if (typeof section.id !== "string" || !section.id) continue;

    const pages: SpaceLayoutPage[] = [];
    if (Array.isArray(section.pages)) {
      for (const pageEntry of section.pages) {
        if (!pageEntry || typeof pageEntry !== "object") continue;
        const page = pageEntry as Record<string, unknown>;
        if (typeof page.pageId !== "string" || !page.pageId) continue;
        const colSpan = typeof page.colSpan === "number" ? Math.min(4, Math.max(1, Math.round(page.colSpan))) : undefined;
        pages.push(colSpan ? { pageId: page.pageId, colSpan } : { pageId: page.pageId });
      }
    }

    sections.push({
      id: section.id,
      title: typeof section.title === "string" ? section.title : "Tanpa judul",
      description: typeof section.description === "string" ? section.description : undefined,
      columns: clampColumns(typeof section.columns === "number" ? section.columns : 1),
      pages,
    });
  }

  return { version: 1, sections };
}

/** The automatic layout used until an admin arranges the Space, and as the public fallback. */
export function defaultSpaceLayout(pages: Page[]): SpaceLayout {
  const ordered = flattenPageTree(buildPageTree(pages)).map(({ page }) => ({ pageId: page.id }));
  return {
    version: 1,
    sections: [
      {
        id: "default",
        title: "Halaman",
        columns: 2,
        pages: ordered,
      },
    ],
  };
}

/**
 * Keeps a saved layout in sync with the Pages that actually exist right now:
 * deleted Pages disappear, and Pages created after the layout was saved are
 * appended (so a new Page can never be invisible to visitors just because the
 * admin hasn't opened the builder yet).
 */
export function mergeLayoutWithPages(layout: SpaceLayout | null | undefined, pages: Page[]): SpaceLayout {
  const merged = normalizeSpaceLayout(layout) ?? defaultSpaceLayout(pages);
  const existingIds = new Set(pages.map((page) => page.id));

  const seen = new Set<string>();
  const sections = merged.sections.map((section) => ({
    ...section,
    pages: section.pages.filter((item) => {
      if (!existingIds.has(item.pageId) || seen.has(item.pageId)) return false;
      seen.add(item.pageId);
      return true;
    }),
  }));

  const missing = flattenPageTree(buildPageTree(pages))
    .map(({ page }) => page.id)
    .filter((id) => !seen.has(id));

  if (missing.length > 0) {
    if (sections.length === 0) sections.push(createSpaceSection("Halaman", 2));
    const target = sections[sections.length - 1];
    target.pages.push(...missing.map((pageId) => ({ pageId })));
  }

  return { version: 1, sections };
}

export function sectionForPage(layout: SpaceLayout, pageId: string): SpaceSection | undefined {
  return layout.sections.find((section) => section.pages.some((item) => item.pageId === pageId));
}

export function layoutPageIds(layout: SpaceLayout): string[] {
  return layout.sections.flatMap((section) => section.pages.map((item) => item.pageId));
}

/**
 * Pages in the exact order an admin arranged for navigation. Used by the
 * public sidebar so reordering a card in the Space Builder also reorders the
 * navigation, not just the landing grid.
 */
export function orderedLayoutPages(layout: SpaceLayout | null | undefined, pages: Page[]): Page[] {
  const merged = mergeLayoutWithPages(layout, pages);
  const byId = new Map(pages.map((page) => [page.id, page]));
  const result: Page[] = [];
  const seen = new Set<string>();
  for (const pageId of layoutPageIds(merged)) {
    const page = byId.get(pageId);
    if (!page || seen.has(page.id)) continue;
    seen.add(page.id);
    result.push(page);
  }
  return result;
}

/**
 * Moves one Page into a section at an index, removing it from its previous
 * section first. Returns a new layout (no mutation) so React state updates and
 * the dirty-check stay predictable.
 */
export function movePageInLayout(
  layout: SpaceLayout,
  pageId: string,
  targetSectionId: string,
  targetIndex: number,
): SpaceLayout {
  const withoutPage = removePageFromLayout(layout, pageId);
  let moved = false;
  const sections = withoutPage.sections.map((section) => {
    if (section.id !== targetSectionId) return section;
    const pages = [...section.pages];
    const index = Math.min(Math.max(0, targetIndex), pages.length);
    pages.splice(index, 0, { pageId });
    moved = true;
    return { ...section, pages };
  });

  // Target section vanished (deleted concurrently): append instead of losing the Page.
  if (!moved) {
    if (sections.length === 0) sections.push(createSpaceSection("Halaman", 2));
    sections[sections.length - 1].pages.push({ pageId });
  }

  return { ...withoutPage, sections };
}

export function removePageFromLayout(layout: SpaceLayout, pageId: string): SpaceLayout {
  return {
    ...layout,
    sections: layout.sections.map((section) => ({
      ...section,
      pages: section.pages.filter((item) => item.pageId !== pageId),
    })),
  };
}
