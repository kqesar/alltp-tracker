# Development

How the repository is laid out and how to work on it. [CONTRIBUTING.md](../CONTRIBUTING.md)
has the rules for a change; this document is the map.

## Setup

You need [pnpm](https://pnpm.io/installation). Any recent version works: it switches to the
exact version `package.json` pins, and `pnpm install` downloads the Node version the project
pins (`devEngines.runtime`), which every script then runs with.

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

| Command | |
|---|---|
| `pnpm dev` | development server |
| `pnpm build` | type-check, then the production build of `apps/web` |
| `pnpm preview` | serve the production build |
| `pnpm typecheck` | type-check every workspace |
| `pnpm lint` / `pnpm lint:fix` | Biome check / autofix |
| `pnpm check:docs` | every Markdown link, anchor and quoted repository path resolves (CI: `docs.yml`) |
| `pnpm test` | unit tests (app, engine, autotracking and game packs) |
| `pnpm test:coverage` | unit tests with the coverage floors CI enforces |
| `pnpm test:coverage:show` | the same, with a coverage table |
| `pnpm test:e2e` | browser tests: Playwright and axe on the production build, at 390, 820, 1440 and 1920 px |
| `pnpm --filter @alltp/web fetch-voice-model` | the speech model voice commands use (40 MB, not in git; the voice browser tests need it) |
| `pnpm --filter @alltp/desktop dev` | the desktop app on the development server (Rust ≥ 1.90 and [Tauri's system libraries](https://v2.tauri.app/start/prerequisites/)) |
| `pnpm --filter @alltp/desktop build` | the desktop app's installers for this system |

## Layout

A pnpm workspace. Dependencies point one way: `apps/web` uses the packs, the packs use
`packages/*`, and the packages import nothing of the app or the packs.

```
apps/web/            the tracker (Vite + React), deployed to GitHub Pages
apps/desktop/        the desktop app (Tauri 2): apps/web in a native window
packages/engine/     @alltp/engine: a game-agnostic logic engine (rule language, three-valued solver)
packages/autotrack/  @alltp/autotrack: the link to SNI / QUsb2Snes, or to RetroArch in the app;
                     its diagnostics and Race Mode
packs/alttpr/        @alltp/pack-alttpr: ALttPR's items and v31 rules, held to the official tests
packs/sm/            @alltp/pack-sm: Super Metroid as Map Rando plays it: items, objectives, memory map
packs/smz3/          @alltp/pack-smz3: SMZ3 as samus.link generates it: both games' logic, held to its tests
```

Each package and pack has a README that is its design document.

The app loads one game's module at a time (`apps/web/src/games/registry.ts`), each a chunk of
its own, so a player never downloads another game's board. A game's run lives in its own
Zustand store, saved to `localStorage` under its own key: A Link to the Past's in
`games/alttpr/stores/gameStore.ts`, Super Metroid's in `games/sm/store.ts`, SMZ3's in
`games/smz3/store.ts`.

```
apps/web/src/
├── main.tsx      loads the module of the game this device tracks
├── games/
│   ├── registry.ts  the games, the device's choice, loading a game's module
│   ├── alttpr/      A Link to the Past: data/, logic/ (the run read by the alttpr pack),
│   │                stores/, components/ (grid, map, Checks, Run, go mode),
│   │                autotrack/, voice/, hooks/
│   ├── sm/          Super Metroid (Map Rando): grid, objectives, store, autotrack/
│   └── smz3/        SMZ3 (samus.link): grid, keys, maps of Hyrule and Zebes, logic, store
├── autotrack/    shared autotracking words (status, guide), the cross-tab Web Lock
├── components/   ui/ (dialogs, toolbar menu, game picker, header, Share dialog), autotrack/
│                 (setup guide, status dot, lazy dialog loader), map/ (the map legend)
├── desktop/      the desktop app's page side (RetroArch transport, updates, save dialog,
│                 application menu), behind isDesktopApp
├── share/        the run link: codec, packed form, the Share action (docs/share.md)
├── stores/       the update notice's store, the tooltip store
├── hooks/        keyboard navigation, the toolbar's fit, tooltips, a shared clock
├── styles/       shared CSS, all imported by styles/index.css
└── utils/        the stream view's address and fit, keyboard and platform helpers
```

The rules belong to the packs, ported from each randomizer's source and held to its official
tests. The app keeps no rule of its own.

`apps/web/src/games/alttpr/logic/alttpr.snapshot.spec.ts` records what the map shows across a
range of item states. It exists to catch an accidental rule change during a refactor: if it
moves, the game logic moved with it.

## Service worker

The service worker (`apps/web/sw/sw.ts`) exists in production builds only, so `pnpm dev` runs
without it and `pnpm preview` with it. A small Vite plugin (`apps/web/sw/plugin.ts`) writes
into it every file of the build with a hash of its content, in groups: the shell (the page,
the shared code, the icons) and, for each game, the files only that game needs (what its
module reaches from `games/registry.ts`, plus the public art its `games` entry in
`vite.config.ts` claims). A file no game claims is shell, so a missed one is downloaded for
everyone, never missing. The page marks the game it runs in the worker's cache (`holdGame`)
before registering, so the install fetches the shell and the games marked; switching to a new
game marks it and asks the running worker to fetch its files (`sync-games`).

Any change to a shipped file changes the worker, which is how browsers find a new version, so
there is no version number to bump, and an update refreshes the files of every game held. The page itself comes from the network first (3 s at most, then the cached copy),
everything else from the cache. The plugin also gives each build an id, in the worker and in
`index.html`: a page already running the version a new worker holds lets it take over without
asking.

## Generated images

- **Icons.** The favicon, the install icons and the desktop app's menu PNGs are drawn from one
  pixel-art folded map with a check mark, written in `apps/web/scripts/pwa-icons.mjs`:
  `pnpm --filter @alltp/web pwa-icons` (`-- --check` verifies them). The desktop `.icns` and
  `.ico` come from `pnpm --filter @alltp/desktop tauri icon apps/web/public/icons/icon-512.png`.
- **Link previews.** `apps/web/scripts/social-cards.mjs`, see [seo.md](seo.md).
- **README screenshots.** `apps/web/scripts/readme-screenshots.mjs` takes
  `docs/screenshots/*.webp` from the production build. Run it again when a board's look
  changes:

  ```sh
  pnpm --filter @alltp/web build && pnpm --filter @alltp/web preview --port 4173 &
  pnpm --filter @alltp/web exec node scripts/readme-screenshots.mjs http://localhost:4173/alltp-tracker/
  ```
