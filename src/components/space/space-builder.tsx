"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Eye, EyeOff, FileText, GripVertical, LayoutPanelTop, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageEmojiPicker } from "@/components/editor/page-emoji-picker";
import { StatusBadge } from "@/components/beacon/status-badge";
import { SpaceLayoutView } from "@/components/space/space-layout-view";
import { useUpdateSpace } from "@/hooks/use-spaces";
import { getPageStatus } from "@/hooks/use-pages";
import { titleOrUntitled } from "@/lib/page-label";
import { createSpaceSection, mergeLayoutWithPages, movePageInLayout, sectionForPage } from "@/lib/space-layout";
import type { Page, Space, SpaceLayout, SpaceSection } from "@/lib/types";

const COLUMN_CHOICES = [1, 2, 3, 4] as const;
const SPAN_CLASS: Record<number, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
};

interface SpaceBuilderProps {
  space: Space;
  pages: Page[];
}

/**
 * Space Builder — the admin-authored landing layout for one Space. This is the
 * only editor for sections/columns/page order; every other surface (public
 * landing page, search, sidebar) keeps reading the same Page rows, so nothing
 * is duplicated when a card is moved here.
 */
export function SpaceBuilder({ space, pages }: SpaceBuilderProps) {
  const router = useRouter();
  const updateSpace = useUpdateSpace();
  const initialLayout = useMemo(() => mergeLayoutWithPages(space.layout, pages), [space.layout, pages]);
  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description ?? "");
  const [icon, setIcon] = useState<string | null>(space.icon ?? null);
  const [sections, setSections] = useState<SpaceSection[]>(initialLayout.sections);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [savedSignature, setSavedSignature] = useState(() =>
    signatureOf(space.name, space.description ?? "", space.icon ?? null, initialLayout.sections),
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const pagesById = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);
  const draftSignature = signatureOf(name, description, icon, sections);
  const isDirty = draftSignature !== savedSignature;
  const trimmedName = name.trim();

  const previewSpace: Space = {
    ...space,
    name: trimmedName || space.name,
    description: description.trim(),
    icon,
    layout: { version: 1, sections },
  };

  function updateSection(sectionId: string, patch: Partial<SpaceSection>) {
    setSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        const next = { ...section, ...patch };
        // Narrowing a section also narrows the cards in it, so no card keeps a
        // span wider than the grid it now lives in.
        if (patch.columns !== undefined) {
          next.pages = next.pages.map((item) =>
            item.colSpan && item.colSpan > next.columns ? { ...item, colSpan: next.columns } : item,
          );
        }
        return next;
      }),
    );
  }

  function addSection() {
    setSections((prev) => [...prev, createSpaceSection("Bagian baru", 2)]);
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    setSections((prev) => {
      const index = prev.findIndex((section) => section.id === sectionId);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  }

  function removeSection(sectionId: string) {
    setSections((prev) => {
      if (prev.length <= 1) return prev;
      const index = prev.findIndex((section) => section.id === sectionId);
      if (index === -1) return prev;
      const removed = prev[index];
      const remaining = prev.filter((section) => section.id !== sectionId).map((section) => ({ ...section, pages: [...section.pages] }));
      const destination = remaining[Math.max(0, index - 1)] ?? remaining[0];
      destination.pages.push(...removed.pages);
      return remaining;
    });
  }

  function addPageToSection(sectionId: string, pageId: string) {
    if (!pageId) return;
    setSections((prev) => {
      const currentSection = sectionForPage({ version: 1, sections: prev }, pageId);
      if (currentSection?.id === sectionId) return prev;
      return movePageInLayout({ version: 1, sections: prev }, pageId, sectionId, Number.MAX_SAFE_INTEGER).sections;
    });
  }

  function setPageSpan(sectionId: string, pageId: string, colSpan: number) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              pages: section.pages.map((item) => (item.pageId === pageId ? { ...item, colSpan: colSpan > 1 ? colSpan : undefined } : item)),
            }
          : section,
      ),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const layout: SpaceLayout = { version: 1, sections };
    const targetSectionId =
      typeof over.data.current?.sectionId === "string"
        ? over.data.current.sectionId
        : sectionForPage(layout, String(over.id))?.id;
    if (!targetSectionId) return;

    const target = sections.find((section) => section.id === targetSectionId);
    if (!target) return;

    const overPageIndex = target.pages.findIndex((item) => item.pageId === String(over.id));
    const source = sectionForPage(layout, activeId);
    const sourceIndex = source?.pages.findIndex((item) => item.pageId === activeId) ?? -1;
    let targetIndex = overPageIndex === -1 ? target.pages.length : overPageIndex;
    // Removing the dragged card first shifts later indices in the same section.
    if (source?.id === targetSectionId && sourceIndex !== -1 && sourceIndex < targetIndex) targetIndex -= 1;
    if (source?.id === targetSectionId && sourceIndex === targetIndex) return;

    setSections(movePageInLayout(layout, activeId, targetSectionId, targetIndex).sections);
  }

  async function handleSave() {
    if (!trimmedName) {
      toast.error("Nama Space tidak boleh kosong.");
      return;
    }
    setIsSaving(true);
    try {
      await updateSpace(space.id, {
        name: trimmedName,
        description: description.trim(),
        icon,
        layout: { version: 1, sections },
      });
      setSavedSignature(draftSignature);
      toast.success("Layout Space disimpan.");
    } catch {
      toast.error("Gagal menyimpan layout, silakan coba lagi.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-body-sm text-muted-foreground">
          <LayoutPanelTop className="size-4 shrink-0" />
          <span>
            {isDirty ? "Ada perubahan yang belum disimpan." : "Semua perubahan sudah tersimpan."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setIsPreviewVisible((value) => !value)} className="xl:hidden">
            {isPreviewVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {isPreviewVisible ? "Sembunyikan pratinjau" : "Pratinjau"}
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={isSaving || !isDirty || !trimmedName}>
            <Save className="size-3.5" />
            {isSaving ? "Menyimpan…" : "Simpan perubahan"}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <PageEmojiPicker emoji={icon} onChange={setIcon} subject="Space" />
              <div className="min-w-0 flex-1">
                <Label htmlFor="space-builder-name">Judul Space</Label>
                <Input
                  id="space-builder-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nama Space"
                  className="mt-1.5"
                />
                <Label htmlFor="space-builder-description" className="mt-4">
                  Deskripsi / subtitle
                </Label>
                <Textarea
                  id="space-builder-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Jelaskan isi Space ini untuk pengunjung…"
                  className="mt-1.5 min-h-[4.5rem]"
                />
              </div>
            </div>
          </Card>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="flex flex-col gap-4">
              {sections.map((section, sectionIndex) => (
                <SectionEditor
                  key={section.id}
                  section={section}
                  index={sectionIndex}
                  total={sections.length}
                  pages={pages}
                  pagesById={pagesById}
                  onUpdate={(patch) => updateSection(section.id, patch)}
                  onMove={(direction) => moveSection(section.id, direction)}
                  onRemove={() => removeSection(section.id)}
                  onAddPage={(pageId) => addPageToSection(section.id, pageId)}
                  onPageSpan={(pageId, span) => setPageSpan(section.id, pageId, span)}
                />
              ))}
            </div>
          </DndContext>

          <Button variant="outline" size="sm" onClick={addSection} className="self-start">
            <Plus className="size-3.5" />
            Tambah bagian
          </Button>

          {pages.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-body-sm text-muted-foreground">
              Belum ada Halaman di Space ini. Buat Halaman terlebih dahulu dari tab Halaman.
            </p>
          )}
        </div>

        <aside className={cn("min-w-0", !isPreviewVisible && "hidden xl:block")}>
          <div className="sticky top-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-h4 font-semibold text-foreground">Pratinjau</h2>
              <span className="text-caption text-muted-foreground">Badge status hanya di pratinjau</span>
            </div>
            <div className="max-h-[calc(100vh-9rem)] overflow-y-auto rounded-xl border border-border bg-background p-5">
              <SpaceLayoutView
                space={previewSpace}
                pages={pages}
                mode="preview"
                onOpenPage={(page) => router.push(`/spaces/${space.id}/pages/${page.id}`)}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function signatureOf(name: string, description: string, icon: string | null, sections: SpaceSection[]): string {
  return JSON.stringify({ name, description, icon, sections });
}

function SectionEditor({
  section,
  index,
  total,
  pages,
  pagesById,
  onUpdate,
  onMove,
  onRemove,
  onAddPage,
  onPageSpan,
}: {
  section: SpaceSection;
  index: number;
  total: number;
  pages: Page[];
  pagesById: Map<string, Page>;
  onUpdate: (patch: Partial<SpaceSection>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onAddPage: (pageId: string) => void;
  onPageSpan: (pageId: string, colSpan: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `section-drop-${section.id}`,
    data: { sectionId: section.id },
  });

  const availablePages = pages.filter((page) => !section.pages.some((item) => item.pageId === page.id));

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-col gap-0.5 pt-1">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Naikkan bagian ${section.title}`}
            onClick={() => onMove(-1)}
            disabled={index === 0}
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Turunkan bagian ${section.title}`}
            onClick={() => onMove(1)}
            disabled={index === total - 1}
          >
            <ArrowDown className="size-3.5" />
          </Button>
        </div>

        <div className="min-w-[9rem] flex-1">
          <Input
            aria-label={`Judul bagian ${index + 1}`}
            value={section.title}
            onChange={(event) => onUpdate({ title: event.target.value })}
            placeholder="Judul bagian"
            className="h-8 border-transparent bg-transparent px-1 text-h4 font-semibold shadow-none focus-visible:border-input focus-visible:bg-card"
          />
          <Input
            aria-label={`Deskripsi bagian ${index + 1}`}
            value={section.description ?? ""}
            onChange={(event) => onUpdate({ description: event.target.value || undefined })}
            placeholder="Deskripsi bagian (opsional)"
            className="mt-1 h-7 border-transparent bg-transparent px-1 text-body-sm shadow-none focus-visible:border-input focus-visible:bg-card"
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <div className="flex items-center rounded-md bg-muted p-0.5" role="group" aria-label={`Jumlah kolom ${section.title}`}>
            {COLUMN_CHOICES.map((columns) => (
              <button
                key={columns}
                type="button"
                onClick={() => onUpdate({ columns })}
                aria-label={`${columns} kolom`}
                aria-pressed={section.columns === columns}
                className={cn(
                  "rounded-sm px-2 py-1 text-caption font-semibold text-muted-foreground",
                  section.columns === columns && "bg-background text-foreground shadow-sm",
                )}
              >
                {columns}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Hapus bagian ${section.title}`}
            onClick={onRemove}
            disabled={total <= 1}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "mt-3 grid min-h-16 grid-cols-1 gap-2 rounded-lg transition-colors sm:grid-cols-2",
          section.columns === 1 && "sm:grid-cols-1",
          section.columns === 3 && "sm:grid-cols-3",
          section.columns === 4 && "sm:grid-cols-4",
          isOver && "bg-accent/60 ring-2 ring-primary/30",
        )}
      >
        <SortableContext items={section.pages.map((item) => item.pageId)} strategy={rectSortingStrategy}>
          {section.pages.map((item) => {
            const page = pagesById.get(item.pageId);
            if (!page) return null;
            return (
              <SortablePageCard
                key={page.id}
                page={page}
                sectionId={section.id}
                sectionColumns={section.columns}
                colSpan={item.colSpan ?? 1}
                onSpanChange={(span) => onPageSpan(page.id, span)}
              />
            );
          })}
        </SortableContext>
        {section.pages.length === 0 && (
          <p className="col-span-full rounded-lg border border-dashed border-border px-3 py-5 text-center text-body-sm text-muted-foreground">
            Seret Halaman ke sini atau tambahkan dari daftar di bawah.
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <select
          aria-label={`Tambah Halaman ke ${section.title}`}
          value=""
          onChange={(event) => {
            onAddPage(event.target.value);
            event.target.value = "";
          }}
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-body-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Tambah Halaman ke bagian ini…</option>
          {availablePages.map((page) => (
            <option key={page.id} value={page.id}>
              {titleOrUntitled(page.title)}
            </option>
          ))}
        </select>
        <span className="shrink-0 text-caption text-muted-foreground">{section.pages.length} halaman</span>
      </div>
    </Card>
  );
}

function SortablePageCard({
  page,
  sectionId,
  sectionColumns,
  colSpan,
  onSpanChange,
}: {
  page: Page;
  sectionId: string;
  sectionColumns: number;
  colSpan: number;
  onSpanChange: (span: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
    data: { sectionId },
  });
  const effectiveSpan = Math.min(sectionColumns, Math.max(1, colSpan));

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-background p-3",
        sectionColumns > 1 && SPAN_CLASS[effectiveSpan],
        isDragging && "z-10 opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Seret ${titleOrUntitled(page.title)}`}
          className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        {page.emoji ? (
          <span className="shrink-0 text-base leading-none" aria-hidden>
            {page.emoji}
          </span>
        ) : (
          <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-semibold text-foreground">{titleOrUntitled(page.title)}</p>
          <StatusBadge status={getPageStatus(page)} className="mt-1" />
        </div>
      </div>
      {sectionColumns > 1 && (
        <label className="mt-1 flex items-center justify-end gap-1.5 text-caption text-muted-foreground">
          Lebar
          <select
            aria-label={`Lebar kartu ${titleOrUntitled(page.title)}`}
            value={colSpan}
            onChange={(event) => onSpanChange(Number(event.target.value))}
            className="h-6 rounded-sm border border-border bg-card px-1 text-caption text-foreground"
          >
            {COLUMN_CHOICES.slice(0, sectionColumns).map((span) => (
              <option key={span} value={span}>
                {span} kolom
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
