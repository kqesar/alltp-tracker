---
paths:
  - "src/components/**"
  - "src/hooks/**"
  - "src/styles/**"
  - "src/App.tsx"
  - "src/main.tsx"
  - "index.html"
---

# UI, styles and accessibility

## Components (`src/components/`)

- `tracker/` — `TrackerGrid` → `grid/GridItem` (empty → spacer, `bigkey*` → `BigKeyCell`, else → `Item`) → `items/Item`, which renders boss overlays when the id starts with `boss`. `overlays/BossOverlays.tsx` holds one `Overlay` skeleton behind `CounterOverlay` (chest count, reward) and `MedaillonOverlay`; `items/KeyToggle.tsx` is the keysanity big/small key button (`variant` prop).
- `map/MapTracker.tsx` draws two square worlds (`map-world-light` / `-dark`), side by side, stacked or `auto` (stacks below 35rem via a container query). Coordinates are authored against the whole asset and placed in their world by `toWorldPosition` (`src/utils`).
- `map/MapMarkers.tsx` — `MapChest` and `MapDungeon` are `<button>`s named by `captionToText` (`src/utils/caption.ts`) plus their state, with a glyph per state (✓ ? ✕) besides the colour. The dungeon square under a boss is decorative (`aria-hidden`). Markers keep a 24 px floor; where real locations sit closer than that, WCAG 2.5.8's map-pin exception applies and the e2e target-size check skips `.mapspan`.
- `ui/` — `Header`, `Caption`, `Modal` (native `<dialog>` + `showModal()`), `ConfirmDialog` (opens on Cancel via `data-autofocus`), `PresetSelector`, `TrackerControls`, `BigKeyToggle`.
- Subscribe to the store with one selector per slice, never bare `useGameStore()`.

## Semantics and accessibility

- Every interactive element is a semantic `<button>` (or link) with an accessible name; never a clickable `div`, and never a button inside a button. A native button fires click on Enter and Space, so add no key handlers for them.
- State is never conveyed by colour alone; give it text in the accessible name and a shape or glyph on screen.
- Landmarks and headings stay meaningful (`header`, `main`, labelled `section`s, one `h1`).
- Dialogs go through `Modal`; a destructive confirmation starts focus on the safe choice.

## CSS

- Styles live in `src/styles/`, all imported by `styles/index.css`, which `main.tsx` alone imports. `reset.css` stays first in that list.
- Class names are written literally in the JSX; there is no `CSS_CLASSES` map.
- CSS Grid for layout, never tables; empty grid cells render a spacer rather than `null`.
- Colours, spacing and sizes come from the tokens in `variables.css`; respect `prefers-reduced-motion`.

## Verify in the browser

After any visible change, run `pnpm test:e2e` (overflow, overlapping regions, console errors and failed requests, axe, keyboard reachability at 390 / 820 / 1440 / 1920 px), and look at the page yourself: screenshots of each width via Playwright, since a test passing is not the same as the design being right. Extend `e2e/tracker.e2e.ts` when a new behaviour needs a real browser.
