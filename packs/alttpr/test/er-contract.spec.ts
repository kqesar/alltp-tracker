// The entrance randomizer's own tests (test/er-upstream/, imported by
// scripts/import-er.mjs), held against the pack's port of its world
// (src/er-world.ts) as the pack holds vt's: upstream `true` must be our
// `yes`, upstream `false` must not be.
import { readdirSync, readFileSync } from "node:fs";
import type { State } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { DUNGEON_CODES, ITEMS } from "../scripts/er-rules.mjs";
import { erLocationId } from "../src/entrances";
import rules from "../src/entrances/rules.json" with { type: "json" };
import {
  type ErConnections,
  erWorld,
  mandatoryConnections,
  solveFacts,
  vanillaConnections,
} from "../src/er-world";
import { OPEN } from "../src/settings";
import { contractHolds } from "./contract";

interface ErFixture {
  readonly file: string;
  readonly harness: {
    readonly bombShop: string | null;
    readonly connections: "mandatory" | "vanilla";
    readonly marked: boolean;
    readonly pool: boolean;
    readonly swampPatch: boolean | null;
  };
  readonly tests: readonly {
    readonly name: string;
    readonly line: number;
    readonly startingRegions: readonly string[];
    readonly cases: readonly (readonly [
      location: string,
      access: boolean,
      items: readonly string[],
      allExcept?: readonly string[],
    ])[];
  }[];
}

const DIR = new URL("./er-upstream/", import.meta.url);
const FIXTURES: readonly ErFixture[] = readdirSync(DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(new URL(file, DIR), "utf8")));

/** The progressive items, by the pack's id they step up (collect). */
const PROGRESSIVE: Readonly<Record<string, string>> = {
  "Progressive Armor": "armor",
  "Progressive Bow": "bow",
  "Progressive Glove": "glove",
  "Progressive Shield": "shield",
  "Progressive Sword": "sword",
};

/** The events a test may hold by name, by the pack's id. */
const EVENTS = new Map(
  Object.entries(rules.events).map(([id, { item }]) => [item, id]),
);

/** Items no rule reads: rupees, ammunition, a dungeon's map and compass. */
const READ_BY_NONE =
  /^(Rupees? \(\d+\)|Arrows \(10\)|Single Arrow|Bombs \(3\)|(Map|Compass) \(.+\))$/;

/**
 * What the randomizer's state holds once it collects `names`, each as an
 * advancement (TestDungeon.py:44-46), as the pack's state: progressive
 * items step up, a bottle or a heart counts.
 */
function collect(names: readonly string[]): State {
  const state: Record<string, number> = {};
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
    else if (name === "Bombs (10)") atLeast("tenBombs", 1);
    else if (name === "Silver Arrows") atLeast("silverArrowUpgrade", 1);
    else if (key !== null) {
      const code =
        DUNGEON_CODES[key[2] as keyof typeof DUNGEON_CODES] ??
        (key[2] === "Escape" ? "H2" : undefined);
      if (code === undefined) throw new RangeError(`No dungeon "${key[2]}"`);
      if (key[1] === "Small") add(`key${code}`);
      else atLeast(`bigKey${code}`, 1);
    } else if (item !== undefined) atLeast(item[0], item[1] ?? 1);
    else if (event !== undefined) atLeast(event, 1);
    else if (!READ_BY_NONE.test(name))
      throw new RangeError(`No item "${name}" of the randomizer`);
  }
  return state;
}

const times = (n: number, name: string): string[] => Array(n).fill(name);

/**
 * The pool the dungeon tests' world holds (TestDungeon.py:28-30): what
 * generate_itempool gives an Open world of normal difficulty with
 * progressive items, random swords and the Ganon goal (ItemList.py
 * get_pool_core, :356-494), the dungeons' items (Dungeons.py:18-30, every
 * one with place_dungeon_items) and the prizes and Agahnim's defeats the
 * test adds. Rupees and ammunition left out: no rule reads them.
 */
