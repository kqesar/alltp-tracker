---
paths:
  - "apps/web/src/components/**"
  - "apps/web/src/hooks/**"
  - "apps/web/src/styles/**"
  - "apps/web/src/App.tsx"
  - "apps/web/src/main.tsx"
  - "apps/web/index.html"
---

# UI, styles and accessibility

## Components (`apps/web/src/components/`)

- `tracker/` — `TrackerGrid` → `grid/GridItem` routes a cell: empty → spacer, `bigkey*` → `BigKeyCell` (two `KeyToggle` buttons), `boss*` → `BossCell` (a `<fieldset>` named after the dungeon: the boss button plus `MedallionPicker`, `ChestCounter`, `RewardPicker` as sibling buttons from `overlays/BossOverlays.tsx`), else → `Item`.
- Every grid control spreads `useGridFocusable({ row, col, slot })` (roving tab index, arrow-key position; slot 0 is the cell's main control, then reading order) and `useStepHandlers(step, useControlShortcuts(control).aria)` (click forward, right-click or "-" back, touch long-press ignored; `aria-keyshortcuts` lists the control's keyboard shortcuts and "-"). Never put a button inside another.
- Keyboard shortcuts: `hooks/useItemShortcuts.ts` is the one window listener; a bound key steps its control through `stepControl`, exactly as a click does. It shares `isAwayFromBoard` (`apps/web/src/utils/keyboard.ts`: typing in a field, a dialog open) with `useUndoShortcuts`, skips IME composition and auto-repeat, and never takes a Ctrl/Cmd chord or a key that keeps its own job (`refusalOf` in `data/keymap.ts`). The focused cell's "-" gives way to a shortcut on the same physical key.
- `map/MapTracker.tsx` draws two square worlds (`map-world-light` / `-dark`), side by side, stacked or `auto` (stacks below 35rem via a container query). Coordinates are authored against the whole asset and placed in their world by `toWorldPosition` (`apps/web/src/utils`): the alltpr pack's `MARKERS` are in that space (percent of the whole image).
- `map/MapMarkers.tsx` — `MapLocation` (one location or a cave's several: a click checks them all, or none once all are) and `MapDungeon` (a decorative, `aria-hidden` square showing the counter by the pigeonhole rule, under the boss button, which toggles the boss's grid flag) are `<button>`s named by the marker's name plus their state, with a glyph per state (✓ ? ✕) besides the colour. They read their state through the hooks of `apps/web/src/logic/solution.ts` (`useMarkerStatus`, `useBossStatus`), which return strings, so a click re-renders only the markers it changed. Markers keep a 24 px floor; where real locations sit closer than that, WCAG 2.5.8's map-pin exception applies and the e2e target-size check skips `.mapspan`.
- `ui/Tooltip.tsx` — the page's single tooltip, driven by `stores/tooltipStore.ts` (kept out of the game store so hovering never re-renders the board). Controls opt in with `useTooltip({ kind, … })`: mouse hover, keyboard focus, or a touch long-press (a tap stays the control's action). A map marker's (`kind: "marker"`, or a grid boss cell's `kind: "dungeon"`) lists each location it stands for with its state, and a dungeon's says the items its counter has left and how many are surely in logic. The marker's accessible name says its state, so the tooltip is `aria-hidden`. When several hooks give one element the same handler, combine them with `mergeHandlers` (`apps/web/src/utils/mergeHandlers.ts`), never by spreading twice.
- `ui/` — `Header`, `Modal` (native `<dialog>` + `showModal()`; `wide` scrolls a long body between a fixed header and footer), `ConfirmDialog` (opens on Cancel via `data-autofocus`), `PresetSelector`, `TrackerControls`, `BigKeyToggle`, `ShortcutsButton` → `ShortcutsDialog` (rebinding, conflicts, reset, the master switch), `KeyChord` (a chord as `<kbd>` keys, labelled for the player's layout), `StreamViewControl` (the `?view=obs` dialog), `ToolbarMenu` (the More menu button, ARIA menu button pattern), `UpdatePrompt` (the non-modal "new version" notice; never reload on its own).
- `autotrack/` — `AutotrackControl` (the toolbar's plug with its status dot and race-legal badge; `variant="menu"` for More), `AutotrackLiveRegion` (the polite `role="status"`, outside the foldable control, quiet while merely connecting), `AutotrackMoreBadge` (the dot on More once the control folds), and the lazy `AutotrackDialog` (status, Connect/Disconnect/Retry now, diagnostic report, `SetupGuide` with ARIA tabs per OS and the steps ticked from `setupProgress`, `Readout` "What I read"). The dialog opens on a click only: autotracking never pops anything up during a run. Its words live in `apps/web/src/autotrack/` (`status.ts` headlines and dot phases, `guide.ts` fixes, `readout.ts` names).
- The toolbar folds by measured fit, never by breakpoint: system fonts differ between macOS, Windows and Linux. `hooks/useToolbarFit.ts` lays a hidden copy of the bar out in each form (`FITS`, richest first) and writes the richest that holds — the full bar on one row, a folded one on two — to its `data-fit`, and what it folds to `data-fold` tokens, which `ui.css` and `styles/toolbar-menu.css` follow. The fold order: labels, then the secondary actions (Export, Import, Stream view, Shortcuts) into More, then the map layout (`menuitemradio`s in a group), then the key cells toggle (a `menuitemcheckbox`), then New game to an icon, and last Autotracking into More (the first item there, its dot copied onto the More button); Mode and Undo/Redo never fold. More reads `data-fold` as it opens to know which settings it holds. The hook re-checks on resize, content change and font load, moves up only with 24 px to spare, and never re-renders React. Never key toolbar CSS on a viewport width. `StreamViewControl` and `ShortcutsButton` take `variant="menu"` to render as a menu item with their own dialog. React bubbles a portalled dialog's events through its React parents, so a menu item's dialog still reaches the menu's handlers: they act only on events from the menu's own DOM.
- Subscribe to the store with one selector per slice, never bare `useGameStore()`.

## Semantics and accessibility

- Every interactive element is a semantic `<button>` (or link) with an accessible name; never a clickable `div`, and never a button inside a button. A native button fires click on Enter and Space, so add no key handlers for them.
- State is never conveyed by colour alone; give it text in the accessible name and a shape or glyph on screen.
- Landmarks and headings stay meaningful (`header`, `main`, labelled `section`s, one `h1`).
- Dialogs go through `Modal`; a destructive confirmation starts focus on the safe choice.

## CSS

- Styles live in `apps/web/src/styles/`, all imported by `styles/index.css`, which `main.tsx` alone imports. `reset.css` stays first in that list.
- Class names are written literally in the JSX; there is no `CSS_CLASSES` map.
- CSS Grid for layout, never tables; a `<table>` is for tabular data only (the shortcuts list). Empty grid cells render a spacer rather than `null`.
- Colours, spacing and sizes come from the tokens in `variables.css`; respect `prefers-reduced-motion`.

## Verify in the browser

After any visible change, run `pnpm test:e2e` (overflow, overlapping regions, console errors and failed requests, axe, keyboard reachability at 390 / 820 / 1440 / 1920 px), and look at the page yourself: screenshots of each width via Playwright, since a test passing is not the same as the design being right. Extend `apps/web/e2e/tracker.e2e.ts` when a new behaviour needs a real browser.
