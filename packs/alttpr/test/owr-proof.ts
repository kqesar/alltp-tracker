// How a case of the Overworld Randomizer's own tests is shown answered by
// OWR itself, from the world built on its data: a false case the pack
// answers yes by a route (witness), a true case it answers otherwise by the
// set the case reaches and every exit out of it (cut). Each exit either
// takes is named, with the rule the world gives it, so owr-contract.spec
// can hold it to the rule read in OWR's source (owr-edges.ts). An exit of
// OWR's noglitches world is one of Regions.py's (create_*_region), a
// mirror exit (create_dynamic_mirror_exits, OverworldShuffle.py:1186-1207)
// or a flute exit (create_dynamic_flute_exits, FluteShuffle.py:664-675);
// its other Entrance() sites are glitched logic or Standard's
// (OverworldShuffle.py:210-211, Rules.py:114-115, :1694).
import {
  type CompiledWorld,
  evaluate,
  print,
  type State,
  solve,
} from "@alltp/engine";
import {
  dynamicExits,
  vanillaConnections,
} from "../src/door-world/connections";
import type { DrData, DrMode } from "../src/door-world/data";
import type { DrWorld } from "../src/door-world/index";
import { owrMovedExits } from "../src/door-world/overworld";

const TRUE = { type: "const", value: "yes" } as const;

/** An exit a proof reads: its name, its ends and the rule it carries. */
export interface ProofStep {
  readonly exit: string;
  readonly from: string;
  readonly to: string;
  /** The world's rule for the exit, settings folded, as print writes it. */
  readonly rule: string;
}

/** The world's exits by their ends, each with its name. */
function namedExits(
  data: DrData,
  mode: DrMode,
): ReadonlyMap<string, readonly string[]> {
  const connections = vanillaConnections(data, mode, 157);
  const moved = owrMovedExits(data, mode);
  const named = new Map<string, string[]>();
  const add = (from: string, to: string, name: string) => {
    const key = `${from}\u0000${to}`;
    named.set(key, [...(named.get(key) ?? []), name]);
  };
  for (const region of data.regions)
    for (const name of region.exits) {
      const to = connections.get(name);
      if (to !== undefined) add(moved.get(name) ?? region.name, to, name);
    }
  for (const exit of dynamicExits(data, mode))
    add(exit.from, exit.to, exit.name);
  return named;
}

/** A location step's label: its name, or the probe's id (`exit:…`). */
const labelOf = (world: DrWorld, id: string): string => {
  for (const [name, at] of world.locationIds)
    if (at === id) return `location ${name}`;
  return id;
};

/** Reads a compiled world's regions by DR's names. */
function namesOf(world: DrWorld, data: DrData) {
  const c: CompiledWorld = world.compiled;
  // A region by DR's name, a dungeon's crystal states and ranged probes
  // folded into their room
  const home = (i: number) =>
    data.regionById.get(
      (c.regionIds[i] ?? "")
        .replace(/__(orange|blue)$/, "")
        .replace(/_rangedCrystal$/, ""),
    );
  const region = (i: number) => home(i)?.name ?? c.regionIds[i] ?? "";
  return { c, home, region };
}

/** The step a compiled exit is, named by the world's exits between its ends. */
function stepOf(
  world: DrWorld,
  data: DrData,
  named: ReadonlyMap<string, readonly string[]>,
  e: number,
): ProofStep {
  const { c, region } = namesOf(world, data);
  const from = region(c.exitSources[e] ?? 0);
  const to = region(c.exitTargets[e] ?? 0);
  const names = named.get(`${from}\u0000${to}`) ?? [];
  return {
    exit: names.join(" | ") || `${from} -> ${to}`,
    from,
    rule: print(c.exitExprs[e] ?? { type: "const", value: "yes" }),
    to,
  };
}

/**
 * The cut of a true case: the regions the world reaches for the state (at
 * yes or maybe), each dungeon reached at all closed over (its rooms leave
 * only through its portals, to regions already reached), every exit out
 * of that set, and the location of each event such an exit reads, where
 * the set holds it; when the set holds the case's location, its own rule
 * alone (`exit` its `location` name).
 */
