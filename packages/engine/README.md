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
        locations: [
          { id: "linksUncle" },
          // On its shelf, the item shows before the boots can knock it down.
          { id: "library", req: "boots", visible: {} },
        ],
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
solution.visible("library"); // "yes": seen, not yet collectable
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
| `settings.ts` | `Settings`, and `foldSettings`: settings to constants, at compile time |
| `evaluate.ts` | Reference semantics: a direct tree walk over a `State`; `trace` keeps every node's value |
| `compile.ts` | Compiles ASTs to closures over item/helper indices (the hot path) |
| `world.ts` | `World` types; `compileWorld` validates and lays the graph out as arrays |
| `solve.ts` | The solver and `Solution` |
| `explain.ts` | `explain`: the route to a location and its requirement, node by node |
| `analyze.ts` | `analyze`: blockers, the minimal sets of items that would unlock a location |

Choices that shape everything else:

- **Packs are data.** Requirements are strings, so a game pack is plain,
  serializable data. It can live in JSON, be diffed against the upstream
  randomizer, and be checked at load. Nothing in a pack is executable code.
- **No negation of items.** The language has no `<` or `==`, and `!` applies
  to settings only (`!setting(swordless)`). Settings are fixed for a run and
  folded to constants before anything is compiled, so every compiled rule is
  monotone: getting an item never makes anything less available. The property
  tests check this, and the solver depends on it (see below).
- **Check at load, not at solve.** Unknown helpers, helper cycles, unknown
  regions, duplicate ids, missing or mistyped settings, `reach()` in an exit
  and parse errors are all `DefinitionError`s from `loadRules` /
  `compileWorld`. Given the game's item list, so are misspelled
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
| `maybe` | Possible, but through something the logic can't vouch for: a dark room without a light source, an unknown medallion, a sequence break. |
| `no` | Out of logic. |

