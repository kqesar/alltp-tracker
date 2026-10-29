// DR's tests' states, as the pack's: what DR's CollectionState holds once
// a case's items are collected, the pool an everything-but case draws
// from, and the settings DR's test harness builds its world with.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Settings, State } from "@alltp/engine";
import { ITEMS } from "../scripts/dr-rules.mjs";
import rules from "../src/door-rando/world/rules.json" with { type: "json" };
import { DR_DEFAULTS } from "../src/door-world/index";
import { medallionFacts } from "../src/medallions";
import { settingsFromUpstream } from "../src/settings";
import { PACK_DIR } from "./manifest";

/** DR's dungeons, by the name its keys carry, in the pack's key codes. */
const KEY_CODES: Readonly<Record<string, string>> = {
  "Agahnims Tower": "A1",
  "Desert Palace": "P2",
  "Eastern Palace": "P1",
  Escape: "H2",
  "Ganons Tower": "A2",
  "Ice Palace": "D5",
  "Misery Mire": "D6",
  "Palace of Darkness": "D1",
  "Skull Woods": "D3",
  "Swamp Palace": "D2",
  "Thieves Town": "D4",
  "Tower of Hera": "P3",
  "Turtle Rock": "D7",
};

const PROGRESSIVE: Readonly<Record<string, string>> = {
  "Progressive Armor": "armor",
  "Progressive Bow": "bow",
  "Progressive Glove": "glove",
  "Progressive Shield": "shield",
  "Progressive Sword": "sword",
};

/** The events a test may hold by name, by the world's id. */
const EVENTS = new Map(
  Object.entries(rules.events).map(([id, { item }]) => [item, id]),
);

/** Items no rule reads, or none of the pack's state holds. */
const READ_BY_NONE = /^(Never in logic|(Map|Compass) \(.+\))$/;

/**
 * What DR's state holds once it collects `names` (TestBase.py get_state,
 * CollectionState.collect, BaseClasses.py:1331), as the pack's state: a
 * progressive item steps up, a bottle or a heart counts, heart_count's 3
 * starting hearts held as heart containers (BaseClasses.py:1171-1179), the
 * medallions the harness asks.
 */
export function collect(names: readonly string[]): State {
  const state: Record<string, number> = {
    heartContainer: 3,
    // build_vanilla_world: required_medallions Ether, Quake (TestBase.py:59)
    ...medallionFacts({ mire: "ether", turtleRock: "quake" }),
  };
  const add = (id: string) => {
    state[id] = (state[id] ?? 0) + 1;
  };
  const atLeast = (id: string, level: number) => {
    state[id] = Math.max(state[id] ?? 0, level);
  };
  for (const name of names) {
    const key = /^(Small|Big) Key \((.+)\)$/.exec(name);
    const item = (
      ITEMS as Readonly<Record<string, readonly [string, number?]>>
    )[name];
    const event = EVENTS.get(name);
    if (PROGRESSIVE[name] !== undefined) add(PROGRESSIVE[name]);
    else if (name.startsWith("Bottle")) add("bottle");
    else if (/^(Boss|Sanctuary) Heart Container$/.test(name))
      add("heartContainer");
    else if (name === "Piece of Heart") add("pieceOfHeart");
    else if (key !== null) {
      const code = KEY_CODES[key[2] ?? ""];
      if (code === undefined) throw new RangeError(`No dungeon "${key[2]}"`);
      if (key[1] === "Small") add(`key${code}`);
      else atLeast(`bigKey${code}`, 1);
    } else if (item !== undefined) atLeast(item[0], item[1] ?? 1);
    else if (event !== undefined) atLeast(event, 1);
    else if (!READ_BY_NONE.test(name))
      throw new RangeError(`No item "${name}" of DR`);
  }
  return state;
}

/**
 * The world's item pool, as TestBase.py's everything-but cases draw it
 * (`self.world.itempool`): the open pool, the dungeons' items and the
 * prizes (pool.json, cited by line).
 */
export const POOL: readonly string[] = (() => {
  const pool = JSON.parse(
    readFileSync(join(PACK_DIR, "test/dr-upstream/pool.json"), "utf8"),
  ) as {
    progression: readonly { items: readonly string[] }[];
    dungeonItems: { items: readonly string[] };
    prizes: { items: readonly string[] };
  };
  return [
    ...pool.progression.flatMap((p) => p.items),
    ...pool.dungeonItems.items,
    ...pool.prizes.items,
  ];
})();

/** The items of a case: those named, or the pool but some, then those. */
export function itemsOf(
  items: readonly string[],
  allExcept: readonly string[] | undefined,
): readonly string[] {
  if (allExcept === undefined || allExcept.length === 0) return items;
  return [
    ...POOL.filter(
      (name) =>
        !allExcept.includes(name) &&
        !(name.startsWith("Bottle") && allExcept.includes("AnyBottle")),
    ),
    ...items,
  ];
}

/**
 * build_vanilla_world's settings (test/TestBase.py:27-33 at the harness
 * commit): the CLI's defaults, vanilla doors and entrances, intensity 1,
 * the Ganon goal, seven crystals each.
 */
export const settingsOf = (mode: "open" | "inverted"): Settings => ({
  ...DR_DEFAULTS,
  ...settingsFromUpstream(mode),
});
