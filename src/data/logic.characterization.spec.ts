import { describe, expect, it } from "vitest";
import { chests } from "@/data/chests";
import { dungeons } from "@/data/dungeons";
import { items as defaultItems } from "@/data/items";
import type { Availability, ItemState } from "@/data/logic";

/**
 * Characterization tests: they do not assert what the logic *should* say, they
 * freeze what it *currently* says. Their only job is to prove that refactoring
 * the data layer changes no observable outcome. If an expectation below moves,
 * the refactor changed game logic and must be fixed — never edit an expected
 * string to make the suite pass.
 *
 * Outcomes are encoded one character per chest or dungeon, in declaration
 * order, so a whole scenario stays readable and diffable on one line:
 * "a" available, "p" possible, "u" unavailable.
 */

const AVAILABILITY_CODES: Record<Availability, string> = {
  available: "a",
  possible: "p",
  unavailable: "u",
};

/** Collapses a list of availability results into its one-char-per-entry code. */
const encode = (results: Availability[]): string =>
  results.map((result) => AVAILABILITY_CODES[result]).join("");

/** Build a full item state from the defaults plus a few overrides. */
const state = (overrides: Record<string, number | boolean> = {}): ItemState =>
  ({ ...defaultItems, ...overrides }) as ItemState;

const allMedallions = [1, 2, 3, 0, 1, 2, 3, 0, 1, 2];
const noMedallions = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/** Every progression item switched on, at its highest level. */
const everything = state({
  agahnim: 1,
  bombos: true,
  book: true,
  boomerang: 3,
  boots: true,
  bottle: 4,
  bow: 3,
  byrna: true,
  cape: true,
  ether: true,
  firerod: true,
  flippers: true,
  flute: true,
  glove: 2,
  hammer: true,
  hookshot: true,
  icerod: true,
  lantern: true,
  mirror: true,
  moonpearl: true,
  mushroom: true,
  net: true,
  powder: true,
  quake: true,
  shield: 3,
  shovel: true,
  somaria: true,
  sword: 4,
  tunic: 3,
});

