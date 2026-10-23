---
paths:
  - "packages/engine/**"
---

# The logic engine (`packages/engine`)

`README.md` in the package is the design document: grammar, Tri semantics, solver, open questions. Keep it in step with the code.

- **No runtime dependencies, no DOM, no React.** It runs in a browser, a worker or Node; its tests run in Node (`environment: "node"`). `src/index.ts` is its only public surface.
- **Monotone by construction.** The rule language has no negation of items, `<` or `==` (`!` applies to settings only, folded to a constant at compile time): getting an item never lowers a result, and the single-pass solver relies on it. Anything non-monotone (a mode, a setting, knowledge such as a medallion) is resolved before solving — at compile time or in the pack's `toState` — never inside a requirement.
- **Errors at load, never at solve.** `loadRules` / `compileWorld` reject unknown names, cycles, duplicates and parse errors with a `DefinitionError` / `ParseError` that says where. `solve` cannot fail on data a pack shipped.
- **Two evaluators, one meaning.** `evaluate()` is the readable reference; `compile.ts` is the fast path. A property test holds them equal — change both or neither.
- **Tests:** explicit tables for the semantics, fast-check properties for the laws (monotonicity, round trips, solver vs the literal fixpoint), and a check that each new property can fail (break the code once, see it go red). The solver keeps its 5 ms budget test.
