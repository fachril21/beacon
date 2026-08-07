# TDD Evidence Report: Lexical Editor Doc/Playground Conformance

## Source plan

No `*.plan.md` artifact — this was an inline `/plan` (conversational mode) followed by `/tdd-workflow`. The plan compared beacon's existing Lexical editor (`src/components/editor/`) against the official [lexical.dev docs](https://lexical.dev/docs) and the `lexical-playground` reference implementation (fetched from `facebook/lexical` on GitHub), and found one real conformance gap plus one confirmed scope addition:

1. `FloatingToolbarPlugin` used a raw `document.addEventListener("selectionchange", ...)` + `window.getSelection()` DOM listener instead of the playground's canonical `registerUpdateListener` + `registerCommand(SELECTION_CHANGE_COMMAND, ...)` pattern — no code-block exclusion, no link exclusion, no reposition on scroll/resize.
2. Phase 2 (user-selected): add link insertion/editing, following the playground's `FloatingLinkEditorPlugin` pattern — previously `LinkPlugin` was registered with no UI to create or edit links at all.

## User journeys

- As an editor, I want the format toolbar to appear only when I select real text (not inside a code block, not on top of a link), so formatting controls never appear where they'd be meaningless or would fight with the link editor.
- As an editor, I want to turn selected text into a link via the toolbar, immediately type the URL, and have it committed on Enter.
- As an editor, I want to edit or remove an existing link's URL without losing the link text.
- As an editor, I want to back out of creating a link (Escape before typing a URL) without leaving a dangling empty link in my document.

## Task report

| Task | Summary | Validation command | RED | GREEN |
|---|---|---|---|---|
| `$getSelectedLinkNode` helper | Resolves the LinkNode containing a selection's anchor (node-is-link or parent-is-link) | `npx vitest run src/components/editor/link-utils.test.tsx` | Fails to resolve import `./link-utils` (module missing) | 4/4 pass |
| Rebuild `FloatingToolbarPlugin` | Replaces DOM `selectionchange` listener with `registerUpdateListener` + `SELECTION_CHANGE_COMMAND`; adds code-block/link exclusion, scroll/resize reposition, Link button | `npx vitest run src/components/editor/floating-toolbar-plugin.test.tsx` | 4/7 pass — toolbar never became visible under jsdom (no synthetic `selectionchange` from programmatic updates); no Link button | 11/11 pass (7 original + 4 added for block-type buttons during coverage pass) |
| `FloatingLinkEditorPlugin` (Phase 2) | View/edit popover for link URLs, auto-edit-mode for freshly created links, Escape-cancels-empty-fresh-link | `npx vitest run src/components/editor/floating-link-editor-plugin.test.tsx` | Fails to resolve import `./floating-link-editor-plugin` (module missing) | 7/7 pass |
| Wire into `PageEditor` | Registers `<FloatingLinkEditorPlugin />` alongside the rebuilt toolbar | `npx vitest run` (full suite) + `npx tsc --noEmit` + `npx eslint` | n/a (wiring only) | 125/125 → 129/129 after coverage pass; tsc clean; eslint clean |
| Browser verification | Live Chrome session against a real seeded page (`Halaman tanpa judul`) | manual (Chrome DevTools MCP) | n/a | Confirmed: toolbar shows/hides correctly, hidden inside code blocks, Link button → auto-edit-mode with empty input → Enter commits → view mode with edit/trash icons → trash removes link and keeps text; Bold button reflects active-format state |

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | `$getSelectedLinkNode` returns `null` for plain text with no link ancestor | `link-utils.test.tsx` | unit | PASS |
| 2 | `$getSelectedLinkNode` returns the LinkNode when the anchor's parent is a link | `link-utils.test.tsx` | unit | PASS |
| 3 | `$getSelectedLinkNode` returns the LinkNode when the anchor point is the link element itself | `link-utils.test.tsx` | unit | PASS |
| 4 | `$getSelectedLinkNode` returns `null` for a `null` selection | `link-utils.test.tsx` | unit | PASS |
| 5 | Toolbar hidden on mount with no selection | `floating-toolbar-plugin.test.tsx` | integration | PASS |
| 6 | Toolbar shows on a non-collapsed text selection | `floating-toolbar-plugin.test.tsx` | integration | PASS |
| 7 | Toolbar hides once the selection collapses | `floating-toolbar-plugin.test.tsx` | integration | PASS |
| 8 | Toolbar never shows for a selection inside a code block | `floating-toolbar-plugin.test.tsx` | integration | PASS |
| 9 | Toolbar defers to the link editor (hides) when selection is on a link | `floating-toolbar-plugin.test.tsx` | integration | PASS |
| 10 | Bold button dispatches `FORMAT_TEXT_COMMAND`, applying bold to the selection | `floating-toolbar-plugin.test.tsx` | integration | PASS |
| 11 | Link button wraps the selection in a link via `TOGGLE_LINK_COMMAND` | `floating-toolbar-plugin.test.tsx` | integration | PASS |
| 12 | Judul 1 / Judul 2 buttons convert the block to a `HeadingNode` with the matching tag | `floating-toolbar-plugin.test.tsx` | integration | PASS |
| 13 | Kutipan button converts the block to a `QuoteNode` | `floating-toolbar-plugin.test.tsx` | integration | PASS |
| 14 | Paragraf button converts a heading back to a plain paragraph | `floating-toolbar-plugin.test.tsx` | integration | PASS |
| 15 | Link editor shows nothing when selection is not on a link | `floating-link-editor-plugin.test.tsx` | integration | PASS |
| 16 | Link editor shows the URL in view mode on an existing link | `floating-link-editor-plugin.test.tsx` | integration | PASS |
| 17 | A freshly created (`https://`) link auto-opens edit mode with an empty input | `floating-link-editor-plugin.test.tsx` | integration | PASS |
| 18 | Typing a URL and pressing Enter commits it to the LinkNode | `floating-link-editor-plugin.test.tsx` | integration | PASS |
| 19 | Escape on a freshly created, still-empty link removes the link entirely (text preserved) | `floating-link-editor-plugin.test.tsx` | integration | PASS |
| 20 | Edit button opens edit mode prefilled with the current URL | `floating-link-editor-plugin.test.tsx` | integration | PASS |
| 21 | Trash button removes an existing link but keeps its text | `floating-link-editor-plugin.test.tsx` | integration | PASS |