The values are ordered `no < maybe < yes` and combine with strong Kleene logic:
`and` is the minimum and `or` the maximum. With the identities `and() = yes`
and `or() = no`, this is a distributive lattice: commutative, associative,
idempotent, absorptive and distributive both ways. `tri.spec.ts` checks every
law on all 27 triples. `soften` (the DSL's `?x` / `maybe(x)`) maps `no` to
`maybe` and leaves the others alone. All three operators are monotone.

### Visible: a second channel, not a fourth value

"I can see what it holds" (the Bumper Cave ledge from below, the Ether tablet
read with the Book) is not "I might get it": it says nothing about whether the
item can be collected. So it is not folded into `maybe`, and not a fourth
`Tri` value either, which would break the lattice. A location may carry

```ts
{ id: "etherTablet", req: "book & mirror & sword >= 2", visible: { req: "book" } }
```

and the solver fills a second array beside the availability:

```
visible(l) = max(location(l), min(level(from), visible.req))
```

`from` is a region id and defaults to the location's own region; `req`
defaults to `true` and may use `reach()`. A location without `visible` has
`visible(l) = location(l)`, so `visible` is never below the availability, and
like it, it never goes down when an item is found. `Tri` and its laws are
unchanged: `visible` is the same lattice, read as "can see" rather than "can
get". `solution.visible(id)` and `solution.visibles()` read it.

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
            | "count" , "(" , name , { "," , name } , ")" , ">=" , threshold
            | helper
            | [ "!" ] , setting                (* the only negation *)
            | "reach" , "(" , name , ")"       (* locations only *)
            | "true" | "false" | "maybe"
            | name , [ ">=" , threshold ] ;

threshold   = integer | setting ;
setting     = "setting" , "(" , name , ")" ;
helper      = "@" , identifier ;            (* no space after "@" *)
name        = identifier - reserved ;
identifier  = lower , { lower | upper | digit | "_" } ;   (* [a-z][a-zA-Z0-9_]* *)
integer     = digit , { digit } ;           (* a safe integer *)
reserved    = "true" | "false" | "maybe" | "count" | "setting" | "reach" ;
```

Whitespace (space, tab, CR, LF) may sit between any two tokens. `>=` is one
token, and so is `@name`. A `setting` after `>=` must be a numeric setting,
anywhere else a boolean one. `reach()` names a region by its id, so only a
region whose id is a `name` can be reached.

### Precedence, tightest first

| Operator | Kind | Example | Reads as |
| --- | --- | --- | --- |
| `>= n` | part of an operand, not an operator | `sword >= 2` | one item test |
| `!` | part of a setting operand | `!setting(a) & b` | `(!setting(a)) & b` |
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
| `x >= setting(s)`, `count(…) >= setting(s)` | as above, with `n` the value of the numeric setting `s` |
| `setting(s)` / `!setting(s)` | `yes` / `no` as the boolean setting `s` is true, the other way round with `!` |
| `reach(r)` | the level of region `r` in the solved world (location requirements only, see [reach()](#reach-locations-that-need-a-second-region)) |
| `@h` | the value of helper `h` |
| `true` / `false` / `maybe` | `yes` / `no` / `maybe` |
| `?x`, `maybe(x)` | `soften(x)`: `no` becomes `maybe` |
| `x & y` | Kleene and (minimum) |
| `x \| y` | Kleene or (maximum) |

Helpers are named requirements from the pack (`helpers: { canLiftRocks: "glove" }`).
They may use other helpers, but not in a cycle: `loadRules` rejects
`@a -> @b -> @a` and names the cycle. Groups (`groups: { crystal: [...] }`)
are item sets. They can only appear inside `count()`, and they don't nest.

### Settings

A run's settings are a plain object of flags and numbers:
`{ swordless: false, crystalsTower: 7 }`. They are fixed for the whole run, so
they are read at compile time, never by the solver:

```ts
compileWorld(world, rules, { items, settings: { crystalsTower: 7, swordless: false } });
// "count(crystal) >= setting(crystalsTower)"         compiles as  count(crystal) >= 7
// "setting(swordless) & hammer | !setting(swordless) & sword >= 2"   as  sword >= 2
```

`compileWorld` first checks names on the requirements as written (so a typo in
a branch that the settings switch off is still an error), then folds every
helper and requirement with `foldSettings`, and compiles only the result:

1. `setting(s)` becomes `true` or `false`, `!setting(s)` the other one, and
   `>= setting(s)` the integer.
2. The constants are simplified away: `x & false` is `false`, `x & true` is
   `x`, `x | true` is `true`, `?false` is `maybe`, and a junction left with one
   argument is that argument. The result keeps the parser's flat shape, so it
   still round-trips through `print` and `parse`.

Because a setting is a constant by the time any item is read, `!setting(s)`
cannot make a rule non-monotone in items. That is why it is the one negation
the language allows. Settings and modes that need more than a constant (a
different world for inverted) still belong in the pack's choice of world and
rules.

A setting that is missing, or of the wrong type, is a `DefinitionError` naming
it and where it is used. So is one used in a branch the fold drops. A boolean
is expected for `setting(s)`, and a non-negative safe integer (like the
integers the grammar accepts) for `>= setting(s)`:

```
Location "l" uses unknown setting "open"
Helper "@canBeatAgahnim" uses setting "minSword" as a condition, but it is 2, not a boolean
Exit "r" -> "s" compares with setting "n", but it is true, not a non-negative integer
```

`evaluate(expr, state, rules, { settings })` reads settings as it meets them,
with the same errors. It is the reference the folded, compiled path is tested
against.

### Errors

A `ParseError` carries `pos`, the 0-based UTF-16 offset of the first character
it could not accept, and the message ends with it. The lexer runs lazily behind
the parser, so the first error in reading order is the one reported:

```
parse("a & & b")      Expected an item, a "@helper", "?" or "(" but found "&" at position 4
parse("(a | b")       Expected "&", "|" or ")" but found end of input at position 6
parse("!a")           Unexpected "!" at position 0 (only a setting can be negated, as in "!setting(name)": item rules must stay monotone)
parse("sword < 2")    Unexpected "<" at position 6 (only ">=" comparisons exist)
parse("count(a)")     Expected ">=" after "count(...)" but found end of input at position 8
```

Inside a pack, the error is wrapped with where it happened, and the
`ParseError` is kept as `cause`:
`Exit "r" -> "s": Expected an item, … at position 8`.

## The solver

### Definition

A `World` is `{ regions, start }`. Each region has one-way `exits: { to, req }[]`
and `locations: { id, req, visible?: { from?, req? } }[]`, and a requirement
defaults to `true`. For a state, region levels are the **least fixpoint** of

```
level(start) = yes
level(r)     = max over exits u -> r of  min(level(u), req(exit))
```

and then `location = min(level(its region), req(location))` and
`visible = max(location, min(level(from), visible.req))`. In words: a path is
as good as its weakest exit, and a region is as good as its best path. Exit
requirements read the state only. Location and visible requirements may also
read the final region levels, through `reach()`.

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
4. For each reachable region, evaluate its locations. Every region level is
   final by now, which is what `reach()` reads.
5. Copy the availability into the visible array, then raise each location
   with a `visible` entry to `min(level(from), visible.req)` when that is
   higher. The requirement is skipped when `from` cannot raise it.

Every region is expanded exactly once, at its final level. Nothing reached
later can beat `yes`, and the maybe phase only produces `maybe`. So each exit
and location requirement runs at most once per solve. Helpers are memoized per
solve and run at most once in all. An exit whose target already has the level
it could give is skipped without being evaluated. Regions out of reach cost
nothing. Cycles need no special case: a level only goes up, and a region is
expanded only when raised.

**Cost per solve:** O(R + E + L) plus the size of the requirements actually
evaluated (each AST node at most once, helper bodies included), for R regions,
E exits and L locations; a `visible` entry costs one more requirement. Memory
is O(R + L) typed arrays. Compiling is linear in
the world's size, and each distinct requirement text is parsed and compiled
once.

The property tests check this solver against the fixpoint definition iterated
literally (Bellman-Ford style, everything re-evaluated each round) on random
worlds with cycles and self-loops.

### reach(): locations that need a second region

Some checks sit in one region but need another one reached as well. Mimic
Cave is a location of east Death Mountain, yet its door is only reachable from
Turtle Rock's ledge in the Dark World, through the mirror:

```ts
{ id: "mimicCave", req: "mirror & reach(turtleRockLedge)" }
```

`reach(r)` is the level of region `r`, so the location is
`min(level(eastDeathMountain), mirror, level(turtleRockLedge))`, and a ledge
reached only as `maybe` makes the cave a `maybe`. Step 4 of the algorithm runs
once every level is final, so `reach()` reads final values and costs one array
read.

`reach()` is a `DefinitionError` in an exit requirement, written there or used
through any chain of helpers (`Exit "r" -> "s" uses reach(r) through @a -> @b`).
The single pass relies on exit requirements depending on the state alone: each
exit is evaluated once, when its source region is expanded at its final level.
An exit reading another region's level could see it before it is final, and
would have to be evaluated again each time that level rose. That is a general
fixpoint iteration, costing up to a full pass per raise instead of one pass
in all. A pack that needs "this passage opens once that region is reached"
expresses it with the graph (an exit from that region) or, later, with events
(see the open questions). A helper that uses `reach()` stays usable in
locations, and every `reach()` must name a region of the world, in helpers
too, used or not.

### Why monotonicity matters

Without negation, `level` is monotone in the state, and the least fixpoint is
well defined and found by the single pass above. The tracker can also rely on
it: finding an item never turns a check from available to unavailable. A
non-monotone rule (for example "no sword", in swordless) is a setting:
`!setting(swordless)` is folded to a constant before solving, so the compiled
world stays monotone in items.

## Explaining a location

`explain(world, state, id)` answers "why is this maybe?":

```ts
explain(world, { hammer: true }, "treasure");
// {
//   path: [
//     { region: "gate" },
//     { region: "vault", exit: { from: "gate", req: "?lantern", value: "maybe" } },
//   ],
//   requirement: { expr, value: "yes", children: [/* one TraceNode per operand */] },
// }
```

- **`path`** is a best route from the start to the location's region: the
  start first, then each region with the exit that entered it, its
  requirement (settings folded, printed) and that requirement's value. The
  weakest exit value on the path is the region's level. The path is empty
  when the region is out of reach.
- **`requirement`** is the location's requirement as a `TraceNode` tree:
  `{ expr, value, children }`, where the children are the operand of `?x`, the
  arguments of `&` / `|` and the body of `@h`. `trace()` builds it. It is
  `evaluate()` without short-circuits, so a branch that did not decide the
  result still shows its value. The location is
  `min(level(region), requirement.value)`.

The path costs almost nothing to record. When the solver raises a region, it
writes the exit index into `via: Int32Array`, so `via[r]` ends up being the
exit that gave `r` its final level. That exit's source had its own final level
when it was expanded, which happened before `r` was raised, so walking `via`
back from any reached region goes strictly back in time and ends at the start.
Explaining a location costs one solve, that walk and one traced evaluation.

The settings are the ones the world was compiled with. Explanations show the
folded requirements, which are what the solver ran: with `hard: true`,
`!setting(hard) & bow | boots` is explained as `boots`. That is why `explain`
takes no settings argument: a second settings object could only disagree with
the compiled world.

## Blockers: what to collect next

```ts
const analysis = analyze(world, state, { acquirable, maxAtoms: 3 });
analysis.blockers("mimicCave", "yes");
// { sets: [[{ item: "hookshot", min: 1 }, { item: "mirror", min: 1 }]], truncated: false }
analysis.blockers("ganonsTower", "yes"); // [[{ group: "crystal", min: 7 }]]
analysis.doableNow(); // the locations at yes now
```

### Definition

An **atom** is one thing to get: `{ item, min }` (hold at least `min` of the
item) or `{ group, min }` (have `min` of the group's members in all, whichever
they are). A fact the pack derives into the state, such as `agahnim`, is an
item like any other. A **set** of atoms is applied to the state by raising each
item to at least its `min`, a pointwise max.

`blockers(location, target)` lists **every minimal set of at most `maxAtoms`
atoms (default 3) whose application brings the location to `target`** (`yes`,
or `maybe` and above). Minimal is pointwise: no other listed set asks for less,
that is for a subset of its atoms at levels no higher. So `[[]]` means "already
there", and `[]` means "nothing within `maxAtoms` atoms gets there". The sets
come fewest atoms first, then by name and level; within a set, items come
before groups, each by name.

- Only items `options.acquirable(item)` accepts are proposed (default: all).
- An item's levels are bounded by `options.maxLevel(item)`. By default, that is
  the largest of 1 and every threshold an exit, location or helper tests the
  item at (`sword >= 2` somewhere makes it 2), which is the most an item test
  can ask. It also bounds how much a count can take from one item, so a count
  over an item no test reads above 1 takes 1 from it. A pack that knows its
  ranges should pass them.

### Algorithm

1. **Threshold.** For a target `t`, `[expr >= t]` is a monotone Boolean
   function of the item levels. `&` and `|` (min and max) commute with the
   threshold. `?x` reaches `yes` exactly when `x` does, and always reaches
   `maybe`. The constant `maybe` reaches `maybe`, not `yes`.
2. **Antichains of needs.** A node's value is the antichain of its minimal
   *needs*: the atoms still missing, relative to the state. An item test `x >= m`
   is `[[]]` when held, `[[x >= m]]` when acquirable within `maxLevel`, `[]`
   otherwise. `a & b` is every pairwise join (pointwise max) of their needs, and
   `a | b` the union, each then minimized (sorted fewest atoms first, a need
   can only be covered by one before it, so one pass keeps exactly the minimal
   ones). A need with more than `maxAtoms` atoms is dropped as soon as it
   appears. That is sound: a join never has fewer atoms than its operands, and
   a need with too many atoms covers only needs with too many atoms.
3. **Counts.** `count(g) >= n` over a single group is one atom on the group's
   count: its current value is the members' sum, its ceiling the sum of their
   ceilings. Any other count (items, or a mix) needs `d` more units. Its needs
   are every way to add exactly `d` units with at most `maxAtoms` atoms, each
   raising one item with room left by 1 up to its room. A minimal way adds
   exactly `d` (one more unit could be taken back), so no two ways compare.
   They are enumerated fewest atoms first, and stop past the cap.
4. **Regions.** A region's value is the least fixpoint of
   `R(r) = union over exits u -> r of R(u) & exit`, seeded with `[[]]` where the
   solver already reaches the target. Exits cannot use `reach()`, so their
   values are fixed, computed once per distinct requirement. A worklist expands
   a region only with the needs it gained since it was last expanded. It keeps
   one bucket per atom count and takes the fewest first: a join never has fewer
   atoms than its inputs, so when a bucket runs every cheaper need is final, as
   in Dijkstra's algorithm, and costlier needs are covered before they spread.
   A region takes in only the candidates its antichain does not cover yet,
   merged into it without sorting it again.
5. **Locations.** `R(region) & requirement`, where `reach(r)` reads `R(r)`.
   Helpers are memoized per target, requirement values per expression, region
   values per target and results per location, for the life of the `Analysis`.

### The cap, and `truncated`

A node keeps at most `MAX_SETS` (32) needs, the cheapest by the order above.
When it has more, the rest are dropped and the result says
`truncated: true`, as does every result that depends on that node. A truncated
list is still sound (every set listed works), but some minimal sets may be
missing, and with them a listed set may not be minimal. The flag is per result,
so an early-game location three items away from many alternatives can be
truncated while its neighbors are exact.

### Group counts are their own quantity

A crystal count is one goal for a player ("get 2 more crystals"), and as item
atoms it would be up to 7 of them, beyond any useful bound, in C(7, d)
combinations. So the analysis treats a group's count as a variable of its own,
independent of its members' items. That is sound: getting the members for real
only adds to the count. It is minimal over those variables, not over items:
with five crystals, `crystal6 & count(crystal) >= 7` gives
`[{ item: "crystal6", min: 1 }, { group: "crystal", min: 7 }]`, read "crystal 6, and 7
crystals in all". The brute-force test models exactly this, with a virtual item
standing for the count.

### Cost

Every value holds at most S = 32 needs of at most k = `maxAtoms` atoms, so `&`
costs at most S² joins of O(k) and a minimize of O(S² log S + S³ k), and `|`
less. In the fixpoint, each need a region accepts is joined with each exit's
needs once. Without the cap, a need is accepted at most once (once covered, it
stays covered); with it, an antichain still only improves in a well-founded
order (sorted, it decreases lexicographically), so the fixpoint terminates.
When each region accepts O(S) needs over the run, which the bucket order makes
the usual case, the total per target is O((E · S · Sₑ + L · S · Sₗ) · k) joins
plus their minimizes, for E exits, L locations, and exit and location
requirements of Sₑ and Sₗ needs: linear in the world, with constants set by S
and k. Measured below: a few ms for every location of a 300-region world.

## Performance

A seeded synthetic world at randomizer scale (`test/synthetic.ts`): 300
regions, 899 exits (a spanning tree from the start plus cycles), 1000
locations, 20 chained helpers, progressive items, softened items and crystal
counts. Every stage of the game yields all three outcomes. Measured on an Apple
M3 with Node 24.20.0 (the `compileWorld` and `analyze` rows later, on the same
machine, at a moment when the `solve` rows reproduced):

| Case | Vitest bench, mean (p99) | Production bundle, mean (p99) |
| --- | --- | --- |
| `solve`, empty inventory | 0.094 ms (0.20) | 0.013 ms (0.015) |
| `solve`, early game (25% of items) | 0.126 ms (0.34) | 0.019 ms (0.021) |
| `solve`, mid game (50% of items) | 0.177 ms (0.19) | 0.033 ms (0.035) |
| `solve`, late game (85% of items) | 0.171 ms (0.19) | 0.032 ms (0.034) |
| `solve` + `locations()` snapshot, mid game | 0.264 ms (0.36) | n/a |
| `compileWorld` (once per game / mode) | 1.78 ms (3.27) | 1.57 ms (3.44) |
| `analyze` + `blockers` of one location, mid game | 0.279 ms (0.42) | 0.041 ms (0.083) |
| `blockers` of every location, both targets, early game | 5.39 ms (6.16) | 5.52 ms (6.33) |
| `blockers` of every location, both targets, mid game | 0.692 ms (0.92) | 0.620 ms (1.41) |
| `blockers` of every location, both targets, late game | 0.506 ms (0.66) | 0.463 ms (0.94) |

The budget is 5 ms per full solve, so it can run on every click. A mid-game
solve uses about 4% of it under Vitest and under 1% from a bundle. Settings,
`reach()`, the visible channel and the route `explain` reads cost the solver
little: timed against the previous version in the same process, a solve stays
within about 10%. `compileWorld` costs about 0.3 ms more (folding, and the
trees `explain` and `analyze` keep).

Blockers are asked for on demand. Every location of the world, for both
targets, takes about 5 ms in the early game, when most of the world is two or
three items away by many routes, and well under 1 ms later; averaged over a
game (20 stages from 10% to 90% of the items), 2 to 3 ms, against a budget of
10 ms. The analysis avoids imported constants in its hot loops, so Vitest and
a bundle time it alike. Under coverage instrumentation it runs 2 to 5 times
slower.

- `pnpm vitest bench --run packages/engine` runs `test/solve.bench.ts` (Vitest
  5's `bench` fixture).
- The "production bundle" column comes from the same cases built into a bundle
  (`vite build` for the solver rows, esbuild for the rest) and timed with
  `performance.now()` in plain Node. Vitest runs sources through its module
  runner, which turns every imported binding into a getter (it warns about
  this). The solver's hot path reads imported constants on every node, which
  costs about 5×. So the Vitest column is an upper bound.
- `test/performance.spec.ts` runs with `pnpm test`. It fails if the average of
  2000 solves reaches 5 ms, after checking the world's size and its outcome mix,
  so it can't pass by timing a trivial solve.
- `test/analyze.performance.spec.ts` asks for the blockers of every location,
  for both targets, at 20 stages of the game (10% to 90% of the items). It
  fails if a stage takes 10 ms or more on average, after checking that an
  early stage has real work: sets to list, locations already there, locations
  out of reach. A few ms is easy to lose to a busy machine, so it times the
  CPU time of its own process (Vitest runs each test file in one) and keeps
  each stage's fastest of 7 runs: with the load average at 27 on 8 cores, it
  still measured about 3 ms. Coverage instrumentation (`pnpm test:coverage`,
  which CI runs) slows this code several times over; `vitest.config.ts` tells
  the test, which then allows 8× the budget, enough to catch a blow-up but not
  a slow drift. A plain `pnpm test` holds the real budget.

## Tests

`pnpm vitest run --project engine` runs 310 tests in about 1 s:

- **Kleene tables:** both truth tables written out in full, plus every lattice
  law on all combinations.
- **Parser:** valid inputs to exact ASTs (precedence, flattening, `?`, `!`,
  settings, reserved words), and 40 invalid inputs, each with its error
  position and message.
- **Printer:** canonical output, including trees the parser never builds.
- **Settings:** a folding table (negation, thresholds, constants simplified
  away, flat shape kept), every setting error, helpers folded per run, and
  typos caught in branches the settings switch off.
- **reach():** the Mimic Cave pattern at no / maybe / yes, a region raised
  after the location's own region was expanded, reach() through a helper, and
  every error: in an exit directly, through a chain of helpers, after a
  reach-free helper was cached, and unknown regions in locations and helpers.
- **Visible:** no entry means the availability; seen from another region;
  read from a region reached as maybe; the visible requirement's own maybe;
  availability winning over visibility; `reach()` in a visible requirement;
  the snapshot; unknown `from` regions and parse errors, named. The sample
  pins the Bumper Cave ledge and the Ether tablet at every stage.
- **Explain:** a chain of exits with their values, a maybe exit, the best of
  two routes (bottleneck), the start, a region out of reach, exact traces
  (helpers, branches past a short-circuit, `reach()`), folded settings.
- **Blockers:** one item; a progressive level as one atom (`sword >= 2` from
  sword 1); the minimal ways out of an `|`; a region path joined with the
  location; a cycle; needs a region gains after its first expansion; a need
  dropped once a cheaper way covers it; group counts as one atom (and as their
  own quantity beside a member); counts over items spread on the items with
  room, with and without `maxLevel`; `[[]]`, `[]` and `maxAtoms`; the maybe
  threshold; `acquirable`; helpers and `reach()` (Mimic Cave); the cap with
  `truncated`, and a neighbor it does not touch; memoization, `doableNow` and
  bad input.
- **Rules:** helper and group loading, helper cycles (self, 2-, 3-cycles, a cycle
  not containing the starting helper, and a diamond that must *not* count as one),
  unknown references, invalid names.
- **Evaluator:** items, thresholds, `count` with groups and de-duplication,
  softening, helpers, and a guard against hand-built cyclic rules.
- **Solver:** chains, unreachable regions, the start region, maybe propagation,
  bottleneck paths, upgrades from maybe to yes in either exit order, cycles
  entered through a maybe exit, reuse across solves (no memo leaks), and every
  `DefinitionError`.
- **Properties (fast-check):** random requirements and worlds use settings,
  negated settings and setting thresholds throughout, location and visible
  requirements use `reach()` (exits never do), and a third of the locations
  are visible from some region. `parse(print(ast))` round-trips; printing any
  tree gives an equivalent requirement; folding leaves no setting, keeps the
  meaning and the parser's shape, helpers included; compiled evaluation
  equals `evaluate`; the solver equals the literal fixpoint, visibles
  included; `visible >= location`; `trace` agrees with `evaluate` on every
  node; `explain` gives every location of a random world a path of real
  exits from the start whose weakest value is the region's level, and a
  requirement that makes up the rest; and monotonicity in items, for
  requirements and for every region, location and visible of compiled
  worlds. Seeded mutations fail them with shrunk counterexamples: `>=` to
  `===` in compiled item tests fails three, a fold that ignores `!` three, a
  fold that skips the inside of `?x` four, a compiled `reach()` that drops
  `maybe` two, a visible channel started from zero two, an anti-monotone
  visible requirement two, a `via` that keeps the first raise instead of the
  last one, and a traced `?x` that does not soften, two each.
- **Blockers against brute force (fast-check):** 1000 random worlds of up to 5
  regions (a spanning tree plus cycle-closing exits) over five items, one of
  them progressive, and a group; random states, `acquirable` subsets and
  `maxAtoms` from 0 to 3. For every location and both targets, every need of
  at most `maxAtoms` atoms is applied and solved (group counts as a virtual
  item, see above), and the minimal ones that reach the target must be exactly
  `blockers()`. A truncated result is checked for soundness instead, and the
  run fails if more than 1 in 20 results were truncated or fewer than 1 in 5
  had something to collect, so it cannot pass vacuously (about a third do).
  `doableNow()` must match the solver. Seeded mutations: no minimization fails
  it and a hand case; pruning at `maxAtoms - 1`, it and two hand cases; `?x`
  read as `x` for maybe, it and a hand case; an incremental merge that keeps
  covered needs, it and a hand case; a worklist that never expands a region
  twice, a hand case, and the brute force in 7 runs out of 8.

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
   `compileWorld(pack.world(s), loadRules(pack.rules(s)), { items: ids, settings: s })`
   (about 1 ms).
2. On every click, call `solve(compiled, pack.toState(progress, s))`. It returns
   a `Solution` that components read per location. Store it as one value and
   select `solution.location(id)` per marker.
3. Let `toState` derive what is not a raw item: crystals and pendants from
   beaten dungeons and their prizes, `agahnim` from the boss toggle, medallion
   knowledge, key counts.
4. On demand (a hover, a "what next?" panel), call `explain(compiled, state, id)`
   for why a location is what it is, and
   `analyze(compiled, state, { acquirable, maxLevel }).blockers(id, "yes")` for
   what would unlock it. `acquirable` says which items the player can still
   get (not the derived facts the pack infers by itself, if it wants them
   hidden); `maxLevel` gives the item ranges from `pack.items`.

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
3. **"Visible item" semantics.** Done: `Location.visible` is solved into a
   second channel (see [Visible](#visible-a-second-channel-not-a-fourth-value)),
   and the sample's Bumper Cave ledge and Ether tablet use it instead of the old
   `… | maybe` idiom. Still open: how the map shows "seen, not collectable".
4. **Settings, swordless, placement variants.** Done as option (b):
   compile-time `setting(name)`, `!setting(name)` and `>= setting(name)`,
   folded by `compileWorld` (see [Settings](#settings)). Option (a), the pack
   picking rules and world per settings, still works and suits whole-world
   changes such as inverted. Still open: which of ALttPR v31's Basic vs
   Advanced placement differences fit in a setting atom.
5. **Events.** Agahnim, crystals and pendants are player-set flags today. The
   solver could compute them: event locations that grant an item once reached,
   iterated to a fixpoint (monotone, at most one round per event). An event
   reached as `maybe` would grant a "maybe item", so item values would become
   Tri-valued. Decide whether the tracker infers events or the player records
   them.
6. **Knowledge is not monotone.** A medallion going from unknown to known can
   lower a location (from `maybe` to `no`). Monotonicity holds for items, not
   for knowledge. `toState` should model knowledge as "still possible" flags,
   and the docs should say which state changes can lower a result. Blockers
   follow: a knowledge flag the player cannot "collect" should not be
   `acquirable`.
7. **Helper parameters.** `@canBeatBoss(moldorm)` would save dozens of helpers,
   at the cost of a substitution step and cycle checks per instantiation.
   Is it worth it?
8. **"Why is this maybe?"** Done: `explain()` gives the route and the traced
   requirement (see [Explaining a location](#explaining-a-location)). Still
   open: how the UI words a trace for a player.
9. **Wiring.** Done: the root `tsc -b` references this package, and the root
   coverage run measures `packages/*/src` against the same floors as the app.
