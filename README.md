# A Link to the Past Tracker

![Build Status](https://img.shields.io/github/actions/workflow/status/kqesar/alltp-tracker/deploy-pages.yml?branch=master&label=build)
![Version](https://img.shields.io/github/v/release/kqesar/alltp-tracker?label=version)
![License](https://img.shields.io/github/license/kqesar/alltp-tracker?label=license)

An item and progress tracker for **The Legend of Zelda: A Link to the Past** randomizer runs. It keeps track of the items you have found and works out, in real time, which chests you can reach and which dungeons you can clear.

**→ [kqesar.github.io/alltp-tracker](https://kqesar.github.io/alltp-tracker/)**

Originally forked from [TestRunnerSRL/lttp-tracker](https://github.com/TestRunnerSRL/lttp-tracker) and since rewritten in React 19 and TypeScript. The game logic remains inspired by the original.

## Using it

**Items** — click a cell to cycle its state. Progressive items step through their levels (sword 0→4, gloves 0→2) and wrap back to the start; the rest toggle on and off. Dimmed means not obtained.

**Map** — every marker is colour-coded against the items you hold:

| | |
|---|---|
| 🟩 green | reachable now |
| 🟨 yellow | reachable, but the logic is not certain |
| 🟥 red | out of logic |
| ⬛ grey | already done |

Click a chest to mark it opened, or a boss to mark it beaten. Hover anything to see its requirements. **Stacked map** puts the Dark World under the Light World instead of beside it, which suits a tall or narrow screen; the choice is remembered.

**Boss overlays** — each boss cell carries three corners: the medallion requirement (top right, Misery Mire and Turtle Rock only), the remaining chest count (bottom left) and the reward, crystal or pendant (bottom right).

**Keyboard** — arrow keys move around the grid and wrap at the edges, Tab walks through every control, Space and Enter activate the focused cell.

**Presets** — pick a run type to set the rules; keysanity adds the big and small key cells to the grid. Progress is saved to the browser automatically, and can be exported or imported as JSON.

## Development

Requires Node ≥ 22 and pnpm ≥ 10.

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

| Command | |
|---|---|
| `pnpm dev` | development server |
| `pnpm build` | production build |
| `pnpm preview` | serve the production build |
| `pnpm test` | run the tests |
| `pnpm test:coverage:show` | tests with a coverage table |
| `pnpm lint` / `pnpm lint:fix` | Biome check / autofix |

## How it fits together

The whole application state lives in one Zustand store, `src/stores/gameStore.ts`, persisted to localStorage. Everything else reads from it.

```
src/
├── data/         game data and rules
│   ├── logic.ts     types + reachability predicates (canReachDarkWorld, …)
│   ├── chests.ts    the 65 overworld chests
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

`src/data/logic.characterization.spec.ts` snapshots what that logic answers across a range of item states. It exists to catch accidental rule changes during refactors: if it moves, the game logic moved with it.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the commit and release conventions.

## Licence

MIT — see [LICENSE](LICENSE).
