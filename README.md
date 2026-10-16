# A Link to the Past Tracker

![Build Status](https://img.shields.io/github/actions/workflow/status/kqesar/alltp-tracker/ci.yml?branch=master&label=build)
![Version](https://img.shields.io/github/v/release/kqesar/alltp-tracker?label=version)
![License](https://img.shields.io/github/license/kqesar/alltp-tracker?label=license)

An item and progress tracker for **The Legend of Zelda: A Link to the Past** randomizer runs. It keeps track of the items you have found and works out, in real time, which chests you can reach and which dungeons you can clear.

**→ [kqesar.github.io/alltp-tracker](https://kqesar.github.io/alltp-tracker/)**

Originally forked from [TestRunnerSRL/lttp-tracker](https://github.com/TestRunnerSRL/lttp-tracker) and since rewritten in React 19 and TypeScript. The game logic remains inspired by the original.

## Using it

**Items** — click a cell to cycle its state, right-click to step it back. Progressive items step through their levels (sword 0→4, gloves 0→2) and wrap round; the rest toggle on and off. Greyed means not obtained. **Undo / Redo** (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) take back any change, a new game included.

**Map** — every marker is colour-coded against the items you hold:

| | |
|---|---|
| 🟩 green | reachable now |
| 🟨 yellow | reachable, but the logic is not certain |
| 🟥 red | out of logic |
| ⬛ grey | already done |

Each state also has a glyph (✓ ? ✕), so colour is never the only cue. Click a chest to mark it opened, or a boss to mark it beaten. Hover or focus anything to see its requirements in a tooltip; on a touch screen, press and hold. **Map: Auto / Side / Stack** sets how the two worlds sit: Auto keeps them side by side while there is room and stacks them on a narrow screen; the choice is remembered on this device.

**Boss overlays** — each boss cell carries three corner buttons: the medallion requirement (top right, Misery Mire and Turtle Rock only), the remaining chest count (bottom left) and the reward, crystal or pendant (bottom right). Click steps them forward, right-click back.

**Keyboard** — the item grid is a single Tab stop: arrow keys move inside it (through a boss's overlays too) and wrap, Home / End jump to the ends of a row, Ctrl+Home / End to the ends of the grid. Space and Enter step the focused control forward, "-" steps it back. Every map marker is a button Tab can reach; "Skip to map" jumps there.

**Presets** — pick a run type to set the rules; keysanity adds the big and small key cells to the grid. Progress is saved to the browser automatically, and can be exported or imported as JSON.

## Streaming with OBS

The stream view, [`?view=obs`](https://kqesar.github.io/alltp-tracker/?view=obs), is the item grid alone on a transparent background. It fills its source, centred, at a size that keeps the pixel art sharp, and follows the run live. The toolbar's **Stream view** button copies its address. In OBS 31 or newer:

1. **Track in a dock**: under *Docks → Custom Browser Docks*, add `https://kqesar.github.io/alltp-tracker/` and track your run there.
2. **Show the grid**: add a *Browser Source* with the stream view's address. At 512 × 384 (512 × 448 with the key cells shown) every icon pixel is drawn whole; double it for a larger grid, or pick any size. Set the size in the source's properties: dragging its handles resamples the image and blurs it.
3. **Check the sync on your first run**: the dock and the source share OBS's browser storage, so the source is expected to follow every click in the dock. Items can also be clicked through the source's *Interact* window.

Capturing a browser window instead? Window capture has no transparency: add `&bg=00ff00` (any 3, 4, 6 or 8-digit hex colour) for a solid background to key out with a *Chroma Key* filter. In a browser source, eight digits make a translucent backdrop instead, e.g. `&bg=000000a0`, for busy footage.

Items not yet obtained are greyed in the icon alone, as in the app, so they stay legible over bright and dark scenes alike.

## Development

Requires Node ≥ 22 and pnpm (the exact version is pinned in `package.json` and selected automatically).

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

| Command | |
|---|---|
| `pnpm dev` | development server |
| `pnpm build` | production build |
| `pnpm preview` | serve the production build |
| `pnpm typecheck` | type-check every workspace |
| `pnpm test` | run the unit tests (app, engine and game packs) |
| `pnpm test:e2e` | browser tests: Playwright + axe on the production build |
| `pnpm test:coverage:show` | tests with a coverage table |
| `pnpm lint` / `pnpm lint:fix` | Biome check / autofix |

## How it fits together

The repository is a pnpm workspace:

```
apps/web/          the tracker web app (Vite + React), deployed to GitHub Pages
packages/engine/   @alltp/engine: a game-agnostic logic engine (rule language, three-valued solver)
packs/alttpr/      @alltp/pack-alttpr: ALttPR's items, and the official tests its v31 rules are held to
```

In the app, the whole state lives in one Zustand store, `apps/web/src/stores/gameStore.ts`, persisted to localStorage. Everything else reads from it.

```
apps/web/src/
├── data/         game data and rules
│   ├── logic.ts     types + reachability predicates (canReachDarkWorld, …)
│   ├── chests.ts    the 64 overworld chests
│   ├── dungeons.ts  the 10 dungeons
│   ├── items.ts     item ranges, starting values and labels
│   └── presets.ts   run types
├── stores/       the Zustand store
├── components/   tracker/ (item grid), map/ (markers), ui/ (chrome)
├── hooks/        keyboard navigation
├── styles/       CSS modules, all imported by styles/index.css
└── utils/        asset paths and item styling
```

Each chest and dungeon carries its own accessibility predicate, so adding a location means adding one entry to a table rather than touching the components.

`apps/web/src/data/logic.characterization.spec.ts` snapshots what that logic answers across a range of item states. It exists to catch accidental rule changes during refactors: if it moves, the game logic moved with it.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the commit and release conventions.

## Licence

MIT — see [LICENSE](LICENSE).