const scenarios: Array<{
  expected: {
    beatableWithBigKeys: string;
    beatableWithoutBigKeys: string;
    chests: string;
    dungeonChests: string;
  };
  items: ItemState;
  medallions: number[];
  name: string;
}> = [
  {
    expected: {
      beatableWithBigKeys: "uuuuuuuuuu",
      beatableWithoutBigKeys: "uuuuuuuuuu",
      chests:
        "uaauuaauuauuauaauuuuaauuuauuuuuuuuuuuapuuuuupauuapuuuuuuuaaauuuua",
      dungeonChests: "puuuuuuuuu",
    },
    items: state(),
    medallions: noMedallions,
    name: "fresh start",
  },
  {
    expected: {
      beatableWithBigKeys: "uuuuuuuuuu",
      beatableWithoutBigKeys: "aaaaaaaaaa",
      chests:
        "aaaaaaaaaaaaaaaaaaaaaaaaaauaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaapa",
      dungeonChests: "aaaaaaaaaa",
    },
    items: everything,
    medallions: allMedallions,
    name: "everything",
  },
  {
    expected: {
      beatableWithBigKeys: "uuuuuuuuuu",
      beatableWithoutBigKeys: "aaaaaaaaaa",
      chests:
        "aaaaaaaaaaaaaaaaaaaaaaaaaauaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaapa",
      dungeonChests: "aaaaaaaaaa",
    },
    items: everything,
    medallions: noMedallions,
    name: "everything, medallions unknown",
  },
  {
    expected: {
      beatableWithBigKeys: "uuuuuuuuuu",
      beatableWithoutBigKeys: "uuuuuuuuuu",
      chests:
        "uaauuaauuauuauaauuaaaauuuauuuuuuuuuuuapuuuuuaauuapuuuuuuuaaauuuua",
      dungeonChests: "puuuuuuuuu",
    },
    items: state({ boots: true, sword: 1 }),
    medallions: noMedallions,
    name: "boots and sword",
  },
  {
    expected: {
      beatableWithBigKeys: "uuuuuuuuuu",
      beatableWithoutBigKeys: "uuuuuuauuu",
      chests:
        "uaauuaaaaauuaaaaauuuaauuaauauuuuuaaauapauuuupapuapupaapuaaaauuaua",
      dungeonChests: "puupupauuu",
    },
    items: state({ glove: 1, hammer: true, moonpearl: true }),
    medallions: noMedallions,
    name: "dark world entry via glove and hammer",
  },
  {
    expected: {
      beatableWithBigKeys: "uuuuuuuuuu",
      beatableWithoutBigKeys: "uuuuuuauuu",
      chests:
        "uaauuaaaaauuauaaauuuaauuaauauuuuuuaauapauuuupapuapupuapuaaaauuuua",
      dungeonChests: "puuuupauuu",
    },
    items: state({ glove: 2, moonpearl: true }),
    medallions: noMedallions,
    name: "titans mitt and moonpearl",
  },
  {
    expected: {
      beatableWithBigKeys: "uuuuuuuuuu",
      beatableWithoutBigKeys: "uuuuuuauuu",
      chests:
        "uaauuaaaaauuauaaauuuaauuaauauuauuuauuapuuuuupauuapppaaauuaaauuuua",
      dungeonChests: "puupupauuu",
    },
    items: state({
      agahnim: 1,
      flippers: true,
      hookshot: true,
      moonpearl: true,
    }),
    medallions: noMedallions,
    name: "post agahnim with hookshot",
  },
  {
    expected: {
      beatableWithBigKeys: "uuuuuuuuuu",
      beatableWithoutBigKeys: "uuuuuuuuuu",
      chests:
        "uaauuaauuauuauaauuuuaauuuauuuuuuuuuuuapuuuuupauuapuuuuuuuaaauuuua",
      dungeonChests: "puuuuuuuuu",
    },
    items: state({ moonpearl: true }),
    medallions: noMedallions,
    name: "moonpearl alone",
  },
  {
    expected: {
      beatableWithBigKeys: "uuuuuuuuuu",
      beatableWithoutBigKeys: "uupuuuuuuu",
      chests:
        "uaauuaauuauuauaauuuuaauuuauuuuuuuuaauapauuaupaauaauuuupuaaaauuuua",
      dungeonChests: "pppuuuuuuu",
    },
    items: state({ flute: true, glove: 2, mirror: true }),
    medallions: noMedallions,
    name: "flute, titans mitt and mirror",
  },
  {
    expected: {
      beatableWithBigKeys: "uuuuuuuuuu",
      beatableWithoutBigKeys: "upuuuuuuuu",
      chests:
        "uaauuaauuauuauaauuuuaauuuauuuuuuuuaauapauuuupapuaauuuupuaaaauuupa",
      dungeonChests: "ppuuuuuuuu",
    },
    items: state({ book: true, firerod: true, glove: 1 }),
    medallions: noMedallions,
    name: "desert access",
  },
  {
    expected: {
      beatableWithBigKeys: "uuuuuuuuuu",
      beatableWithoutBigKeys: "uuuuuuuuuu",
      chests:
        "uaauuaauuauuauaauuuuaauuuauuuuuuuuuuuapuuuuupauuapuuuuuuuaaauuuua",
      dungeonChests: "puuuuuuuuu",
    },
    items: state({ hammer: true, hookshot: true, mirror: true }),
    medallions: noMedallions,
    name: "hera access",
  },
  {
    expected: {
      beatableWithBigKeys: "uuuuuuuuuu",
      beatableWithoutBigKeys: "aaaaaaaaaa",
      chests:
        "aaaaaaaaaaaaaaaaaaaaaaaaaauaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaapa",
      dungeonChests: "aaaaaaaaaa",
    },
    items: everything,
    medallions: [0, 0, 0, 0, 0, 0, 0, 0, 1, 2],
    name: "all medallions with mire bombos and turtle ether",
  },
  {
    expected: {
      beatableWithBigKeys: "uuuuuuuuuu",
      beatableWithoutBigKeys: "aaaaaaaauu",
      chests:
        "aaaauaaaaaaaaaaaaaaaaaaaaauaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaapa",
      dungeonChests: "aaaaaaaauu",
    },
    items: state({ ...everything, bombos: true, ether: false, quake: false }),
    medallions: [0, 0, 0, 0, 0, 0, 0, 0, 2, 3],
    name: "bombos only against ether and quake gates",
  },
  {
    expected: {
      beatableWithBigKeys: "uuuuuuuuuu",
      beatableWithoutBigKeys: "aaaaaaaaaa",
      chests:
        "aaaaaaaaaaaaaaaaaaaaaaaaaauaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaapa",
      dungeonChests: "aaaaaaaaaa",
    },
    items: state({ ...everything, chest4: 2 }),
    medallions: allMedallions,
    name: "swamp palace down to two chests",
  },
  {
    expected: {
      beatableWithBigKeys: "uuuuuuuuuu",
      beatableWithoutBigKeys: "uaauaaaaaa",
      chests:
        "aaaaaaaaaaaaaaaaaaaaaaaaaauaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaapa",
      dungeonChests: "paapaaaaaa",
    },
    items: state({ ...everything, bow: 0 }),
    medallions: allMedallions,
    name: "everything except the bow",
  },
];

describe("game logic characterization", () => {
  it.each(scenarios)(
    "chest availability — $name",
    ({ expected, items, medallions }) => {
      expect(
        encode(chests.map((chest) => chest.isAvailable(items, medallions))),
      ).toBe(expected.chests);
    },
  );

  it.each(scenarios)(
    "dungeon chest access — $name",
    ({ expected, items, medallions }) => {
      expect(
        encode(
          dungeons.map((dungeon) => dungeon.canGetChest(items, medallions)),
        ),
      ).toBe(expected.dungeonChests);
    },
  );

  it.each(scenarios)(
    "dungeon beatable — $name",
    ({ expected, items, medallions }) => {
      expect(
        encode(dungeons.map((d) => d.isBeatable(items, medallions, true))),
      ).toBe(expected.beatableWithBigKeys);
      expect(
        encode(dungeons.map((d) => d.isBeatable(items, medallions, false))),
      ).toBe(expected.beatableWithoutBigKeys);
    },
  );

  it("covers every chest and dungeon in each expectation", () => {
    for (const { expected, name } of scenarios) {
      expect(expected.chests, name).toHaveLength(chests.length);
      expect(expected.dungeonChests, name).toHaveLength(dungeons.length);
      expect(expected.beatableWithBigKeys, name).toHaveLength(dungeons.length);
      expect(expected.beatableWithoutBigKeys, name).toHaveLength(
        dungeons.length,
      );
    }
  });
});
