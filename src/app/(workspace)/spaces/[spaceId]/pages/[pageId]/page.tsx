"use client";

import { use, useCallback, useRef, useState, useSyncExternalStore } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/beacon/empty-state";
import { useSpace, useSpaceRole } from "@/hooks/use-spaces";
import { usePage } from "@/hooks/use-pages";
import { useTitleAutosave } from "@/hooks/use-title-autosave";
import { useSession } from "@/hooks/use-session";
import { useEditorRevision } from "@/lib/editor-revision-store";
import { useVersionPreview } from "@/lib/version-preview-store";
import { VersionPreview } from "@/components/editor/version-preview";
import { PageEditor } from "@/components/editor/page-editor";
import { PageEditorToolbar } from "@/components/editor/page-editor-toolbar";
import { PageMetaRow } from "@/components/editor/page-meta-row";
import { EditorSidePanel } from "@/components/editor/editor-side-panel";
import { EDITOR_PANEL_TOGGLE_ID, type EditorSidePanelTab } from "@/components/editor/editor-side-panel-tab";
import type { SaveStatus } from "@/hooks/use-page-autosave";

/** Wireframe v2 §2: the right panel starts open at ≥1440px and closed below, where it would squeeze the writing column under 760px. */
const WIDE_EDITOR_QUERY = "(min-width: 1440px)";

function subscribeWideEditor(onChange: () => void) {
  const mql = window.matchMedia(WIDE_EDITOR_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function useIsWideEditor() {
  return useSyncExternalStore(
    subscribeWideEditor,
    () => window.matchMedia(WIDE_EDITOR_QUERY).matches,
    () => false,
  );
}

export default function PageEditorPage({ params }: { params: Promise<{ spaceId: string; pageId: string }> }) {
  const { spaceId, pageId } = use(params);
  const { user } = useSession();
  const space = useSpace(spaceId);
  const page = usePage(pageId);
  const parentPage = usePage(page?.parentPageId ?? undefined);
  const role = useSpaceRole(spaceId, user?.id);
  const canEdit = role === "editor" || role === "admin";
  const editorRevision = useEditorRevision(pageId);
  const previewedVersion = useVersionPreview(pageId);
  const isPreviewingVersion = previewedVersion !== null;
  const handleTitleSaveError = useCallback(() => {
    toast.error("Judul gagal disimpan, silakan coba lagi.");
  }, []);
  const { title, scheduleTitleSave, flushTitleSave } = useTitleAutosave(pageId, page?.title, handleTitleSaveError);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const scrollRootRef = useRef<HTMLElement | null>(null);

  // `undefined` = the user hasn't touched the panel yet, so it follows the
  // viewport default; after that, their explicit choice (a tab, or null for
  // closed) sticks regardless of resizes.
  const isWideEditor = useIsWideEditor();
  const [panelChoice, setPanelChoice] = useState<EditorSidePanelTab | null | undefined>(undefined);
  const [lastPanelTab, setLastPanelTab] = useState<EditorSidePanelTab>("toc");
  const rightPanel: EditorSidePanelTab | null = panelChoice === undefined ? (isWideEditor ? lastPanelTab : null) : panelChoice;

  function openPanelTab(tab: EditorSidePanelTab) {
    setPanelChoice(tab);
    setLastPanelTab(tab);
  }

  function closePanel() {
    setPanelChoice(null);
    // The X / Esc that closed it just unmounted with the panel — hand focus back to the topbar toggle.
    document.getElementById(EDITOR_PANEL_TOGGLE_ID)?.focus();
  }

  if (!page || !space) {
    return (
      <main className="flex-1 overflow-y-auto">
        <EmptyState icon={FileText} title="Halaman tidak ditemukan" className="mt-16" />
      </main>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <PageEditorToolbar
        page={page}
        space={space}
        title={title}
        saveStatus={saveStatus}
        role={role}
        parentPage={parentPage}
        panelTab={rightPanel}
        onTogglePanelTab={(tab) => (rightPanel === tab ? setPanelChoice(null) : openPanelTab(tab))}
        onTogglePanel={() => (rightPanel ? setPanelChoice(null) : openPanelTab(lastPanelTab))}
        onOpenVersionHistory={() => openPanelTab("history")}
      />
      <div className="flex min-h-0 flex-1">
        {/* md:px-14 + the column's px-6 = 80px, exactly BlockNote's side-menu gutter ("+" and drag handle), which would otherwise be clipped by this scroll container when the column is squeezed (e.g. 1280px with the panel open). */}
        <main ref={scrollRootRef} className="min-w-0 flex-1 overflow-y-auto md:px-14">
          {/* max-w-(--width-editor-column), not max-w-editor-column: Tailwind 4's max-w-* reads the --container-* namespace, so the bare token name resolves to nothing. */}
          <div className="mx-auto w-full max-w-(--width-editor-column) px-6 pt-11 pb-24">
            <input
              id="page-title"
              name="page-title"
              value={previewedVersion ? previewedVersion.title : title}
              onChange={(e) => scheduleTitleSave(e.target.value)}
              onBlur={() => void flushTitleSave()}
              readOnly={!canEdit || isPreviewingVersion}
              placeholder="Halaman tanpa judul"
              autoFocus={!page.title}
              className="w-full border-none bg-transparent text-h1 font-bold text-foreground outline-none placeholder:text-muted-foreground read-only:cursor-default"
            />
            <div className="mt-3.5">
              {!isPreviewingVersion && <PageMetaRow page={page} canEdit={canEdit} />}
            </div>
            <div className="mt-6">
              {/* The live editor stays mounted (just hidden) while an old version is shown, so an edit that has not autosaved yet is never lost. */}
              <div hidden={isPreviewingVersion}>
                <PageEditor key={`${pageId}:${editorRevision}`} page={page} onStatusChange={setSaveStatus} editable={canEdit} />
              </div>
              {previewedVersion && <VersionPreview key={previewedVersion.id} version={previewedVersion} />}
            </div>
          </div>
        </main>
        {rightPanel && (
          <EditorSidePanel
            page={page}
            tab={rightPanel}
            onTabChange={openPanelTab}
            onClose={closePanel}
            scrollRootRef={scrollRootRef}
            canRestore={canEdit}
          />
        )}
      </div>
    </div>
  );
}
