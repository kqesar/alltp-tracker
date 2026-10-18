# A Link to the Past Tracker

![Build Status](https://img.shields.io/github/actions/workflow/status/kqesar/alltp-tracker/ci.yml?branch=master&label=build)
![Version](https://img.shields.io/github/v/release/kqesar/alltp-tracker?label=version)
![License](https://img.shields.io/github/license/kqesar/alltp-tracker?label=license)

An item and progress tracker for **The Legend of Zelda: A Link to the Past** randomizer runs. It keeps track of the items you have found and works out, in real time, which chests you can reach and which dungeons you can clear.

**→ [kqesar.github.io/alltp-tracker](https://kqesar.github.io/alltp-tracker/)**

Originally forked from [TestRunnerSRL/lttp-tracker](https://github.com/TestRunnerSRL/lttp-tracker) and since rewritten in React 19 and TypeScript. The game logic remains inspired by the original.

## Using it

**Items** — click a cell to cycle its state, right-click to step it back. Progressive items step through their levels (sword 0→4, gloves 0→2) and wrap round; the rest toggle on and off. Greyed means not obtained, or for a boss not yet beaten. **Undo / Redo** (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) take back any change, a new game included.

**Map** — every marker is colour-coded against the items you hold:

| | |
|---|---|
| 🟩 green | reachable now |
| 🟨 yellow | maybe reachable (a dark room, an unknown medallion, a key that may be anywhere), or only some of a marker's checks |
| 🟦 light blue | seen but not reachable yet (the Book reads the Pedestal, a ledge item shows from below) |
| 🟥 red | out of logic |
| ⬛ grey | already done |

Each state also has a glyph (✓, ?, an eye, ✕), so colour is never the only cue. Click a marker to check its locations (a cave's chests together), or a boss to mark it beaten. Hover or focus a marker to list its checks and their state in a tooltip, and a dungeon's items left; a check not in logic says what it is missing ("Missing: Hammer, or Moon Pearl + Power Glove") and why one is only maybe reachable. On a touch screen, press and hold. **Map: Auto / Side / Stack** sets how the two worlds sit: Auto keeps them side by side while there is room and stacks them on a narrow screen; the choice is remembered on this device.

**Checks** — the **Checks** tab beside **Map** lists every check of the map as a list, by zone, in the same states. It shows what is available or maybe at first; the filters (with their counts), a zone and a search narrow it. Tick a check to mark it done, as a click on its marker does; **Why?** says what a check not available is missing. A dungeon whose counter reaches 0 shows its checks done. The tab you leave open is remembered on this device.

**Run** — the **Run** tab beside **Checks** follows the run as it goes:
- **At a glance**: the run timer's time, the checks done and the bosses beaten.
- **Splits**: each boss in the order it fell, with the time since the last, as a speedrun timer splits a run.
- **Timeline**: every item found and location checked, newest first, timed by the run timer. Whatever you or autotracking marks is timed. Undo takes a time away with its mark, and Redo brings the same time back.
- **From the game**: outside races, while autotracking reads your game, the counts its ROM keeps, as its end credits list them: when the first sword, the boots, the flute and the mirror were found, deaths, save and quits, menu and lag time, and more.

The timeline is saved with the run, in exports too.

**Go mode** — beside the tabs, ☆ **Go mode: not yet**, ★? **possible** or ★ **in logic** tells whether every step to the run's goal (Ganon, fast Ganon or the Pedestal) is in logic; click it to see what is missing. Goals that end with everything (all dungeons, triforce hunt) have none.

**Run timer** — beside go mode, the run's time: click it to start, pause, resume or reset it. While autotracking reads your game, it starts as you leave the file select for the game and stops at the goal on its own (**Start and stop with the game**, on by default; connecting mid-run starts nothing). It keeps counting through a reload, and outside races it also shows the game's own play time, counted by the ROM frame by frame.

**Mystery** — the Mystery run type starts with its settings hidden: the goal, the swords, the crystals for Ganon's Tower and for Ganon, the item placement, pool and functionality, and the accessibility. Set each one in the run type dialog's summary as you learn it (a sign, Uncle's gift, the first key found outside its dungeon…), your progress kept, and pick "? Unknown" to hide one again. Autotracking knows a Mystery race seed by its file on alttpr.com: a fresh board switches to Mystery, in the world it holds.
- **Until a setting is known**, the map is cautious. A check that depends on it is *maybe*, never *available*, and anything shown available or out of logic is so whatever it turns out to be. The go mode says "goal unknown" until the goal is set.
- **The world and the dungeon items** are not hidden: you see the world on the first screen, and the dungeon items count each dungeon's items, so the run assumes them until you set them. A change of dungeon items keeps each counter's items found.
- **With autotracking outside races**, the seed's settings are set on their own as it is read. A race seed's are not read, so they stay yours to find.

**Retro** — the bow shoots rupees once you buy an arrow, and a small key opens any dungeon's door. The grid's last row holds an **Arrow shop** and a **Key shop**: mark each when you find a shop that sells it (voice: "tracker arrow shop", "tracker key shop"). Until then the bow shoots only with the silver arrows, and a door behind a small key is *maybe*: the tracker cannot tell which dungeon a key you found was meant for. Once a key shop is found, every key door is in logic, as the randomizer has it.

**Crosskeys: the entrance assistant** — a run with shuffled entrances shows every door and hole the shuffle mixes on the map: an empty dashed ring while you do not know where it leads, filled once you note it, with a glyph for the kind of place (D a dungeon, ↔ a cave with several doors, • a shop or house, ▼ where a hole drops). Click one, search, and pick where it leads; a place noted elsewhere says so, and picking it moves it. The **Entrances** tab lists them all by world, with how many are noted. They are saved with the run and undone like anything else. The tracker does not model the shuffle's logic yet: every check of such a run shows as *maybe*, and a note over the map says why.

**Boss overlays** — each boss cell carries three corner buttons: the medallion requirement (top right, Misery Mire and Turtle Rock only), the remaining chest count (bottom left) and the reward, crystal or pendant (bottom right). Click steps them forward, right-click back.

**Keyboard** — the item grid is a single Tab stop: arrow keys move inside it (through a boss's overlays too) and wrap, Home / End jump to the ends of a row, Ctrl+Home / End to the ends of the grid. Space and Enter step the focused control forward, "-" steps it back. Every map marker is a button Tab can reach; "Skip to map" and "Skip to checks" jump to either view.

**Presets** — pick a run type to set the rules. When a run's dungeon items leave their dungeons (alttpr.com's MC, MCS and Full Shuffle, the last one keysanity), the grid shows each dungeon's map and compass beside its keys, and its counter counts the items those leave room for. Or start from a seed: paste its alttpr.com link (or hash) under **Start from a seed**, and the tracker reads its settings (world, goal, swords, crystals, dungeon items, item placement, item pool and functionality, accessibility) from alttpr.com and offers the run type that holds them. Basic placement, a hard item pool or functionality change what is in logic as the randomizer has it: Ganon wants the silver arrows, no mirror shield, a bottle refills half the magic. The crystals, item placement, pool, functionality and accessibility change in the run type dialog's summary at any time, the run kept (one Undo takes a change back). Progress is saved to the browser automatically, and can be exported or imported as JSON.

## Autotracking

The tracker can read your game as you play, through [SNI](https://github.com/alttpo/sni/releases/latest) (or QUsb2Snes) running on your computer: RetroArch with the bsnes-mercury core, an FX Pak Pro, BizHawk or an NWA emulator, on Windows, macOS or Linux. The toolbar's **Autotracking** button opens the setup guide for your system, its steps ticked as the connection gets through them, the failing one opened with what to do. Its dot shows the status at a glance; connecting, losing SNI and reconnecting never interrupt the run with a dialog. Once connected, the tracker connects again each time it opens, on that device, until you disconnect. With OBS, autotrack in the dock: the stream view follows the dock and never connects to SNI itself. Only one tab of the tracker reads the game: open a second and it waits, following the board, and takes over when the first closes.

**The board follows the game.** As you play, the tracker marks what the game shows: items, bosses beaten, checked locations, the chests each dungeon has left, a dungeon's prize once only one fits, and with small keys outside their dungeons (MCS and Full Shuffle) the small keys found. It changes a value only when the game does, and never undoes a mark you set beyond the game, such as a prize you saw on the map before beating its boss. **Sync from game**, in the Autotracking dialog, sets the board to the game, clearing such marks; Undo takes it back. What the game marks is never a step of Undo: undoing your own change keeps the game's. While small keys stay in their dungeons, a dungeon's counter stays open while a chest may have held one of its small keys, which memory cannot tell from an item. **What I read** lists everything the tracker read, to compare with your game, and what it read that the board has no cell for (magic, heart pieces…).

**The seed sets the run type.** The tracker reads the seed's settings from its ROM (the world, swords, goal, crystals, which dungeon items leave their dungeons), and from the file alttpr.com keeps for the seed what no ROM states (item placement, item pool and functionality, accessibility, and whether the entrances are shuffled, as in Crosskeys), and holds them against the board's run type, once the file has come or could not. On a board with nothing marked yet it switches to the seed's on its own, and says so. With a run on the board it asks instead: **Switch** starts the seed's run type with the game laid on it (one Undo brings your board back), **Keep mine** keeps yours for that seed, on later visits too. The Autotracking dialog says what the seed's settings mean for the run type, and **What I read** lists them. A seed no run type here holds (the Ganonhunt goal, only some dungeon items shuffled) is said, never rounded.

Races: on a race seed, or when its race flag cannot be read, the tracker reads only what [the race-legal autotracking specification](https://link.alttpr.com/autotracking) permits, and shows a **race-legal** badge. Pendants and crystals, the chests inside dungeons and bottles then stay yours to mark, Sync from game included. A race seed's settings lie outside what races permit, so the tracker reads only the seed's name and logic from the ROM, then asks alttpr.com for the seed's settings by that name, as **Start from a seed** does: they lead to the run type as a ROM's do, and What I read says where they came from. The file alttpr.com keeps for a seed holds its patch too: the tracker downloads it with the rest and reads only the settings. Offline, or for a seed alttpr.com does not have, the run type stays yours to choose.

Safari, and every browser on iOS, cannot reach SNI from this secure site (it counts `ws://localhost` as mixed content): use Firefox, Chrome or Edge. The desktop app will cover Safari. The first time, Firefox and Chrome ask whether the site may reach apps on your device: allow it. SNI listening on another port than 23074? Add `?bridge=<port>` to the tracker's address.

## Voice commands

Mark what you find without leaving the game: say **"tracker"**, then the find. For example, "tracker hook shot", "tracker master sword", "tracker eastern boss", "tracker mire ether", "tracker eastern crystal" or "tracker undo". Open **Voice** beside the run timer and choose **Start listening**.

- **What a command does.** It says what you found, not a click:
  - saying the hookshot again keeps it;
  - "sword" is one level up and never wraps round to none;
  - "eastern chest" takes one item from the count.
  - Each command is one step of Undo, as a click is. The Voice button shows it for a moment, and a screen reader hears it.
- **Talking is safe.** Without "tracker" first, nothing is marked, so talking about an item on stream changes nothing.
- **Private.** Speech is recognized in your browser, by [Vosk](https://alphacephei.com/vosk/), and no sound leaves your computer.
  - The first start downloads the speech model, 40 MB, kept for next time (about 60 MB of the browser's storage; **Remove the speech model** in the dialog frees it).
  - Nothing is downloaded until you turn voice commands on.
  - While listening, the recognizer uses about 15 % of one CPU core.
- **Words the model knows.** It is English only, and its dictionary lacks a few of the game's names, so they are said as words it has. The dialog's **What to say** lists every command:
  - "bom boss" for Bombos (saying "bombos" works);
  - "samaria" for Somaria;
  - "burner" or "blue cane" for Byrna;
  - "aga" for Agahnim;
  - "gannon tower" or "g t" for Ganon's Tower.
- **Where it works.** In Firefox, Chrome and Edge, in a browser tab: an OBS dock has no microphone. Once on, the tracker listens again each time it opens, on that device, until you stop it. Only one tab listens at a time.

## Streaming with OBS

The stream view, [`?view=obs`](https://kqesar.github.io/alltp-tracker/?view=obs), is the item grid alone on a transparent background. It fills its source, centred, at a size that keeps the pixel art sharp, and follows the run live. The toolbar's **Stream view** button copies its address. In OBS 31 or newer:

1. **Track in a dock**: under *Docks → Custom Browser Docks*, add `https://kqesar.github.io/alltp-tracker/` and track your run there.
2. **Show the grid**: add a *Browser Source* with the stream view's address. At 512 × 448 (512 × 512 with the key cells shown) every icon pixel is drawn whole; double it for a larger grid, or pick any size. Set the size in the source's properties: dragging its handles resamples the image and blurs it.
3. **Check the sync on your first run**: the dock and the source share OBS's browser storage, so the source is expected to follow every click in the dock. Items can also be clicked through the source's *Interact* window.

**Show the run timer**: tick *Show the run timer under the grid* in the **Stream view** dialog, and the address ends in `&timer=1`: the run timer sits under the grid, drawn in the chest counters' pixel font, white while it runs, grey while paused, gold once the goal stopped it. It takes a row of its own, so the sizes become 512 × 512 (512 × 576 with the key cells).

Capturing a browser window instead? Window capture has no transparency: add `&bg=00ff00` (any 3, 4, 6 or 8-digit hex colour) for a solid background to key out with a *Chroma Key* filter. In a browser source, eight digits make a translucent backdrop instead, e.g. `&bg=000000a0`, for busy footage.

Items not yet obtained are greyed in the icon alone, as in the app, so they stay legible over bright and dark scenes alike. Nobody clicks in a browser source, so the stream view takes a new version of the tracker on its own as soon as it is ready.

## Offline and install

After its first visit, the tracker loads and works with no network at all: the browser keeps every file it needs (the code, the item art, the map), and the run stays saved on the device as always. To give it a window of its own, install it: the install button in the address bar of Chrome or Edge, or **Share → Add to Home Screen** in Safari on iOS.

Reloading the page (F5) while online always shows the latest version. A tracker left open checks for one every hour, when its tab comes back into view and when the network returns, and never reloads in the middle of a run: a notice, "A new version is available", waits for you. **Reload** switches to it and keeps your progress; dismissing it leaves the new version for the next time you open the tracker. A copy started offline is offered the new version too, once the browser has it.

For development: the service worker (`apps/web/sw/sw.ts`) exists in production builds only, so `pnpm dev` runs without it and `pnpm preview` with it. A small Vite plugin (`apps/web/sw/plugin.ts`) writes into it every file of the build with a hash of its content; any change to a shipped file changes the worker, which is how browsers find a new version, so there is no version number to bump. The page itself comes from the network first (3 s at most, then the cached copy), everything else from the cache. The plugin also gives each build an id, in the worker and in `index.html`: a page already running the version a new worker holds lets it take over without asking. The favicon and the install icons are drawn from one 16 px pixel-art Triforce, written in `apps/web/scripts/pwa-icons.mjs`, by `pnpm --filter @alltp/web pwa-icons` (`-- --check` verifies them).

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
| `pnpm --filter @alltp/web fetch-voice-model` | fetch the speech model voice commands use (40 MB, not in git; the voice browser tests need it) |
| `pnpm test:coverage:show` | tests with a coverage table |
| `pnpm lint` / `pnpm lint:fix` | Biome check / autofix |

## How it fits together

The repository is a pnpm workspace:

```
apps/web/          the tracker web app (Vite + React), deployed to GitHub Pages
packages/engine/   @alltp/engine: a game-agnostic logic engine (rule language, three-valued solver)
packages/autotrack/ @alltp/autotrack: the autotracking link to SNI / QUsb2Snes, its diagnostics and Race Mode
packs/alttpr/      @alltp/pack-alttpr: ALttPR's items, and the official tests its v31 rules are held to
```

In the app, the whole state lives in one Zustand store, `apps/web/src/stores/gameStore.ts`, persisted to localStorage. Everything else reads from it.

```
apps/web/src/
├── data/         game data
│   ├── items.ts     item ranges, starting values and labels
│   ├── keymap.ts    keyboard shortcuts
│   └── presets.ts   run types
├── logic/        the run read by the alltpr pack
│   ├── settings.ts  run types as the pack's settings, dungeon counters
│   ├── solution.ts  the run solved, and the hooks the map reads it by
│   ├── checks.ts    the Checks list: the map's checks by zone, their states
│   ├── missing.ts   what each check and the go mode are missing, at idle
│   ├── needs.ts     the engine's blockers in the tracker's words and icons
│   ├── timer.ts     the run timer, and what the game's progress does to it
│   ├── timeline.ts  when each find of the run happened
│   └── runLog.ts    the Run tab's timeline and splits
├── stores/       the Zustand store
├── components/   tracker/ (item grid), map/ (markers, Checks, Run, go mode, run timer), ui/ (chrome)
├── hooks/        keyboard navigation
├── styles/       CSS modules, all imported by styles/index.css
└── utils/        asset paths and item styling
```

The rules are the alltpr pack's, ported from the randomizer's source and held to its official tests; the map draws the pack's markers. The app keeps no rule of its own.

`apps/web/src/logic/alttpr.snapshot.spec.ts` snapshots what the map shows across a range of item states. It exists to catch accidental rule changes during refactors: if it moves, the game logic moved with it.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the commit and release conventions.

## Licence

MIT — see [LICENSE](LICENSE).