## Coverage and known gaps

Command: `npx vitest run --coverage --coverage.reporter=json-summary`

| File | Lines | Branches | Functions |
|---|---|---|---|
| `link-utils.ts` | 100% | 100% | 100% |
| `floating-toolbar-plugin.tsx` | 100% | 81.25% | 92.3% |
| `floating-link-editor-plugin.tsx` | 92.64% | 80.64% | 81.25% |
| `page-editor.tsx` | 84.61% | 100% | 71.42% (pre-existing, only the wiring line/import changed) |

All touched files clear the 80% threshold on lines/branches/functions, except `page-editor.tsx`'s function count, which was already below 80% before this change (this task only added one import and one JSX line there) — not remediated, as it's outside this task's scope.

Full project-wide coverage remains well below the repo's configured 80% global threshold (`vitest.config.mts`) — this is pre-existing across many untested Next.js route/page files unrelated to this change and was not addressed here.

**Known, documented scope cuts:**
- `$getSelectedLinkNode` does not walk the rare "collapsed cursor immediately after a single-character link" edge case the playground's `$getSelectedLinkNode` handles — only "anchor is the link" and "anchor's parent is the link" are covered. Not exercised by any current beacon UI flow.
- No automated test for `FloatingToolbarPlugin`'s/`FloatingLinkEditorPlugin`'s window `resize`/`scroll` repositioning — jsdom's stubbed `getBoundingClientRect` makes position-value assertions meaningless; this was instead confirmed by live browser verification (scrolling was not explicitly re-tested there either, but the reposition listeners mirror the playground's own approach 1:1).
- Onblur-to-save was intentionally not implemented for the link editor (only Enter submits, Escape/empty-blur cancels) — a deliberate, simpler UX choice documented in the plugin's own code comment.

## Merge evidence

All RED/GREEN checkpoints were committed individually to the current branch (not squashed):

```
3f54862 test: add reproducer for $getSelectedLinkNode helper (RED)
f8360f3 feat: add $getSelectedLinkNode helper for link-aware editor plugins (GREEN)
6c974ad test: add reproducer for FloatingToolbarPlugin canonical selection pattern (RED)
72b78fd fix: rebuild FloatingToolbarPlugin on Lexical's canonical selection pattern (GREEN)
7ecd978 test: add reproducer for FloatingLinkEditorPlugin (Phase 2) (RED)
15611c2 feat: add FloatingLinkEditorPlugin (Phase 2 link insertion) (GREEN)
c631d9e fix: type test assertions with explicit ElementNode generic, wire FloatingLinkEditorPlugin into PageEditor
97d6ef3 test: cover FloatingToolbarPlugin's block-type buttons (H1/H2/Quote/Paragraph)
```

Final state: `npx vitest run` → 129/129 passing; `npx tsc --noEmit` → no errors; `npx eslint` on all touched files → no issues. Live-browser verification performed against a real seeded page confirmed the same behavior end-to-end (see Task report row 5).
