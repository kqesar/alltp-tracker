# @alltp/engine

A game-agnostic logic engine for randomizer trackers: a small requirement
language, three-valued (Kleene) evaluation, and a world-graph solver that says,
for every location, whether it is in logic (`yes`), possible (`maybe`) or out
of logic (`no`) for the items the player holds.

It is the prototype Phase 2 builds the tracker on: ALttPR first, then Super
Metroid / SMZ3, Zelda 1 and Ocarina of Time. The current tracker logic
(`src/data/logic.ts`, `chests.ts`, `dungeons.ts`) is hand-written predicates.
Those can't express modes (inverted, keysanity key counts, entrance shuffle) or
other games. Here a game is data: a graph of regions and requirement strings.

- TypeScript, zero runtime dependencies, no React, no DOM (`lib: ["ES2022"]`,
  tests run in Node).
- Status: spike. The API will move. The public surface is `src/index.ts`.

```ts
import { compileWorld, loadRules, solve } from "@alltp/engine";

const rules = loadRules({
  groups: { crystal: ["crystal1", "crystal2" /* … */] },
  helpers: { canLiftRocks: "glove", canLightTorches: "firerod | lantern" },
});

const world = compileWorld(
  {
    regions: [
      {
        exits: [{ req: "flute | @canLiftRocks & ?lantern", to: "deathMountain" }],
        id: "lightWorld",
        locations: [{ id: "linksUncle" }, { id: "library", req: "boots" }],
      },
      { id: "deathMountain", locations: [{ id: "oldMan", req: "?lantern" }] },
    ],
    start: "lightWorld",
  },
  rules,
  { items: ["boots", "crystal1", "crystal2", "firerod", "flute", "glove", "lantern"] },
);

const solution = solve(world, { glove: 1 }); // once per click
solution.region("deathMountain"); // "maybe": the Old Man's cave is dark
solution.location("library"); // "no"
solution.locations(); // { linksUncle: "yes", library: "no", oldMan: "maybe" }
```

`examples/alttp-sample.ts` is a 9-region / 23-location slice of ALttP in this
format, and `examples/alttp-sample.spec.ts` pins where it says yes, maybe and
no. Its rules are simplified to show the format. They are **not** the
randomizer's: the real rules get ported from the randomizer's source in Phase 2.

## Design

```
requirement text ──parse──▶ AST ──loadRules / compileWorld──▶ closures ──solve(state)──▶ Solution
      (data)              (data)        (once per game/mode)        (once per click)
```

| Module | Role |
| --- | --- |
| `tri.ts` | `Tri`, the order `no < maybe < yes`, Kleene `and` / `or`, `soften` |
| `ast.ts` | The AST (`Expr`), identifier rules, `walk` |
| `parser.ts` | Recursive descent parser with lazy lexing; `ParseError` with a position |
| `printer.ts` | Canonical printing; `parse(print(ast))` gives `ast` back |
| `rules.ts` | `loadRules`: helpers and groups, reference checks, helper cycle detection |
| `evaluate.ts` | Reference semantics: a direct tree walk over a `State` |
| `compile.ts` | Compiles ASTs to closures over item/helper indices (the hot path) |
| `world.ts` | `World` types; `compileWorld` validates and lays the graph out as arrays |
| `solve.ts` | The solver and `Solution` |

Choices that shape everything else:

- **Packs are data.** Requirements are strings, so a game pack is plain,
  serializable data. It can live in JSON, be diffed against the upstream
  randomizer, and be checked at load. Nothing in a pack is executable code.
- **No negation.** The language has no `!`, `<`, `==`. Every rule is monotone:
  getting an item never makes anything less available. The property tests check
  this, and the solver depends on it (see below).
- **Check at load, not at solve.** Unknown helpers, helper cycles, unknown
  regions, duplicate ids and parse errors are all `DefinitionError`s from
  `loadRules` / `compileWorld`. Given the game's item list, so are misspelled
  item names, which would otherwise read as "never collected". `solve` cannot
  fail on data a pack shipped.
- **Two evaluators, one semantics.** `evaluate()` is a plain tree walk, short
  enough to be the spec. The solver runs closures from `compile.ts`, where names
  are resolved to array indices once. A property test holds the two to the same
  answer on random expressions and states.

## Tri: what yes / maybe / no mean

| Value | Meaning for the player |
| --- | --- |
| `yes` | In logic with the items held. |
| `maybe` | Possible, but through something the logic can't vouch for: a dark room without a light source, an unknown medallion, a sequence break, an item that is visible but not obtainable yet. |
| `no` | Out of logic. |

