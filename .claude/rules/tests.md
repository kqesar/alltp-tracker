---
paths:
  - "src/**/*.spec.ts"
  - "src/**/*.spec.tsx"
  - "src/test-setup.ts"
  - "vitest.config.ts"
---

# Tests

- **Assertions must be able to fail.** This codebase once asserted `expect([all four states]).toContain(result)` and had "keyboard navigation" specs that pressed no keys. Never guard an assertion with `if (found.length > 0)`: a query that finds nothing must fail. When fixing a bug, check the new test fails without the fix.
- **Locate with `data-testid`** (`getByTestId`, `getAllByTestId(/^chest-marker-/)`), not CSS classes, inline styles or positions in `getAllByRole("button")`. Ids are kebab-case `<kind>-<id>`: `item-hookshot`, `chest-marker-3`, `boss-marker-0`, `chest-overlay-0`, `medallion-overlay-8`, `import-file`. Then assert accessibility on the element found (`toHaveAccessibleName`, role) so the test still covers what a screen reader hears.
- **Reset the store** in `beforeEach` with `useGameStore.setState(useGameStore.getInitialState(), true)` (and `localStorage.clear()` when persistence matters). Two specs mock `@/stores/gameStore` entirely with a selector-calling `vi.fn()`; keep their fake state in step with the store's fields.
- jsdom has `<dialog>` but not `showModal()` / `close()`; `src/test-setup.ts` stubs them by toggling `open`. Escape is simulated by dispatching a cancelable `cancel` event on the dialog.
- `src/data/logic.characterization.spec.ts` is a refactor guard (see `.claude/rules/data.md`): never update it to make the suite pass.
- Coverage thresholds in `vitest.config.ts` are floors just below current coverage; raise them when coverage rises.
