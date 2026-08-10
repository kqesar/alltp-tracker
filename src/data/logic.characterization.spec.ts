import { describe, expect, it } from "vitest";
import { chests, dungeons, type ItemState } from "@/data/chests";
import { items as defaultItems } from "@/data/items";

/**
 * Characterization tests: they do not assert what the logic *should* say, they
 * freeze what it *currently* says. Their only job is to prove that refactoring
 * the data layer changes no observable outcome. If a snapshot moves, the
 * refactor changed game logic and must be fixed — never update the snapshot to
 * make it pass.
 */

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
  name: string;
  items: ItemState;
  medallions: number[];
}> = [
  { items: state(), medallions: noMedallions, name: "fresh start" },
  { items: everything, medallions: allMedallions, name: "everything" },
  {
    items: everything,
    medallions: noMedallions,
    name: "everything, medallions unknown",
  },
  {
    items: state({ boots: true, sword: 1 }),
    medallions: noMedallions,
    name: "boots and sword",
  },
  {
    items: state({ glove: 1, hammer: true, moonpearl: true }),
    medallions: noMedallions,
    name: "dark world entry via glove and hammer",
  },
  {
    items: state({ glove: 2, moonpearl: true }),
    medallions: noMedallions,
    name: "titans mitt and moonpearl",
  },
  {
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
    items: state({ moonpearl: true }),
    medallions: noMedallions,
    name: "moonpearl alone",
  },
  {
    items: state({ flute: true, glove: 2, mirror: true }),
    medallions: noMedallions,
    name: "flute, titans mitt and mirror",
  },
  {
    items: state({ book: true, firerod: true, glove: 1 }),
    medallions: noMedallions,
    name: "desert access",
  },
  {
    items: state({ hammer: true, hookshot: true, mirror: true }),
    medallions: noMedallions,
    name: "hera access",
  },
  {
    items: everything,
    medallions: [0, 0, 0, 0, 0, 0, 0, 0, 1, 2],
    name: "all medallions with mire bombos and turtle ether",
  },
  {
    items: state({ ...everything, bombos: true, ether: false, quake: false }),
    medallions: [0, 0, 0, 0, 0, 0, 0, 0, 2, 3],
    name: "bombos only against ether and quake gates",
  },
  {
    items: state({ ...everything, chest4: 2 }),
    medallions: allMedallions,
    name: "swamp palace down to two chests",
  },
  {
    items: state({ ...everything, bow: 0 }),
    medallions: allMedallions,
    name: "everything except the bow",
  },
];

describe("game logic characterization", () => {
  it.each(scenarios)("chest availability — $name", ({ items, medallions }) => {
    expect(
      chests.map((chest) => chest.isAvailable(items, medallions)),
    ).toMatchSnapshot();
  });

  it.each(scenarios)("dungeon chest access — $name", ({
    items,
    medallions,
  }) => {
    expect(
      dungeons.map((dungeon) => dungeon.canGetChest(items, medallions)),
    ).toMatchSnapshot();
  });

  it.each(scenarios)("dungeon beatable — $name", ({ items, medallions }) => {
    expect({
      withBigKeys: dungeons.map((dungeon) =>
        dungeon.isBeatable(items, medallions, true),
      ),
      withoutBigKeys: dungeons.map((dungeon) =>
        dungeon.isBeatable(items, medallions, false),
      ),
    }).toMatchSnapshot();
  });
});
