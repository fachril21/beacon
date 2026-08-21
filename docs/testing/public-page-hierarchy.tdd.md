# TDD Evidence Report: Nested Page Hierarchy on the Public Site

**Source plan:** produced inline via `/plan` this session (no `*.plan.md` artifact written — conversational mode). User confirmed two open decisions before implementation: (1) a published page whose parent isn't published is **hidden entirely**, never promoted to root; (2) the public tree renders **always-expanded**, no collapse UI.

## User Journeys

1. As a Viewer, I want a Space's published pages on the public site to be nested by parent/child, matching the editor's sidebar tree, instead of one flat, arbitrarily-ordered list.
2. As a Viewer, I want a published page whose parent isn't published to simply not appear anywhere on the public site — not shown at the wrong level, not silently promoted to root.
3. As a User comparing the editor sidebar to the published site, I want sibling ordering within each parent to match what I set via drag-and-drop in the editor.

## Task Report

### Task 1 — `buildPageTree` pure helper
- **Summary:** Added `src/lib/build-page-tree.ts`, converting a flat `Page[]` into a parent/child tree, sorting each level independently by the sibling-scoped `order` field, and excluding (hiding) any page whose parent isn't present in the input set — cascading to that page's own descendants.
- **Validation command:** `npx vitest run src/lib/build-page-tree.test.ts`
- **RED:** `Failed to resolve import "./build-page-tree" from "src/lib/build-page-tree.test.ts". Does the file exist?` (1 failed suite, compile-time RED)
- **GREEN:** `PASS (8) FAIL (0)`
- **Guarantee:** root pages sorted by their own `order`; children sorted by their own sibling-scoped `order`, independent of the parent's `order`; multi-level nesting supported; orphaned pages (parent absent from the published set) are hidden, and hiding cascades to their descendants even if those descendants are themselves published.

### Task 2 — Wire the helper into `usePublicToc`
- **Summary:** `usePublicToc` (`src/hooks/use-public-content.ts`) now returns `pages: PageTreeNode[]` per Space (built via `buildPageTree`) instead of a flat `Page[]` sorted by a sibling-scoped number compared across unrelated parents.
- **Validation command:** `npx vitest run src/hooks/use-public-content.test.ts`
- **RED:** 2 of 5 assertions failed against the old flat implementation — `expected [...] to match object { pages: [{ page: {...} }] }` and `expected [...] to have a length of 1 but got 2` (child not nested under parent).
- **GREEN:** `PASS (5) FAIL (0)`
- **Guarantee:** a published child page is returned nested under its published parent, not interleaved as a flat sibling.

