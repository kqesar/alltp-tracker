// What the Door Randomizer's Standard world adds in code (standard_rules,
// Rules.py:1502-1580): the save-and-quit to Uncle (:1503-1504), and the
// way back from Zelda's cell to the throne room, whose rules gate taking
// her out (find_rules_for_zelda_delivery, :1583-1607, set on the throne
// room's tapestry and on her drop-off, :1569-1572).
import { regionNamed } from "./data";
import { and } from "./text";

/** An exit, as the world builder holds it. */
interface StandardExit {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  req: string;
}

/** add_connection('Menu', 'Hyrule Castle Secret Entrance', 'Uncle S&Q'). */
export const UNCLE_SAVE_AND_QUIT = {
  from: "Menu",
  name: "Uncle S&Q",
  req: "true",
  to: "Hyrule Castle Secret Entrance",
} as const;

/**
 * find_rules_for_zelda_delivery: from Zelda's cellblock, breadth first
 * through the exits into a dungeon region or the castle's ledge, each
 * region once, the rules of the first path to the throne room that a blank
 * state does not pass. A rule reads as DR's lambdas read it then: the ones
 * set before standard_rules (the key logic among them), here the world's
 * rules so far, a stricter reading where a later rule was added.
 * @param passesBlank - Whether a rule holds with nothing collected
 */
export function zeldaPath(
  exits: readonly StandardExit[],
  passesBlank: (req: string) => boolean,
): readonly string[] {
  const out = new Map<string, StandardExit[]>();
  for (const exit of exits)
    out.set(exit.from, [...(out.get(exit.from) ?? []), exit]);
  const start = "Hyrule Dungeon Cellblock";
  const visited = new Set([start]);
  const queue: [string, string[]][] = [[start, []]];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const [region, rules] = next;
    for (const exit of out.get(region) ?? []) {
      const to = regionNamed(exit.to);
      if (
        visited.has(to.name) ||
        (to.type !== "dungeon" && to.name !== "Hyrule Castle Ledge")
      )
        continue;
      const path = passesBlank(exit.req) ? rules : [...rules, exit.req];
      if (to.name === "Hyrule Castle Throne Room") return path;
      visited.add(to.name);
      queue.push([to.name, path]);
    }
  }
  throw new RangeError("No path to the throne room");
}

/**
 * Sets the throne room's tapestry and Zelda's drop-off to her being
 * carried and the path's rules (Rules.py:1569-1572): set, not added, so
 * the rules they had go.
 */
export function addZeldaPath(
  exits: readonly StandardExit[],
  locations: Map<string, string>,
  path: readonly string[],
): void {
  const rule = and("zeldaHerself", ...path);
  const tapestry = exits.find(
    (e) => e.name === "Hyrule Castle Throne Room Tapestry",
  );
  if (tapestry !== undefined) tapestry.req = rule;
  if (locations.has("Zelda Drop Off")) locations.set("Zelda Drop Off", rule);
}