const DUNGEON_TEST_POOL: readonly string[] = [
  // alwaysitems (:15-16)
  "Bombos",
  "Book of Mudora",
  "Cane of Somaria",
  "Ether",
  "Fire Rod",
  "Flippers",
  "Ocarina",
  "Hammer",
  "Hookshot",
  "Ice Rod",
  "Lamp",
  "Cape",
  "Magic Powder",
  "Mushroom",
  "Pegasus Boots",
  "Quake",
  "Shovel",
  "Bug Catching Net",
  "Cane of Byrna",
  "Blue Boomerang",
  "Red Boomerang",
  ...times(2, "Progressive Glove"),
  "Magic Mirror",
  "Moon Pearl",
  // normalbaseitems (:22-23), four bottles (:394-399)
  "Magic Upgrade (1/2)",
  "Sanctuary Heart Container",
  "Bombs (10)",
  ...times(10, "Boss Heart Container"),
  ...times(24, "Piece of Heart"),
  ...times(4, "Bottle"),
  ...times(3, "Progressive Shield"),
  ...times(2, "Progressive Armor"),
  ...times(2, "Progressive Bow"),
  ...times(4, "Progressive Sword"),
  // Dungeons.py:18-30
  "Small Key (Escape)",
  "Big Key (Eastern Palace)",
  "Big Key (Desert Palace)",
  "Small Key (Desert Palace)",
  "Big Key (Tower of Hera)",
  "Small Key (Tower of Hera)",
  "Big Key (Palace of Darkness)",
  ...times(6, "Small Key (Palace of Darkness)"),
  "Big Key (Thieves Town)",
  "Small Key (Thieves Town)",
  "Big Key (Skull Woods)",
  ...times(2, "Small Key (Skull Woods)"),
  "Big Key (Swamp Palace)",
  "Small Key (Swamp Palace)",
  "Big Key (Ice Palace)",
  ...times(2, "Small Key (Ice Palace)"),
  "Big Key (Misery Mire)",
  ...times(3, "Small Key (Misery Mire)"),
  "Big Key (Turtle Rock)",
  ...times(4, "Small Key (Turtle Rock)"),
  ...times(2, "Small Key (Agahnims Tower)"),
  "Big Key (Ganons Tower)",
  ...times(4, "Small Key (Ganons Tower)"),
  // TestDungeon.py:30
  "Green Pendant",
  "Red Pendant",
  "Blue Pendant",
  "Beat Agahnim 1",
  "Beat Agahnim 2",
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => `Crystal ${n}`),
];

/** The items of a case: those named, or the pool but some, then those. */
function itemsOf(
  fixture: ErFixture,
  items: readonly string[],
  allExcept: readonly string[] | undefined,
): readonly string[] {
  if (allExcept === undefined || allExcept.length === 0) return items;
  const pool = fixture.harness.pool ? DUNGEON_TEST_POOL : [];
  return [
    ...pool.filter(
      (name) =>
        !allExcept.includes(name) &&
        !(name.startsWith("Bottle") && allExcept.includes("AnyBottle")),
    ),
    ...items,
  ];
}

/** The connections a test's setUp makes. */
function connectionsOf(fixture: ErFixture): ErConnections {
  const { bombShop, connections } = fixture.harness;
  if (connections === "vanilla") return vanillaConnections();
  const made = new Map(mandatoryConnections());
  if (bombShop !== null) made.set(bombShop, "Big Bomb Shop");
  return made;
}

describe("the entrance randomizer's own tests", () => {
  it("are all imported: the Open world's, 510 cases", () => {
    expect(
      FIXTURES.flatMap((f) => f.tests).reduce((n, t) => n + t.cases.length, 0),
    ).toBe(510);
  });

  for (const fixture of FIXTURES) {
    for (const test of fixture.tests) {
      it(`hold for ${fixture.file} ${test.name}`, () => {
        const world = erWorld(OPEN, connectionsOf(fixture), {
          // The randomizer sweeps Agahnim's defeats in as events
          events: { defeatAgahnim: "Agahnim 1", defeatAgahnim2: "Agahnim 2" },
          marked: fixture.harness.marked,
          start: test.startingRegions,
          ...(fixture.harness.swampPatch === null
            ? {}
            : { swampPatch: fixture.harness.swampPatch }),
        });
        const failures = test.cases.flatMap(
          ([location, access, items, allExcept]) => {
            const got = solveFacts(
              world,
              collect(itemsOf(fixture, items, allExcept)),
            ).location(erLocationId(location));
            return contractHolds(access, got)
              ? []
              : [
                  `${location} ${access} with ${JSON.stringify(items)}${allExcept ? ` but ${JSON.stringify(allExcept)}` : ""}: ${got}`,
                ];
          },
        );
        expect(failures).toEqual([]);
      });
    }
  }
});