### Task 3 — `PublicToc` (sidebar) nested rendering
- **Summary:** `src/components/public/public-toc.tsx` renders the nested tree, always-expanded, with each page's link carrying `data-depth` and `paddingLeft` proportional to depth — mirroring `PageTreeItem`'s indentation, minus editor-only affordances.
- **Validation command:** `npx vitest run src/components/public/public-toc.test.tsx`
- **RED:** 3 of 4 tests failed — no links rendered at all (`Unable to find an accessible element with the role "link"`), because the component still expected a flat `Page[]` and `page.slug` was `undefined` on the new node shape.
- **GREEN:** `PASS (4) FAIL (0)`
- **Guarantee:** a child page's link appears after its parent's in document order; a child's `data-depth` is strictly greater than its parent's; a tree containing only an already-hidden-by-the-hook page still renders correctly (component trusts the hook's hiding).

### Task 4 — `PublicHomeContent` nested rendering
- **Summary:** Same nested rendering applied to the public home page's per-Space page listing.
- **Validation command:** `npx vitest run src/components/public/public-home-content.test.tsx`
- **RED:** `Unable to find an accessible element with the role "link" and name "Getting Started"` — same root cause as Task 3.
- **GREEN:** `PASS (3) FAIL (0)`
- **Guarantee:** parent-before-child document order and depth-based indentation, matching `PublicToc`.

### Task 5 — Refactor: `flattenPageTree`
- **Summary:** `PublicToc` and `PublicHomeContent` had duplicated the same recursive tree-walk as two near-identical local components. Added `flattenPageTree` to `build-page-tree.ts` (depth-annotated, parent-before-child flat list) and refactored both components to `.map()` over it instead of recursing themselves.
- **Validation command:** `npx vitest run src/lib/build-page-tree.test.ts src/components/public/`
- **RED (new coverage for the refactor target):** `TypeError: (0 , __vite_ssr_import_1__.flattenPageTree) is not a function` (3 new tests)
- **GREEN:** `PASS (11)` for `build-page-tree.test.ts`; **`PASS (7)` for the two component test files, unchanged** — proving the refactor was behavior-preserving (no test edits were needed to keep them green).

## Test Specification

| # | What is guaranteed | Test file | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | Empty page list produces an empty tree | `src/lib/build-page-tree.test.ts:"returns an empty array for no pages"` | unit | PASS | `npx vitest run src/lib/build-page-tree.test.ts` |
| 2 | A child page nests under its parent instead of appearing flat | `src/lib/build-page-tree.test.ts:"nests a child page under its parent instead of listing it flat"` | unit | PASS | same |
| 3 | Root pages sort by their own `order` | `src/lib/build-page-tree.test.ts:"sorts sibling root pages by their own order..."` | unit | PASS | same |
| 4 | Children sort by sibling-scoped `order`, independent of the parent's `order` | `src/lib/build-page-tree.test.ts:"sorts children by their sibling-scoped order..."` | unit | PASS | same |
| 5 | Multi-level (grandchild) nesting works | `src/lib/build-page-tree.test.ts:"nests multiple levels deep"` | unit | PASS | same |
| 6 | A published page with an unpublished parent is hidden, not promoted to root | `src/lib/build-page-tree.test.ts:"hides a published page whose parent is not in the published set..."` | unit | PASS | same |
| 7 | Hiding cascades to a hidden page's own published descendants | `src/lib/build-page-tree.test.ts:"cascades hiding to descendants of an orphaned page..."` | unit | PASS | same |
| 8 | `flattenPageTree` returns depth-annotated, parent-before-child order | `src/lib/build-page-tree.test.ts:"annotates each page with its depth..."` | unit | PASS | same |
| 9 | `flattenPageTree` never interleaves sibling subtrees | `src/lib/build-page-tree.test.ts:"keeps sibling subtrees in order without interleaving them"` | unit | PASS | same |
| 10 | `usePublicToc` returns a nested tree per Space, not a flat list | `src/hooks/use-public-content.test.ts:"queries only publishable Spaces..."` | unit (hook) | PASS | `npx vitest run src/hooks/use-public-content.test.ts` |
| 11 | `usePublicToc` nests a published child under its published parent | `src/hooks/use-public-content.test.ts:"nests a published child page under its published parent..."` | unit (hook) | PASS | same |
| 12 | `PublicToc` renders a child page after its parent, not interleaved | `src/components/public/public-toc.test.tsx:"renders a child page nested under its parent..."` | component | PASS | `npx vitest run src/components/public/public-toc.test.tsx` |
| 13 | `PublicToc` indents a child further than its parent | `src/components/public/public-toc.test.tsx:"indents a child page further than its parent..."` | component | PASS | same |
| 14 | `PublicToc` never renders an orphaned page at the wrong level (trusts the hook's hiding) | `src/components/public/public-toc.test.tsx:"never renders a page whose parent isn't in the published tree..."` | component | PASS | same |
| 15 | `PublicHomeContent` renders a child page after its parent, not interleaved | `src/components/public/public-home-content.test.tsx:"renders a child page nested under its parent..."` | component | PASS | `npx vitest run src/components/public/public-home-content.test.tsx` |
| 16 | `PublicHomeContent` indents a child further than its parent | `src/components/public/public-home-content.test.tsx:"indents a child page further than its parent..."` | component | PASS | same |

## Coverage and Known Gaps

Coverage command: `npx vitest run --coverage` (project-wide, v8 provider).

| File | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| `src/lib/build-page-tree.ts` | 100% | 100% | 100% | 100% |
| `src/components/public/public-toc.tsx` | 93.75% | 62.5% | 100% | 100% |
| `src/components/public/public-home-content.tsx` | 84.61% | 62.5% | 100% | 100% |
| `src/hooks/use-public-content.ts` | 73.43% | 59.61% | 100% | 78.18% |

- The uncovered branches in `public-toc.tsx`/`public-home-content.tsx` are the `!page.slug` defensive guard and the `isActive` active-link class ternary — neither is exercised by a dedicated test; both are low-risk, presentational-only branches.
- `use-public-content.ts`'s uncovered lines (99-100, 109-110) are inside `usePublicPage` (slug lookup for a single page), a function this task did not touch — those gaps pre-date this change and are out of scope here.
- **Project-wide** coverage (`All files`) is 75.85% statements / 64.01% branches / 73.29% functions / 80.13% lines, below the repo's configured 80% global threshold on 3 of 4 metrics — this is a **pre-existing** shortfall driven by unrelated files (e.g. `comment-thread-panel.tsx` at 2.43%, `screenshot-upload-prompt.tsx` at 17.64%, `slash-menu-items.tsx` at 42.85%), none of which this task touched. No new file introduced by this task falls below 78% on any metric.

## Merge Evidence

Checkpoint commits on `development`, in order:
1. `test: add reproducer for buildPageTree public-page hierarchy helper` (RED)
2. `feat: add buildPageTree helper for nesting published pages by parent` (GREEN)
3. `test: add reproducer for nested page hierarchy in usePublicToc` (RED)
4. `feat: return a nested page tree from usePublicToc instead of a flat list` (GREEN)
5. `test: add reproducer for nested page rendering in PublicToc` (RED)
6. `feat: render PublicToc as a nested, always-expanded page tree` (GREEN)
7. `test: add reproducer for nested page rendering in PublicHomeContent` (RED)
8. `feat: render PublicHomeContent as a nested, always-expanded page tree` (GREEN)
9. `test: add reproducer for flattenPageTree depth-annotated traversal` (RED)
10. `feat: add flattenPageTree to share tree-walking between public components` (GREEN)
11. `refactor: share tree-walking between PublicToc and PublicHomeContent via flattenPageTree` (REFACTOR, all pre-existing tests green unchanged)

Final full-suite run: `npx vitest run` → `PASS (350) FAIL (0)`. Full project typecheck (`npx tsc --noEmit`) → `No errors found`. Lint on all changed/new files → `No issues found`.