export function cutOf(
  world: DrWorld,
  data: DrData,
  mode: DrMode,
  regions: Readonly<Record<string, string>>,
  location: string,
): readonly ProofStep[] {
  const { c, home } = namesOf(world, data);
  const reached = new Set<number>();
  for (let i = 0; i < c.regionIds.length; i++)
    if (regions[c.regionIds[i] ?? ""] !== "no") reached.add(i);
  const rooms = new Map<string, number[]>();
  for (let i = 0; i < c.regionIds.length; i++) {
    const at = home(i);
    if (at?.type !== "dungeon") continue;
    const d = at.dungeon ?? "";
    rooms.set(d, [...(rooms.get(d) ?? []), i]);
  }
  for (let grown = true; grown; ) {
    grown = false;
    for (const [name, members] of rooms) {
      if (!members.some((i) => reached.has(i))) continue;
      if (members.every((i) => reached.has(i))) continue;
      const closed = members.every((i) => {
        for (
          let e = c.exitOffsets[i] ?? 0;
          e < (c.exitOffsets[i + 1] ?? 0);
          e++
        ) {
          const t = c.exitTargets[e] ?? 0;
          const to = home(t);
          if (to?.type === "dungeon" && to.dungeon === name) continue;
          if (!reached.has(t)) return false;
        }
        return true;
      });
      if (!closed) continue;
      for (const i of members) reached.add(i);
      grown = true;
    }
  }
  const li = c.locationIndex.get(location) ?? -1;
  const at = c.locationRegions[li] ?? -1;
  // Reached: the location's own rule is the cut
  if (reached.has(at))
    return [
      {
        exit: labelOf(world, location),
        from: data.regionById.get(c.regionIds[at] ?? "")?.name ?? "",
        rule: print(c.locationExprs[li] ?? TRUE),
        to: data.regionById.get(c.regionIds[at] ?? "")?.name ?? "",
      },
    ];
  const named = namedExits(data, mode);
  const cut: ProofStep[] = [];
  for (const i of reached)
    for (let e = c.exitOffsets[i] ?? 0; e < (c.exitOffsets[i + 1] ?? 0); e++) {
      const t = c.exitTargets[e] ?? 0;
      if (reached.has(t)) continue;
      cut.push(stepOf(world, data, named, e));
    }
  // An event a cut exit reads is out of reach too: its location stands
  // beyond the cut, or its own rule joins it (and the events it reads)
  const joined = new Set<string>();
  for (let grown = true; grown; ) {
    grown = false;
    for (const { item, location: at } of world.facts) {
      if (joined.has(at)) continue;
      if (!cut.some((step) => new RegExp(`\\b${item}\\b`).test(step.rule)))
        continue;
      const fi = c.locationIndex.get(at) ?? -1;
      const where = c.locationRegions[fi] ?? -1;
      if (!reached.has(where)) continue;
      joined.add(at);
      grown = true;
      const name = data.regionById.get(c.regionIds[where] ?? "")?.name ?? "";
      cut.push({
        exit: labelOf(world, at),
        from: name,
        rule: print(c.locationExprs[fi] ?? TRUE),
        to: name,
      });
    }
  }
  return cut;
}

/**
 * The witness of a false case: a shortest route from the start to the
 * location over exits worth yes, then for each fact a step reads the route
 * to the location that gives it, each found with the facts the sweep held
 * before that one only (sweep_for_events, which get_state runs,
 * TestBase.py:157), and each location's own rule as a step of its own
 * (`exit` its `location` name). Undefined when no such route is worth yes.
 * @param items - The case's state, before any fact
 */
export function witnessOf(
  world: DrWorld,
  data: DrData,
  mode: DrMode,
  items: State,
  location: string,
): readonly ProofStep[] | undefined {
  const { c, region } = namesOf(world, data);
  const named = namedExits(data, mode);
  // The sweep's passes: the state each pass solves, and the pass each fact
  // is first held after
  const states: State[] = [items];
  const gained = new Map<string, number>();
  for (;;) {
    const current = states.at(-1) ?? items;
    const solution = solve(c, current);
    const raised = world.facts.filter(
      (f) => !current[f.item] && solution.location(f.location) === "yes",
    );
    if (raised.length === 0) break;
    for (const f of raised) gained.set(f.item, states.length);
    states.push({
      ...current,
      ...Object.fromEntries(raised.map((f) => [f.item, 1])),
    });
  }
  const factAt = new Map(world.facts.map((f) => [f.item, f.location]));
  const yesAt = (state: State, x: unknown) =>
    evaluate(
      (x as Parameters<typeof evaluate>[0]) ?? { type: "const", value: "yes" },
      state,
      c.rules,
    ) === "yes";
  const steps: ProofStep[] = [];
  const done = new Set<string>();
  /** Reaches a location with the facts of passes before `pass` only. */
  const reach = (id: string, pass: number): boolean => {
    if (done.has(id)) return true;
    const li = c.locationIndex.get(id);
    if (li === undefined) return false;
    const target = c.locationRegions[li] ?? -1;
    // The first pass whose state reaches it
    for (let p = 0; p < pass; p++) {
      const state = states[p] ?? items;
      const via = new Map<number, number>([[c.start, -1]]);
      const queue = [c.start];
      for (let head = 0; head < queue.length && !via.has(target); head++) {
        const r = queue[head] ?? 0;
        for (
          let e = c.exitOffsets[r] ?? 0;
          e < (c.exitOffsets[r + 1] ?? 0);
          e++
        ) {
          const t = c.exitTargets[e] ?? 0;
          if (via.has(t) || !yesAt(state, c.exitExprs[e])) continue;
          via.set(t, e);
          queue.push(t);
        }
      }
      if (!via.has(target) || !yesAt(state, c.locationExprs[li])) continue;
      done.add(id);
      const route: number[] = [];
      for (let r = target, e = via.get(r) ?? -1; e >= 0; e = via.get(r) ?? -1) {
        route.unshift(e);
        r = c.exitSources[e] ?? 0;
      }
      const texts = [
        ...route.map((e) => print(c.exitExprs[e] ?? TRUE)),
        print(c.locationExprs[li] ?? TRUE),
      ];
      for (const e of route) steps.push(stepOf(world, data, named, e));
      steps.push({
        exit: labelOf(world, id),
        from: region(target),
        rule: texts.at(-1) ?? "true",
        to: region(target),
      });
      // Each fact the route reads, reached in an earlier pass
      for (const [item, at] of factAt) {
        const held = gained.get(item);
        if (held === undefined || held > p) continue;
        if (!texts.some((t) => new RegExp(`\\b${item}\\b`).test(t))) continue;
        if (!reach(at, held)) return false;
      }
      return true;
    }
    return false;
  };
  return reach(location, states.length) ? steps : undefined;
}
