# Contributing

Bug reports and pull requests are welcome. For a larger change, open an issue first so we can
agree on the approach before you spend time on it.

## Build and test

[docs/development.md](docs/development.md) covers the setup and the layout of the repository.

```bash
pnpm install
pnpm dev               # http://localhost:5173
pnpm lint              # Biome
pnpm typecheck
pnpm test:coverage     # unit tests, with the coverage floors CI enforces
pnpm build
pnpm test:e2e          # Playwright and axe on the production build
```

A pull request must pass all of these in CI, plus commit-message validation and CodeQL. A
pull request that only changes Markdown runs the commit-message validation alone.

## Proposing a change

Branch off `master`, keep each commit to one change, and open a pull request. New behaviour
needs a test, and a test must be able to fail: assert the value you expect, not that the
result is one of the possible values. A visible change is checked in a real browser, at
phone and desktop widths.

## Conventions

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/), checked by
  commitlint in a `commit-msg` hook. Types: `feat`, `fix`, `docs`, `style`, `refactor`,
  `perf`, `test`, `build`, `ci`, `chore`, `revert`. The scope is the workspace: `web`,
  `desktop`, `engine`, `autotrack`, `alttpr`, `sm`, `smz3`. Lines of the body stay under
  100 characters. Example: `fix(desktop): escape % in the desktop file's Exec`.
- **Formatting and lint** are [Biome](https://biomejs.dev/)'s. A `pre-commit` hook runs it on
  the staged files.
- **Imports.** In the app, import through the `@/` alias (`apps/web/src`) and from the file
  itself: there are no barrel `index.ts` files. A package exposes one `src/index.ts`.
- **Accessibility.** Interactive elements are real `<button>`s or links with an accessible
  name, and a state is never shown by colour alone.
- **Saved runs.** A change to the shape of a saved run bumps that game's save version and
  keeps existing saves loading (for A Link to the Past, a step in `migrate`,
  `apps/web/src/games/alttpr/stores/persistence.ts`).

## Game rules

Rules come from each randomizer's own source, never from memory or a wiki:

- **ALttPR**: [sporchia/alttp_vt_randomizer](https://github.com/sporchia/alttp_vt_randomizer).
  `packs/alttpr/upstream.json` pins the commit and maps each upstream file to the module that
  ports it. The official tests are imported as fixtures (`pnpm --filter @alltp/pack-alttpr
  import-upstream <checkout>`), and a weekly workflow opens a `logic-drift` issue when the
  pinned files change upstream.
- **SMZ3**: [tewtal/SMZ3Randomizer](https://github.com/tewtal/SMZ3Randomizer). Its logic
  tests are imported as fixtures too (`pnpm --filter @alltp/pack-smz3 import-upstream`).
- **Super Metroid**: items, objectives and memory addresses read from
  [Map Rando's source](https://github.com/blkerby/MapRandomizer).

A rule change cites the upstream file and commit it was read from.
`apps/web/src/games/alttpr/logic/alttpr.snapshot.spec.ts` records what the map shows across a
range of item states: if a refactor moves it, the refactor changed a rule. Never update it
just to make the suite pass.

## Releases

[release-please](https://github.com/googleapis/release-please) keeps a release pull request
open on `master` and derives the version and changelog from the commit types: `feat` is a
minor release, a breaking change a major one, and `fix`, `perf`, `revert`, `docs` and
`refactor` a patch. Merging it tags the release, publishes it and builds the desktop
installers. The site is deployed on every merge to `master`. Details: [docs/ci.md](docs/ci.md).
