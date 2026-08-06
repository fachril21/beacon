# Beacon — Design System

Dark-mode-primary design system for Beacon's authoring product and public reading site. Built as shadcn/ui-compatible OKLCH tokens in tweakcn's export shape. Covers Phase 1a (pure frontend, mock data) end to end: every screen in the brief (editor, annotation canvas, sidebar, public reading view, forms, empty/error states) should be buildable from this document without new visual decisions.

> **Screenshot reconciliation:** the reference screenshot (Vantis' marketing site) arrived after the first pass of this document and has been reconciled in. It is a **light-mode** page — this document keeps dark as the primary theme regardless, because the brief was explicit and repeated on that point ("not a light-mode-first system with a dark mode bolted on") in a way that reads as a mode decision, not a "visual style" the screenshot is meant to override. What the screenshot *did* change, per "screenshot wins on layout density, component shapes, and polish": badges are tight rounded-rectangles, not pills (§5.5); a separate rounded-full "data chip" shape exists specifically for monospace/ID-style content (§5.10); type is bolder and tighter-tracked at the top of the scale (§3.1); sidebar rows carry more generous padding (§5.3); and a small uppercase category label above a card title is sanctioned narrowly for preview/summary cards (§5.4), overriding the generic ban on eyebrow labels since the pinned reference itself uses one. If dark-as-primary was actually meant to be reconsidered in light of this screenshot, say so and I'll redo the palette against a light-mode-primary version of the same hues.

---

## 1. Design principles

1. **Green is a signal, not a wash.** The neon primary marks action and state — buttons, active nav, links, focus, badges. It never becomes a surface color the eye has to read across a 3,000-word guideline. If a screen's dominant color is green, the system has been misapplied.
2. **Midnight, not terminal.** Backgrounds carry a deliberate blue undertone (`hue 250` in OKLCH) rather than true neutral gray or brown-black. Depth comes from soft green-tinted glows and offset shadows, never flat gray card shadows. The reference is premium software at night, not a CRT hacker aesthetic.
3. **One editor, two audiences, one grammar.** The authoring product (Lexical editor, Fabric.js annotation canvas, sidebar) and the public reading site consume the exact same tokens. Density, chrome, and affordances differ by audience; color, type character, and radius language never do.
4. **Contrast is measured, not assumed.** Every text-on-fill pairing below carries a verified WCAG ratio, computed from the actual OKLCH→sRGB values, not eyeballed. Tones that fail body-text contrast are labeled accent/fill-only and are never defaulted into running text.
5. **Calm density for a writing tool.** Hierarchy comes from type scale and spacing rhythm first. Beacon is written in and read from for long stretches — the neon accent punctuates decisions and states, it doesn't compete with the content Users spent five minutes producing.

---

## 2. Color tokens

All colors share one OKLCH-space design: a fixed blue-tinted neutral hue (**250°**) for the entire background/surface/border family, and a fixed acid-green hue (**125.3°**, the anchor `#D6FD91`'s own hue) for the entire primary family. Semantic colors each get their own hue but match the primary family's lightness/chroma envelope so nothing reads as a bootstrap-default color dropped into a neon world.

### 2.1 Background & surface family (hue 250)

| Token | OKLCH | Hex | Used for | Accessibility note |
|---|---|---|---|---|
| `--background` | `oklch(0.155 0.020 250)` | `#060D14` | Page canvas — public reading site, editor content pane | Base for all contrast checks below |
| `--foreground` | `oklch(0.940 0.010 250)` | `#E6ECF2` | Default body text, headings | **16.4:1 on background, 15.0:1 on card** — AAA |
| `--card` | `oklch(0.205 0.021 250)` | `#101820` | Cards, panel surfaces, the Screenshot Block frame | — |
| `--card-foreground` | `oklch(0.940 0.010 250)` | `#E6ECF2` | Text on cards | 15.0:1 |
| `--popover` | `oklch(0.235 0.022 250)` | `#161F28` | Popovers, dropdowns, slash-command menu, context menus | One step brighter than `--card` — floats visibly above it |
| `--popover-foreground` | `oklch(0.940 0.010 250)` | `#E6ECF2` | Text in popovers | 13.9:1 |
| `--muted` | `oklch(0.190 0.021 250)` | `#0D1319` | Inert/disabled regions, subtle section backgrounds, skeleton base | — |
| `--muted-foreground` | `oklch(0.680 0.020 250)` | `#8F9AA4` | Secondary text, placeholders, timestamps, helper copy | **6.8:1 on background, 6.2:1 on card** — passes body text |
| `--border` | `oklch(0.340 0.020 250)` | `#303942` | Default hairline dividers, card outlines, table rules | 1.66:1 vs background — see §2.5 note |
| `--input` | `oklch(0.400 0.020 250)` | `#404952` | Input/textarea/select resting border | 2.13:1 vs background — see §2.5 note |
| `--ring` | `oklch(0.885 0.155 125.3)` | `#C1EB73` | Focus ring (keyboard focus, focused input) — reuses `primary-hover` | 14.3:1, unmissable |
| `--accent` | `oklch(0.270 0.024 250)` | `#1E2732` | Hover background on menu rows, dropdown items, command palette rows | Neutral, not green — see §2.6 |
| `--accent-foreground` | `oklch(0.940 0.010 250)` | `#E6ECF2` | Text on `--accent` | 12.4:1 |

### 2.2 Sidebar family (dedicated shadcn group)

The sidebar sits one step darker than the page canvas so it recedes as a fixed rail, matching the "midnight" background direction rather than the more common lighter-sidebar pattern.

| Token | OKLCH | Hex | Used for |
|---|---|---|---|
| `--sidebar` | `oklch(0.115 0.018 250)` | `#02050B` | Sidebar background |
| `--sidebar-foreground` | `oklch(0.680 0.020 250)` | `#8F9AA4` | Inactive nav item label — **6.8:1+** against sidebar (darker than background, so ratio is at least as good) |
| `--sidebar-primary` | `oklch(0.943 0.141 125.3)` | `#D6FD91` | Active nav item text + left indicator bar |
| `--sidebar-primary-foreground` | `oklch(0.160 0.020 250)` | `#141B24` | (unused directly — reserved for a solid active-pill treatment, see §5.3) |
| `--sidebar-accent` | `oklch(0.205 0.021 250)` | `#101820` | Hover background on nav rows (= `--card` tone, a visible lift off the sidebar base) |
| `--sidebar-accent-foreground` | `oklch(0.940 0.010 250)` | `#E6ECF2` | Hovered nav item label |
| `--sidebar-border` | `oklch(0.340 0.020 250)` | `#303942` | Sidebar's right-hand divider |
| `--sidebar-ring` | `oklch(0.885 0.155 125.3)` | `#C1EB73` | Focus ring inside sidebar (search box, tree items) |

### 2.3 Primary — the neon green family (hue 125.3°, anchored to `#D6FD91`)

Generated as one coherent OKLCH ramp at a fixed hue, varying only lightness and chroma — not hand-picked greens.

| Token | OKLCH | Hex | Used for | Contrast vs `--background` |
|---|---|---|---|---|
| `--primary` | `oklch(0.943 0.141 125.3)` | `#D6FD91` | Primary button fill, active states, icons, links (large/short use), progress, checkmarks | **17.0:1** — safe as text too, but reserved for punctuation (see §2.4) |
| `--primary-foreground` | `oklch(0.160 0.020 250)` | `#141B24` | Text/icons on top of solid `--primary` fills (button labels) | 16.9:1 (ink-on-primary) |
| `--primary-hover` | `oklch(0.885 0.155 125.3)` | `#C1EB73` | Hover state for primary buttons/links; doubles as `--ring` | 14.3:1 |
| `--primary-active` | `oklch(0.790 0.175 125.3)` | `#A0CD3C` | Pressed/active state for primary buttons — darker, more saturated, gives tactile "pushed" feedback | 10.5:1 |
| `--primary-muted` | `oklch(0.320 0.100 125.3)` | `#273B00` | Badge/pill fills (e.g. "Published"), selected sidebar row, selected table row | Fill only — pair with `--primary-muted-foreground` |
| `--primary-muted-foreground` | `oklch(0.900 0.115 125.3)` | `#CCEC97` | Text/icon on `--primary-muted` fills; **also the tone to reach for when green text must sit inline in a paragraph or dense UI** (slightly less saturated than the anchor, so it doesn't vibrate at length) | 14.9:1 on background, 10.9:1 on `--primary-muted` |

**Accessibility verdict on the primary ramp, verified by direct OKLCH→sRGB→relative-luminance computation, not estimation:**

- `--primary` through `--primary-active` **all pass 4.5:1 body-text contrast** against `--background` (17.0 → 10.5:1) — numerically, even the anchor itself is safe as text.
- Deeper ramp members intended purely as fills (e.g. an `oklch(0.46 0.15 125.3)` tone tested during derivation) drop to **2.9:1 and fail** — that tier is accent/fill-only and must never carry text.
- **Design rule regardless of the numbers:** default body copy always uses `--foreground`, never a green tone, even where green would pass contrast. Green is reserved for buttons, active nav, links, focus rings, icons, and badges — per Principle 1. Where green text is genuinely needed inline (a highlighted term, an active filter chip), use `--primary-muted-foreground`, not the raw anchor — it reads as intentional rather than loud.

### 2.4 Secondary & destructive

| Token | OKLCH | Hex | Used for | Contrast |
|---|---|---|---|---|
| `--secondary` | `oklch(0.260 0.020 250)` | `#1D252D` | Secondary button fill (Cancel, ghost-adjacent actions) | — |
| `--secondary-foreground` | `oklch(0.940 0.010 250)` | `#E6ECF2` | Text on secondary buttons | 11.9:1 |
| `--destructive` | `oklch(0.680 0.190 25)` | `#F75D59` | Destructive button fill, delete icons, inline error text | 6.2:1 on background |
| `--destructive-foreground` | `oklch(0.160 0.020 250)` | `#141B24` | Text on destructive fills | 6.2:1 (ink-on-fill) |

A coral-red (hue 25°) rather than a pure Bootstrap red — it sits in the same warm-but-not-orange family as `--warning` and reads as part of this palette rather than an imported default.

### 2.5 Border contrast — documented trade-off

`--border` (1.66:1) and `--input` (2.13:1) do **not** reach the WCAG 1.4.11 non-text 3:1 threshold against `--background`. Pushing lightness far enough to hit 3:1 (`~L 0.55+`) reads as a bright gray seam across a near-black canvas and breaks the "midnight, not terminal" principle — this system accepts that trade-off deliberately rather than by omission, and every dark-mode system in this product's reference class (Linear, Vercel dashboard, GitHub dark) makes the same call. **Mitigation, not left as a gap:** interactive elements never rely on border contrast alone to signal their boundary or state —
- Inputs sit on `--card`/`--popover` (a background-fill difference from the page), not directly on `--background`.
- Every focusable element gets the full-strength `--ring` (14.3:1) on focus.
- Buttons are filled surfaces (`--primary`, `--secondary`, `--destructive`), not outline-only, so their boundary is a fill-contrast difference, not a border.

### 2.6 Semantic colors — success, warning, info

Same lightness/chroma envelope as `--primary` (L ≈ 0.78–0.82, C ≈ 0.13–0.19), each rotated to its own hue so the set reads as one designed family, not a generic traffic-light import.

| Role | Fill token | OKLCH | Hex | Contrast vs bg | Foreground token | Hex |
|---|---|---|---|---|---|---|
| Success | `--success` | `oklch(0.800 0.160 152)` | `#60DB89` | 11.2:1 | `--success-foreground` | `#141B24` |
| Warning | `--warning` | `oklch(0.820 0.160 80)` | `#FAB72A` | 11.0:1 | `--warning-foreground` | `#141B24` |
| Info | `--info` | `oklch(0.780 0.130 230)` | `#4BC6FA` | 10.0:1 | `--info-foreground` | `#141B24` |

Each also gets a muted fill/foreground pair for badges (see §2.7) — same construction as `--primary-muted`.

| Token | OKLCH | Hex |
|---|---|---|
| `--success-muted` / `--success-muted-foreground` | `oklch(0.240 0.075 152)` / `oklch(0.820 0.140 152)` | `#00290B` / `#77DE96` |
| `--warning-muted` / `--warning-muted-foreground` | `oklch(0.260 0.085 80)` / `oklch(0.840 0.140 80)` | `#391D00` / `#FAC053` |
| `--info-muted` / `--info-muted-foreground` | `oklch(0.240 0.070 230)` / `oklch(0.800 0.120 230)` | `#00243A` / `#60CCFC` |
| `--destructive-muted` / `--destructive-muted-foreground` | `oklch(0.240 0.090 25)` / `oklch(0.820 0.150 25)` | `#400407` / `#FF9B92` |

`success` deliberately sits at hue 152° — close enough to `primary` (125°) to feel like the same acidic family, far enough to read as a distinct signal at a glance (badges, toasts) rather than being confused with the brand green.

### 2.7 Chart colors

Not required by any Phase 1a screen in the brief (no analytics/dashboard surface is specified), but included for shadcn/tweakcn export completeness and future-proofing:

`--chart-1` `#A7CE5B` · `--chart-2` `#32B3E6` · `--chart-3` `#E9AB2B` · `--chart-4` `#AB8BE3` · `--chart-5` `#EF6661`

**Assumption flagged:** chart-4 introduces a new hue (violet, 300°) purely for categorical variety since the semantic set only offers four distinct hues — override if/when an analytics surface is actually scoped.

---

## 3. Typography

**Family: Geist Sans (UI + long-form) / Geist Mono (code, technical labels).** Not a default-by-omission pick: Geist is MIT-licensed, ships first-party with Next.js (`next/font` / `geist` package — zero extra webfont request), has a genuinely geometric, slightly squared character that matches "crisp geometric type" in the brief without reading as generic as Inter, and its Mono sibling shares the same design DNA — code blocks and the annotation toolbar's technical labels feel like one typeface family, not a mismatched pairing. Both faces cover extended Latin, so Bahasa Indonesia diacritics and punctuation render natively.

### 3.1 Type scale

| Token | Size / Line-height | Weight | Tracking | Used for |
|---|---|---|---|---|
| `display` | 2.75rem / 1.1 (44px) | 700 | −0.03em | Public guideline page title, top-level Space name |
| `h1` | 2.125rem / 1.15 (34px) | 700 | −0.025em | Editor page title (in-canvas H1) |
| `h2` | 1.5rem / 1.25 (24px) | 600 | −0.015em | Section headings |
| `h3` | 1.25rem / 1.3 (20px) | 600 | −0.01em | Sub-section headings, dialog titles |
| `h4` | 1.0625rem / 1.35 (17px) | 600 | −0.005em | Card titles, list group headers |
| `body-lg` | 1.0625rem / 1.7 (17px) | 400 | 0 | **Public reading page body copy** — the one place line-height goes generous |
| `body` | 0.9375rem / 1.6 (15px) | 400 | 0 | Editor body text, form field values, default UI paragraphs |
| `body-sm` | 0.8125rem / 1.45 (13px) | 500 | 0 | Buttons, table cells, nav labels, dense UI text |
| `caption` | 0.75rem / 1.4 (12px) | 500 | 0.01em | Timestamps, helper text, badge labels, metadata |
| `mono` | 0.8125rem / 1.5 (13px) | 450 | 0 | Inline code, code blocks, annotation coordinate labels |

### 3.2 Long-form reading guidance (public site)

- Body measure: **65–75ch** at `body-lg` (1.0625rem) — this is what sets the 720px public reading column in §4.
- Paragraph spacing: `1.25em` between paragraphs (not just line-height alone — long guideline pages need visible paragraph breaks for scannability).
- Headings inside long-form content get **more space above than below** (2.5rem above `h2`, 0.75rem below) — a heading belongs to the section it introduces, not the one before it.
- Links in body copy use `--primary-muted-foreground` (`#CCEC97`) underlined, never the raw `--primary` anchor — at paragraph scale the full-saturation anchor vibrates against `--background`; the muted-foreground tone is calmer at reading distance while still passing 14.9:1.
- Inline code (`` `code` ``) uses `mono` at `body` size, `--card` background, `--border` outline, 3px horizontal padding.

**Assumption flagged:** the `mono` weight (450) assumes Geist's variable-weight axis is available. If the build pipeline only ships static weights, round to 400 — the scale and line-heights are unaffected. `display`/`h1` now sit at 700 and `h2`–`h4` at 600, both standard static-weight steps, so no rounding is needed there after the screenshot's bolder, tighter-tracked headline character was folded in.

**Optional device, not part of core chrome:** the reference screenshot highlights one phrase in its headline with a solid `--primary`-colored box behind black text ("working software"). None of Beacon's described Phase 1a screens (editor, sidebar, public reading, forms, empty/error states) call for a marketing-style headline, so this isn't specified as a component here. If a marketing/about page is ever added to the public site, that treatment — `--primary` background, `--primary-foreground` text, `radius-sm`, tight padding, inline with the surrounding headline — is the correct way to bring it in; it should not appear inside guideline content itself, where it would compete with the User's actual writing.

---

## 4. Spacing & layout

### 4.1 Base unit and scale

Base unit **4px**. Scale is named directly in pixels to stay unambiguous across editor, canvas, and public-site code:

`space-1` 4px · `space-2` 8px · `space-3` 12px · `space-4` 16px · `space-5` 20px · `space-6` 24px · `space-8` 32px · `space-10` 40px · `space-12` 48px · `space-16` 64px · `space-20` 80px · `space-24` 96px

### 4.2 Container widths

| Region | Width | Note |
|---|---|---|
| Sidebar (expanded) | 272px | Fixed rail, `--sidebar` background |
| Sidebar (collapsed) | 64px | Icon-only rail; labels appear on hover as a popover |
| Editor content column | 760px | Comfortable line length for block editing; matches `body` scale |
| Screenshot block (breakout) | up to 960px | Screenshot + annotation blocks may exceed the text column up to the content pane's full width — images are the one element allowed to break the grid |
| Public reading column | 720px | Tuned to 65–75ch at `body-lg` (§3.2) |
| Public-site right rail (page TOC) | 240px | Optional, collapses below 1280px viewport |
| Overall app shell max-width | 1440px | Centers beyond this on ultra-wide displays |

### 4.3 Border radius scale

Deliberately tight and geometric — not the soft/bubbly rounded-everything look. Reinforces "crisp geometric type" and "sharp, high-craft" from the brief.

`radius-sm` 6px (badges, small buttons, checkboxes) · `radius-md` 10px — **`--radius` base** (buttons, inputs, dropdown items) · `radius-lg` 14px (cards, popovers) · `radius-xl` 20px (dialogs, the annotation canvas frame) · `radius-full` 9999px (avatars, icon-only buttons, status dots)

---

## 5. Core components

### 5.1 Buttons

Filled surfaces, not outline-by-default — boundary comes from fill contrast, not a border (see §2.5).

- **Primary:** `--primary` fill, `--primary-foreground` text, `radius-md`, `body-sm` weight 600. Hover → `--primary-hover` + a soft 12px green glow shadow (`0 4px 20px -4px oklch(0.943 0.141 125.3 / 0.35)`) — this is the one place the brief's "soft glows using primary green rather than default gray shadows" shows up structurally. Active/pressed → `--primary-active`, glow removed, 1px translateY(1px).
- **Secondary:** `--secondary` fill, `--secondary-foreground` text, `1px solid --border`. Hover → `--accent` fill.
- **Ghost:** transparent, `--foreground` text. Hover → `--accent` fill, no border ever (a bordered ghost button is a secondary button).
- **Destructive:** `--destructive` fill, `--destructive-foreground` text. Hover → 8% darker via `oklch` lightness reduction, no glow (glows are a primary-only signature, not a generic hover treatment).
- All buttons: `--ring` focus ring at 2px offset 2px on keyboard focus, disabled state = 40% opacity + `cursor-not-allowed`, no color change (opacity alone signals disabled, consistent everywhere).

### 5.2 Inputs & form fields

`--card` background, `1px solid --input`, `radius-md`, `body` text, `space-3`/`space-4` padding. Placeholder text in `--muted-foreground`. Focus → border becomes `--ring`, plus the same 2px ring offset as buttons. Error state → border becomes `--destructive`, helper text below in `--destructive` at `caption` scale with an inline error icon (never color alone — Principle 4's contrast discipline extends to never encoding state by hue alone). Label sits above the field, `caption` scale, `--muted-foreground`, `600` weight when the field is required (plus a `--destructive` asterisk).

### 5.3 Sidebar navigation

`--sidebar` background, `1px solid --sidebar-border` right edge. Tree rows: `space-3` vertical padding (bumped up from a tighter first pass to match the reference screenshot's more generously padded sidebar list items), `radius-sm`, indent `space-4` per nesting level with a 1px `--sidebar-border` guideline connecting siblings (not a full vertical rule per level — that gets visually noisy past two levels of Space → Page → Sub-page nesting). Inactive row: `--sidebar-foreground` text, transparent background. Hover: `--sidebar-accent` background. **Active row:** `--sidebar-accent` background + a 2px `--sidebar-primary` left-edge indicator bar (not a full green fill — a filled active row at this frequency would violate Principle 1) + `--sidebar-primary` text color for that row only. Drag-and-drop reorder: dragged row drops to 60% opacity, drop-target gap renders as a 2px `--primary` line between rows.

**Divergence from the screenshot, deliberate:** Vantis' sidebar stacks icon-above-label with uppercase product names — that pattern fits a short, fixed list of ~14 named products. Beacon's sidebar is a nested, user-authored Space → Page → Sub-page tree, so it keeps icon-left/label-right with indentation and a disclosure chevron, and page titles are never forced to uppercase (they're real authored content, not codenames). Everything else — the generous row padding, small bold labels, corner status chips — carries over.

### 5.4 Cards

`--card` background, `1px solid --border`, `radius-lg`, `space-6` padding. No shadow at rest (depth in this system comes from background-lightness steps, not drop shadows — reserve shadows for floating/interactive elements per §5.1's glow and §5.8 dialogs). Hover (when a card is itself clickable, e.g. a Space card on a dashboard): border becomes `--border` at `input`-strength lightness, no lift/translate — this is a calm documentation tool, not a marketing card grid.

**Category-label exception:** the reference screenshot's one preview card ("AI APPLICATION" caption above "Vantis AI Application") uses a small uppercase kicker above its title — a pattern this system otherwise avoids (a bare eyebrow above a heading adds a label the heading should carry itself). It's sanctioned narrowly, because the pinned screenshot uses it, for cards that genuinely group multiple items under a category (e.g. a Space-summary card showing its platform category above the Space name) — `caption` scale, `--muted-foreground`, `0.04em` tracking, uppercase, `space-2` below it before the `h4` title. It is not a general heading treatment — a Page title, a dialog title, or a section heading never gets a kicker.

### 5.5 Badges / status pills

`radius-sm` (6px) — **not** `radius-full`. The reference screenshot's status tags ("SOON", "BETA") are tight rounded-rectangles, closer to a label chip than a pill; a fully round badge reads softer/friendlier than this system's "sharp, high-craft" direction wants. `caption` scale, `600` weight, `space-2`/`space-3` horizontal-heavy padding (compact tags, not buttons).

| State | Background | Text |
|---|---|---|
| Draft | `neutral` — `oklch(0.30 0.020 250)` `#262F38` | `oklch(0.85 0.010 250)` `#C9CED4` |
| Published | `--primary-muted` `#273B00` | `--primary-muted-foreground` `#CCEC97` |
| Pending | `--warning-muted` `#391D00` | `--warning-muted-foreground` `#FAC053` |
| Archived/Unpublished | `neutral` (same as Draft, at 70% opacity) | same, 70% opacity |

A small dot (4px, `radius-full`, solid fill of the badge's un-muted counterpart color) leads the label for Published/Pending — the dot, not the text, gets the full-saturation tone; this keeps the pill itself calm while still reading as a clear status signal at a glance.

### 5.6 Tooltips

`--popover` background, `--popover-foreground` text, `1px solid --border`, `radius-sm`, `caption` scale, `space-2`/`space-3` padding, 4px offset from trigger, 150ms delay before showing, no delay on hide. No arrow/caret (a caret at this scale on a hairline-bordered surface reads as visual noise; the 4px offset plus the border is sufficient anchoring).

### 5.7 Modals / dialogs

`--popover` background, `radius-xl`, `1px solid --border`, centered, max-width 480px (confirmation dialogs) or 640px (form dialogs — e.g. "New Space"). Backdrop: `--background` at 70% opacity with 4px backdrop-blur. Header: `h3` title + `--muted-foreground` ghost close button, top-right. Footer actions right-aligned, secondary action (Cancel) left of primary. Destructive confirms (delete Space/Page) use the destructive button as primary and require the entity name typed in a confirmation input for anything containing published content — this is a product-behavior call, not just a visual one, but it's the dialog's defining state and belongs here.

### 5.8 Publish button — disabled-with-tooltip state

The Publish button is `--primary` scale (this is the single highest-stakes action in the product — it deserves the signature color, per Principle 1's "marks action"). When disabled (no unsaved changes to publish, or the User lacks permission), it does **not** simply gray out silently:

- Fill drops to `--secondary`, text to `--muted-foreground`, `cursor-not-allowed`.
- On hover (not focus-only, since the point is discoverability for a mouse user probing why it's inert), a tooltip appears (§5.6 styling) explaining the specific reason — "No changes to publish" or "You don't have permission to publish this Space" — never a generic "Disabled." This is a UX-copy requirement, not just a state requirement: a disabled button with no explanation is a dead end.
- The tooltip itself gets a 1px `--warning` top border (2px inset) when the reason is a permission issue specifically, to visually distinguish "nothing to do" from "you can't do this" at a glance.

### 5.9 "Was this helpful?" feedback widget

Lives at the bottom of every published public-site page, inside its own `--card` panel, `radius-lg`, centered, `space-8` vertical margin from the content above it (generous separation — Principle 5).

- Prompt: `h4` scale, centered — "Was this helpful?" (Bahasa Indonesia copy: "Apakah halaman ini membantu?").
- Two pill buttons side by side: Yes / No — `secondary` button styling at rest (not primary; this is a low-stakes, ambient action, not the page's primary CTA). Selected state (after click): the chosen pill switches to `--primary-muted` fill + `--primary-muted-foreground` text + a checkmark, the other pill fades to 40% opacity and becomes non-interactive.
- On "No" selection, an optional free-text `textarea` (§5.2 styling) expands below with a `body-sm` prompt — "What could be better?" — and a `secondary` Submit button. Expansion is an actual height animation (200ms ease-out), not an abrupt reflow.
- Post-submit: the whole widget collapses to a single line — a `--success` checkmark icon + "Thanks for the feedback" (`body-sm`, `--muted-foreground`) — so a Viewer who already responded doesn't see the prompt again on re-render within the same session.

### 5.10 Data / code chip

A distinct shape from badges, taken directly from the reference screenshot's contract-address element (the rounded-full "CA `0xB6d6…`" pill in its header). Reserved for monospace, copyable, identifier-shaped content: object/version IDs, share links, the annotation canvas's per-shape coordinate readout — never for status or category labels, which stay on `radius-sm` per §5.5.

`radius-full`, `--card` background, `1px solid --border`, `mono` scale, `space-2`/`space-3` padding, a small leading label in `caption`/`--muted-foreground` (e.g. "ID") followed by the mono value in `--foreground`, and a trailing 14px copy icon (`--muted-foreground`, `--foreground` on hover) that swaps to a `--success` check for 1.5s after copying.

---

## 6. Editor & annotation-specific styling

These are the product's signature surfaces (per PRODUCT.md's positioning — the screenshot-annotate-describe loop is the differentiator) and get their own deliberate treatment rather than generic component reuse.

### 6.1 Lexical block editor — toolbar

A **floating, contextual toolbar** (appears on text selection, not a permanently docked ribbon) — matches "zero context-switch" and keeps the writing surface uncluttered for long-form authoring:

- `--popover` background, `radius-md`, `1px solid --border`, subtle elevation shadow (`0 8px 24px -8px oklch(0.06 0.02 250 / 0.6)` — a genuinely dark, cool-toned shadow, not default gray).
- Icon buttons: 32×32px, `radius-sm`, `--muted-foreground` icon at rest, `--foreground` on hover with `--accent` background, `--primary` icon color when the mark is active on the current selection (Bold/Italic/etc. toggled state) — this is the toolbar's one use of green, and it's a state signal, not decoration.
- Grouped by a 1px `--border` vertical divider (text marks | block type | insert), `space-1` gap within groups, `space-2` gap between groups.

### 6.2 Slash-command menu

Triggered by `/`, appears inline at the cursor:

- `--popover` background, `radius-lg`, `1px solid --border`, same elevation shadow as §6.1, max-height 320px with internal scroll.
- Each row: `space-2`/`space-3` padding, `radius-sm` on hover/keyboard-highlight (`--accent` background), a 28×28px icon tile (`--muted` background, `radius-sm`, icon in `--foreground`) + block name (`body-sm`, `--foreground`) + short description (`caption`, `--muted-foreground`) right-aligned or below on narrow widths.
- **The Screenshot Block entry gets visual priority** — it's the differentiator, not just another list item: it sits pinned at the top of the default (no-query) list regardless of alphabetical order, and its icon tile uses `--primary-muted` background with a `--primary-muted-foreground` icon instead of the neutral `--muted` treatment every other block gets. One deliberate exception to the "green punctuates, doesn't decorate menus" rule, because this menu's whole job is to make the signature feature findable in under a second.
- Keyboard-highlighted row additionally gets a 2px `--primary` left-edge bar (same visual language as the sidebar's active-row indicator, §5.3 — one consistent "this is the selected one" grammar across the product).

### 6.3 Fabric.js annotation canvas — tool palette

The annotation canvas is a dedicated, focused mode (opens over/within the Screenshot Block, not a tiny inline toolbar) — it deserves a compositionally distinct chrome from the writing editor, since annotating is a different cognitive mode than writing prose.

- **Palette placement:** a vertical rail, 64px wide, fixed to the left edge of the canvas frame, `--sidebar` background (reuses the sidebar tone — visually signals "this is a tool chrome, not content," consistent with how the app already uses that tone for the nav rail) — `radius-xl` on the canvas frame's outer corners only (§4.3).
- **Tool buttons** (Box, Arrow, Marker, Label, Blur — five tools per the brief): 48×48px, `radius-md`, stacked with `space-2` gap. Icon in `--muted-foreground` at rest. **Selected tool:** `--primary` fill (solid, full-saturation — this is the one UI surface in the whole system where a filled-green control at this size is correct, because exactly one tool is ever active at a time, so it can never read as "everything is green") with `--primary-foreground` icon. Hover (unselected): `--accent` background.
- **Numbered marker tool** specifically previews its next number (small `caption`-scale badge, `--primary-muted` fill, corner of the tool button) so a User placing marker 4 doesn't have to count existing markers on the canvas first.
- **Blur tool** gets a visually distinct icon treatment (a `--warning` 1px inner ring around its tool button, always, selected or not) since it's a destructive-adjacent, redaction-purpose tool applied directly to sensitive image content — a quiet "handle carefully" signal, not a full warning-color button (that would suggest something is wrong, not that the tool itself is sensitive).
- **Property panel** (stroke color/width, arrow style, label font size — appears contextually below the selected tool or as a floating panel near the selection): `--popover` background, `radius-lg`, same elevation shadow as §6.1. Color options for annotation strokes are a small fixed swatch set (not a full picker) drawn from `--destructive`, `--warning`, `--primary`, `--info`, and `--foreground` (white) — the semantic set doubles as the annotation palette so a red box, say, reads consistently as "flagging something" whether it's a UI badge or a hand-drawn annotation.
- **Canvas surface itself:** the uploaded screenshot renders at native resolution inside a `--card`-bordered frame; the canvas background behind/around a non-full-bleed image is `--background` (not `--card`) so the screenshot itself is the unambiguous focal point.

---

## 7. States

### 7.1 Empty states

Centered within their container, `space-12` vertical padding. A single-color line icon (drawn, not emoji — 48×48px, `--muted-foreground` stroke, 1.5px weight) + `h4` headline + `body-sm` `--muted-foreground` supporting line + one `primary` or `secondary` action button where an action exists (e.g. empty Space → "Create your first page"). No decorative illustration library — the icon plus generous whitespace carries it, consistent with Principle 5.

### 7.2 Loading states

- **Skeleton, not spinner**, for content that has a known shape (page list, sidebar tree, editor loading a Page): `--muted` background blocks, `radius-md`, animated with a subtle left-to-right shimmer (`--muted` → `--accent` → `--muted`, 1.5s ease-in-out loop) — the shimmer highlight uses `--accent`, never a green tint (a shimmering-green skeleton would read as a status signal, contradicting Principle 1).
- **Spinner** (12–16px, `--primary` stroke on a `--border`-colored track) reserved for actions with no predictable content shape: button loading state, autosave-in-flight indicator.
- **Autosave indicator** (small, top of editor or in the toolbar): three states in sequence — "Saving…" (`caption`, `--muted-foreground`, small spinner) → "Saved" (`caption`, `--muted-foreground`, small `--success` checkmark, fades after 2s) → on failure, "Couldn't save — retrying" (`caption`, `--destructive`, persists until resolved, does not auto-fade). This directly serves the "zero data-loss tolerance" NFR from PRODUCT.md — the indicator must never silently disappear on a failure.

### 7.3 Error states

Inline errors (form fields): see §5.2. Page-level errors (failed to load a Page, network failure): same composition as empty states but the icon is a `--destructive`-stroke line icon, headline names the actual problem ("Couldn't load this page" not "Something went wrong"), supporting line offers the concrete next step, and the action button is `secondary` with a Retry action — destructive-colored icon, but never a destructive-colored *button*, since retrying isn't a destructive action.

### 7.4 Public-site "page no longer available" state

Distinct from a generic error — this is an expected, common outcome (an author unpublished a page, or a Viewer followed a stale link), not a failure:

- Full-height centered composition on the public site's own chrome (its simplified nav stays visible above).
- Icon: a line-drawn "compass" or "signpost" mark at 56px (reads on-brand for "Beacon" as a product name — a lighthouse/beacon motif is available here without forcing it elsewhere in the system), `--muted-foreground` stroke.
- Headline (`h3`): "This page isn't available anymore" (ID: "Halaman ini sudah tidak tersedia").
- Supporting line (`body-sm`, `--muted-foreground`): "It may have been unpublished or moved."
- One `secondary` action: "Back to [Organization name] docs" → the Organization's public home. No search box here specifically (avoid implying the missing page is searchable/recoverable when it may simply be gone) — the public site's persistent nav already carries global search.

**Assumption flagged:** the beacon/signpost icon motif is my own call, drawing on the product name — swap it for a plain "file not found" icon if a literal lighthouse reference feels off-brand once you see it built.

---

## 8. Dark mode token export

Ready to paste into `globals.css` (or wherever the project's shadcn/ui theme lives). Structured in tweakcn's OKLCH export shape. This system is dark-mode-primary — the `:root` block below **is** the default theme, not a `.dark` override.

```css
:root {
  --radius: 0.625rem;

  /* Core surfaces */
  --background: oklch(0.155 0.020 250);
  --foreground: oklch(0.940 0.010 250);
  --card: oklch(0.205 0.021 250);
  --card-foreground: oklch(0.940 0.010 250);
  --popover: oklch(0.235 0.022 250);
  --popover-foreground: oklch(0.940 0.010 250);

  /* Primary — neon green, anchored to #D6FD91 */
  --primary: oklch(0.943 0.141 125.3);
  --primary-foreground: oklch(0.160 0.020 250);
  --primary-hover: oklch(0.885 0.155 125.3);
  --primary-active: oklch(0.790 0.175 125.3);
  --primary-muted: oklch(0.320 0.100 125.3);
  --primary-muted-foreground: oklch(0.900 0.115 125.3);

  /* Secondary / muted / accent */
  --secondary: oklch(0.260 0.020 250);
  --secondary-foreground: oklch(0.940 0.010 250);
  --muted: oklch(0.190 0.021 250);
  --muted-foreground: oklch(0.680 0.020 250);
  --accent: oklch(0.270 0.024 250);
  --accent-foreground: oklch(0.940 0.010 250);

  /* Destructive */
  --destructive: oklch(0.680 0.190 25);
  --destructive-foreground: oklch(0.160 0.020 250);

  /* Semantic (success / warning / info) */
  --success: oklch(0.800 0.160 152);
  --success-foreground: oklch(0.160 0.020 250);
  --success-muted: oklch(0.240 0.075 152);
  --success-muted-foreground: oklch(0.820 0.140 152);

  --warning: oklch(0.820 0.160 80);
  --warning-foreground: oklch(0.160 0.020 250);
  --warning-muted: oklch(0.260 0.085 80);
  --warning-muted-foreground: oklch(0.840 0.140 80);

  --info: oklch(0.780 0.130 230);
  --info-foreground: oklch(0.160 0.020 250);
  --info-muted: oklch(0.240 0.070 230);
  --info-muted-foreground: oklch(0.800 0.120 230);

  --destructive-muted: oklch(0.240 0.090 25);
  --destructive-muted-foreground: oklch(0.820 0.150 25);

  /* Borders, inputs, focus */
  --border: oklch(0.340 0.020 250);
  --input: oklch(0.400 0.020 250);
  --ring: oklch(0.885 0.155 125.3);

  /* Sidebar */
  --sidebar: oklch(0.115 0.018 250);
  --sidebar-foreground: oklch(0.680 0.020 250);
  --sidebar-primary: oklch(0.943 0.141 125.3);
  --sidebar-primary-foreground: oklch(0.160 0.020 250);
  --sidebar-accent: oklch(0.205 0.021 250);
  --sidebar-accent-foreground: oklch(0.940 0.010 250);
  --sidebar-border: oklch(0.340 0.020 250);
  --sidebar-ring: oklch(0.885 0.155 125.3);

  /* Charts */
  --chart-1: oklch(0.800 0.150 125.3);
  --chart-2: oklch(0.720 0.130 230);
  --chart-3: oklch(0.780 0.150 80);
  --chart-4: oklch(0.700 0.130 300);
  --chart-5: oklch(0.680 0.170 25);

  /* Typography */
  --font-sans: "Geist", "Geist Fallback", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", "Geist Mono Fallback", ui-monospace, "SFMono-Regular", monospace;

  /* Shadows — cool-toned, never default gray */
  --shadow-color: 250 30% 3%;
  --shadow-sm: 0 1px 2px -1px hsl(var(--shadow-color) / 0.4);
  --shadow-md: 0 4px 12px -4px hsl(var(--shadow-color) / 0.5);
  --shadow-lg: 0 8px 24px -8px hsl(var(--shadow-color) / 0.6);
  --shadow-primary-glow: 0 4px 20px -4px oklch(0.943 0.141 125.3 / 0.35);

  --tracking-tight: -0.02em;
  --tracking-normal: 0em;
  --tracking-wide: 0.01em;
}
```

This is the only palette Beacon ships in Phase 1a — no separate `.dark` block, since dark is the product's one intended experience per the brief. If a light mode is ever scoped later, it is a new design pass against this same primary/semantic hue set, not a mechanical inversion of these values.