The values are ordered `no < maybe < yes` and combine with strong Kleene logic:
`and` is the minimum and `or` the maximum. With the identities `and() = yes`
and `or() = no`, this is a distributive lattice: commutative, associative,
idempotent, absorptive and distributive both ways. `tri.spec.ts` checks every
law on all 27 triples. `soften` (the DSL's `?x` / `maybe(x)`) maps `no` to
`maybe` and leaves the others alone. All three operators are monotone.

## The requirement language

### Grammar

```ebnf
requirement = or_expr , EOF ;
or_expr     = and_expr , { "|" , and_expr } ;
and_expr    = unary , { "&" , unary } ;
unary       = "?" , unary
            | primary ;
primary     = "(" , or_expr , ")"
            | "maybe" , "(" , or_expr , ")"
            | "count" , "(" , name , { "," , name } , ")" , ">=" , integer
            | helper
            | "true" | "false" | "maybe"
            | name , [ ">=" , integer ] ;

helper      = "@" , identifier ;            (* no space after "@" *)
name        = identifier - reserved ;
identifier  = lower , { lower | upper | digit | "_" } ;   (* [a-z][a-zA-Z0-9_]* *)
integer     = digit , { digit } ;           (* a safe integer *)
reserved    = "true" | "false" | "maybe" | "count" ;
```

Whitespace (space, tab, CR, LF) may sit between any two tokens. `>=` is one
token, and so is `@name`.

### Precedence, tightest first

| Operator | Kind | Example | Reads as |
| --- | --- | --- | --- |
| `>= n` | part of an operand, not an operator | `sword >= 2` | one item test |
| `?x` | prefix, right-associative | `?a & b` | `(?a) & b` |
| `&` | infix, n-ary | `a & b & c` | one `and` of three |
| `\|` | infix, n-ary | `a \| b & c` | `a \| (b & c)` |

So `moonpearl & (hammer | glove >= 1 & flippers)` needs its parentheses, and
`?sword >= 2` is `?(sword >= 2)`. The printer adds parentheses there for
clarity. The parser keeps `and` / `or` flat, through parentheses too:
`a & (b & c)` parses to one `and` with three arguments.

### Meaning

`value(x)` is the state's entry for item `x`: a number as is, `true` as 1,
anything else (absent, `false`) as 0.

| Form | Value |
| --- | --- |
| `x` | `yes` if `value(x) >= 1`, else `no` |
| `x >= n` | `yes` if `value(x) >= n`, else `no` |
| `count(a, b, g) >= n` | `yes` if the sum of `value` over the distinct items named is at least `n`, else `no`. A group name expands to its members. |
| `@h` | the value of helper `h` |
| `true` / `false` / `maybe` | `yes` / `no` / `maybe` |
| `?x`, `maybe(x)` | `soften(x)`: `no` becomes `maybe` |
| `x & y` | Kleene and (minimum) |
| `x \| y` | Kleene or (maximum) |

Helpers are named requirements from the pack (`helpers: { canLiftRocks: "glove" }`).
They may use other helpers, but not in a cycle: `loadRules` rejects
`@a -> @b -> @a` and names the cycle. Groups (`groups: { crystal: [...] }`)
are item sets. They can only appear inside `count()`, and they don't nest.

### Errors

A `ParseError` carries `pos`, the 0-based UTF-16 offset of the first character
it could not accept, and the message ends with it. The lexer runs lazily behind
the parser, so the first error in reading order is the one reported:

```
parse("a & & b")      Expected an item, a "@helper", "?" or "(" but found "&" at position 4
parse("(a | b")       Expected "&", "|" or ")" but found end of input at position 6
parse("!a")           Unexpected "!" at position 0 (there is no negation: rules must stay monotone)
parse("sword < 2")    Unexpected "<" at position 6 (only ">=" comparisons exist)
parse("count(a)")     Expected ">=" after "count(...)" but found end of input at position 8
```

Inside a pack, the error is wrapped with where it happened, and the
`ParseError` is kept as `cause`:
`Exit "r" -> "s": Expected an item, … at position 8`.

## The solver

### Definition

A `World` is `{ regions, start }`. Each region has one-way `exits: { to, req }[]`
and `locations: { id, req }[]`, and a requirement defaults to `true`. For a
state, region levels are the **least fixpoint** of

```
level(start) = yes
level(r)     = max over exits u -> r of  min(level(u), req(exit))
```

and then `location = min(level(its region), req(location))`. In words: a path
is as good as its weakest exit, and a region is as good as its best path.

### Algorithm

Exit requirements depend only on the state, not on the region they leave from.
So this is a widest-path problem, and with three levels it needs no priority
queue, just one bucket (stack) per level above `no`:

1. Set `start` to `yes` and push it on the yes-stack.
2. Pop regions from the yes-stack. For each exit whose target is still below
   `yes`, evaluate the requirement. Raise the target to `min(yes, req)` and push
   it on the matching stack.
3. Once the yes-stack is empty, pop the maybe-stack the same way, skipping any
   region that was raised to `yes` after it was queued.
4. For each reachable region, evaluate its locations.

Every region is expanded exactly once, at its final level. Nothing reached
later can beat `yes`, and the maybe phase only produces `maybe`. So each exit
and location requirement runs at most once per solve. Helpers are memoized per
solve and run at most once in all. An exit whose target already has the level
it could give is skipped without being evaluated. Regions out of reach cost
nothing. Cycles need no special case: a level only goes up, and a region is
expanded only when raised.

**Cost per solve:** O(R + E + L) plus the size of the requirements actually
evaluated (each AST node at most once, helper bodies included), for R regions,
E exits and L locations. Memory is O(R + L) typed arrays. Compiling is linear in
the world's size, and each distinct requirement text is parsed and compiled
once.

The property tests check this solver against the fixpoint definition iterated
literally (Bellman-Ford style, everything re-evaluated each round) on random
worlds with cycles and self-loops.

### Why monotonicity matters

Without negation, `level` is monotone in the state, and the least fixpoint is
well defined and found by the single pass above. The tracker can also rely on
it: finding an item never turns a check from available to unavailable. A
non-monotone rule (for example "no sword", in swordless) belongs in the choice
of world and rules for a mode, not in a requirement. See the open questions.

## Performance

A seeded synthetic world at randomizer scale (`test/synthetic.ts`): 300
regions, 899 exits (a spanning tree from the start plus cycles), 1000
locations, 20 chained helpers, progressive items, softened items and crystal
counts. Every stage of the game yields all three outcomes. Measured on an Apple
M3 with Node 24.20.0:

| Case | Vitest bench, mean (p99) | Production bundle, mean (p99) |
| --- | --- | --- |
| `solve`, empty inventory | 0.094 ms (0.20) | 0.013 ms (0.015) |
| `solve`, early game (25% of items) | 0.126 ms (0.34) | 0.019 ms (0.021) |
| `solve`, mid game (50% of items) | 0.177 ms (0.19) | 0.033 ms (0.035) |
| `solve`, late game (85% of items) | 0.171 ms (0.19) | 0.032 ms (0.034) |
| `solve` + `locations()` snapshot, mid game | 0.264 ms (0.36) | n/a |
| `compileWorld` (once per game / mode) | 1.28 ms (3.59) | 1.04 ms (1.46) |

The budget is 5 ms per full solve, so it can run on every click. A mid-game
solve uses about 4% of it under Vitest and under 1% from a bundle.

- `pnpm vitest bench --run packages/engine` runs `test/solve.bench.ts` (Vitest
  5's `bench` fixture).
- The "production bundle" column comes from the same solves built with
  `vite build` and timed with `performance.now()` in plain Node. Vitest runs
  sources through its module runner, which turns every imported binding into a
  getter (it warns about this). The hot path reads imported constants on every
  node, which costs about 5×. So the Vitest column is an upper bound.
- `test/performance.spec.ts` runs with `pnpm test`. It fails if the average of
  2000 solves reaches 5 ms, after checking the world's size and its outcome mix,
  so it can't pass by timing a trivial solve.

## Tests

`pnpm vitest run packages/engine` runs 178 tests in about 0.4 s:

- **Kleene tables:** both truth tables written out in full, plus every lattice
  law on all combinations.
- **Parser:** valid inputs to exact ASTs (precedence, flattening, `?`, reserved
  words), and 29 invalid inputs, each with its error position and message.
- **Printer:** canonical output, including trees the parser never builds.
- **Rules:** helper and group loading, helper cycles (self, 2-, 3-cycles, a cycle
  not containing the starting helper, and a diamond that must *not* count as one),
  unknown references, invalid names.
- **Evaluator:** items, thresholds, `count` with groups and de-duplication,
  softening, helpers, and a guard against hand-built cyclic rules.
- **Solver:** chains, unreachable regions, the start region, maybe propagation,
  bottleneck paths, upgrades from maybe to yes in either exit order, cycles
  entered through a maybe exit, reuse across solves (no memo leaks), and every
  `DefinitionError`.
- **Properties (fast-check):** `parse(print(ast))` round-trips; printing any
  tree gives an equivalent requirement; compiled evaluation equals `evaluate`;
  the solver equals the literal fixpoint; and monotonicity, for requirements
  and for every region and location of random worlds. A seeded mutation (`>=`
  to `===` in compiled item tests) fails three of these, with shrunk
  counterexamples.

## How a game pack plugs in

A pack is data plus a few pure functions. Something like:

```ts
interface GamePack<Settings> {
  id: string; // "alttpr", "smz3", …
  items: readonly ItemDef[]; // ids and ranges: the tracker grid and the State shape
  rules(settings: Settings): RulesSource; // helpers and groups for this mode
  world(settings: Settings): World; // regions, exits, locations for this mode
  toState(progress: TrackerProgress, settings: Settings): State; // derived values
  markers: Record<string, MapMarker>; // location id -> map position, icon, label
}
```

The tracker would then:

1. On a new run or a settings change, call
   `compileWorld(pack.world(s), loadRules(pack.rules(s)), { items: ids })`
   (about 1 ms).
2. On every click, call `solve(compiled, pack.toState(progress, s))`. It returns
   a `Solution` that components read per location. Store it as one value and
   select `solution.location(id)` per marker.
3. Let `toState` derive what is not a raw item: crystals and pendants from
   beaten dungeons and their prizes, `agahnim` from the boss toggle, medallion
   knowledge, key counts.

Multi-game seeds (SMZ3) are one graph: both games' regions under prefixed ids,
joined by the exits that cross between them. The engine doesn't care which game
a region belongs to.

## Open questions for Phase 2

1. **Keysanity key counting.** `smallKeyHC >= 2` covers "has found N keys", and
   that stays monotone. But keys are consumed, and the randomizer reasons about
   worst-case door order: a key behind a locked door may itself be the key. We
   need to port its key rules (per dungeon, from source) and decide where that
   logic lives. One option is pack-authored helpers over found-key counts.
   Another is a `keys(dungeon) >= n` atom over state derived by `toState`. When
   a key could have been spent elsewhere, the answer is probably `maybe`.
2. **Entrance shuffle as dynamic exits.** Discovering an entrance changes the
   graph. Recompiling on every discovery is about 1 ms, which may be enough,
   since discoveries are rare compared to clicks. The alternative is exits whose
   target comes from state at solve time (an unknown target leads nowhere, or
   `maybe` everywhere). That breaks the fixed array layout, so measure before
   choosing.
3. **"Visible item" semantics.** The sample folds visible-only items into
   `maybe` (`… | maybe`). But "I can see what it is" (Bumper Cave ledge, Ether
   tablet) is not "possible but unconfirmed". Rather than a fourth value, which
   would break the lattice, a location could carry an optional `visible`
   requirement solved into a second channel, keeping `Tri` pure.
4. **Settings, swordless, placement variants.** Settings are fixed for a run,
   so they don't need monotonicity. Option (a): the pack picks rules and world
   per settings (`rules(settings)`), so swordless gets its own `@canBeatAgahnim`.
   Option (b): compile-time `setting(swordless)` atoms that `compileWorld`
   constant-folds, where negation would be safe. (a) needs no engine change.
   (b) keeps variants side by side, closer to how upstream writes them. ALttPR
   v31's Basic vs Advanced item placement is the first test case.
5. **Events.** Agahnim, crystals and pendants are player-set flags today. The
   solver could compute them: event locations that grant an item once reached,
   iterated to a fixpoint (monotone, at most one round per event). An event
   reached as `maybe` would grant a "maybe item", so item values would become
   Tri-valued. Decide whether the tracker infers events or the player records
   them.
6. **Knowledge is not monotone.** A medallion going from unknown to known can
   lower a location (from `maybe` to `no`). Monotonicity holds for items, not
   for knowledge. `toState` should model knowledge as "still possible" flags,
   and the docs should say which state changes can lower a result.
7. **Helper parameters.** `@canBeatBoss(moldorm)` would save dozens of helpers,
   at the cost of a substitution step and cycle checks per instantiation.
   Is it worth it?
8. **"Why is this maybe?"** The UI will want explanations. `evaluate()` walks
   the tree and can grow a trace mode, so keep it alongside the compiled path.
9. **Wiring.** The app's `tsc -b` only type-checks the engine once the app
   imports it. Until then, CI should run `pnpm --filter @alltp/engine typecheck`.
   The engine also isn't in the app's coverage thresholds yet.
