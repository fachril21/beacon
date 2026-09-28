/** Tabs of the editor right panel (wireframe v2 §3.3). Kept apart from editor-side-panel.tsx so the topbar can reference them without importing the panel's data hooks. */
export type EditorSidePanelTab = "toc" | "comments" | "history";

export const EDITOR_SIDE_PANEL_ID = "editor-side-panel";

/** The topbar's panel toggle; focus returns here when the panel closes. */
export const EDITOR_PANEL_TOGGLE_ID = "editor-panel-toggle";
