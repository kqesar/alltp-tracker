# Contributing

See the [README](README.md) for setup and the layout of the codebase.

## Workflow

Branch off `master`, keep commits focused, open a pull request. Every PR runs lint, type-checking, the unit tests with coverage, the browser tests (Playwright + axe, in a parallel job), commit-message validation and CodeQL; all of them must pass.

```bash
git switch -c feat/your-feature
# ... work ...
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
pnpm commit          # commitizen, or write the message yourself
git push -u origin feat/your-feature
```

## Commit messages

[Conventional Commits](https://conventionalcommits.org/), enforced by commitlint through a husky `commit-msg` hook:

```
<type>(<optional scope>): <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

```
feat(map): add chest markers with click interaction
fix(tracker): correct item state cycling bug
```

A `pre-commit` hook runs `lint-staged`, which applies Biome to the staged files, so formatting is never something to think about.

## Code conventions

- Functional components, typed props, no `index.ts` barrel files — import from the file path.
- In the app, use the `@/` alias (`apps/web/src`) rather than relative paths. A package exposes one `src/index.ts`.
- Comments in English, and only where the code cannot say it itself.
- Layout is CSS Grid; empty grid cells render a spacer, never `null`, or the columns drift.
- Interactive elements are real `<button>`s with an `aria-label`. A native button already handles Enter and Space, so it needs no key handler.
- Game state belongs in `apps/web/src/stores/gameStore.ts`. A change to what is saved bumps `PERSIST_VERSION` and adds a step to `migrate` in `apps/web/src/stores/persistence.ts`, so existing saves carry over.

## Tests

New behaviour needs a test, and a test should be able to fail: assert the value you expect, not that the result is one of the possible values.

If you touch `apps/web/src/data/`, run the tests: `logic.characterization.spec.ts` encodes what the rules answer across 15 item states. An unchanged result is the evidence that a refactor left the game rules alone — if it moves and you did not intend a rule change, the refactor is wrong. Never update it just to make the suite pass.

```bash
pnpm test
pnpm test:coverage:show
```

## Releases

Pushing to `master` triggers an automatic patch release; minor and major releases go through the *Release and Changelog* workflow dispatch. The changelog is generated from the commit messages, which is why the conventions above matter. `pnpm release:dry` shows what a release would produce.
