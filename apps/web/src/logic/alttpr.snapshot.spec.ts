import { MARKED_DUNGEONS, MARKERS } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { items as defaultItems, type ItemState } from "@/data/items";
import { getPreset } from "@/data/presets";
import {
  bossStateOf,
  dungeonStateOf,
  type MarkerState,
  markerStateOf,
} from "@/logic/solution";

/**
 * A refactor guard: what the map shows, as the alltpr pack computes it, over
 * the 15 item states the 2017 logic's characterization spec froze, in an
 * Open run. It does not assert what the rules *should* say (the pack's
 * upstream tests do); it freezes what the app shows, so that a change to the
 * app's wiring (the store's items read as the pack's, the settings, the key
 * model, the pigeonhole rule) cannot move a marker unnoticed.
 *
 * Never update an expected string to make the suite pass. If one moves
 * without an intended rule change, the change is wrong. An intended change
 * (a rule ported from upstream, a pack fix) updates it in the same commit,
 * and the commit message names each marker that moved and the upstream
 * source of its rule.
 *
 * Each state is one line per kind, one character per marker or dungeon, in
 * the order of the pack's MARKERS (63 location markers, then the dungeons:
 * their square, the counter) and MARKED_DUNGEONS (their boss): "a"
 * available, "p" possible, "u" unavailable, "o" done.
 */

const CODES: Record<MarkerState, string> = {
  available: "a",
  opened: "o",
  possible: "p",
  unavailable: "u",
};

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
  expected: { bosses: string; markers: string };
  items: ItemState;
  medallions: number[];
  name: string;
}> = [
  {
    expected: {
      bosses: "uuuuuuuuuuuu",
      markers:
        "uaauuaauuauuauaauuuaauuuauuuuuuuuuuuauuuuuuuauuauuuuuuuuapauuuupuuuuuuuuuuou",
    },
    items: state(),
    medallions: noMedallions,
    name: "fresh start",
  },
  {
    expected: {
      bosses: "aaaoaaaaaaau",
      markers:
        "aaaaaaaaaaaaaaaaaaaaaaaaauaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaauuaaaaaaaaaaaou",
    },
    items: everything,
    medallions: allMedallions,
    name: "everything",
  },
  {
    expected: {
      bosses: "aaaoaaaaaaau",
      markers:
        "aaaaaaaaaaaaaaaaaaaaaaaaauaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaauuaaaaaaaaaaaou",
    },
    items: everything,
    medallions: noMedallions,
    name: "everything, medallions unknown",
  },
  {
    expected: {
      bosses: "uuuuuuuuuuuu",
      markers:
        "uaauuaauuauuauaauuaaauuuauuuuuuuuuuuauuuuuuaauuauuuuuuuuapauuuupuuuuuuuuuuou",
    },
    items: state({ boots: true, sword: 1 }),
    medallions: noMedallions,
    name: "boots and sword",
  },
  {
    expected: {
      bosses: "uuuuuuuauuuu",
      markers:
        "uaauuaaaaauuauaaauuaauuaauauuuuuaauuauuuuuuuauuauuuaauuaapauuuupuupupauuuuou",
    },
    items: state({ glove: 1, hammer: true, moonpearl: true }),
    medallions: noMedallions,
    name: "dark world entry via glove and hammer",
  },
  {
    expected: {
      bosses: "uuuuuuuuuuuu",
      markers:
        "uaauuaaaaauuauaaauuaauuaauauauuuuauuauuuuuuuauuauuuuauuaapauauupuuuupauuuuou",
    },
    items: state({ glove: 2, moonpearl: true }),
    medallions: noMedallions,
    name: "titans mitt and moonpearl",
  },
  {
    expected: {
      bosses: "uuuouuuuuuuu",
      markers:
        "uaauuaaaaauuauaaauuaauuaauauuauuuauuauuuuuuuauuauuuaaauuapauuuupuupupauuuaou",
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
      bosses: "uuuuuuuuuuuu",
      markers:
        "uaauuaauuauuauaauuuaauuuauuuuuuuuuuuauuuuuuuauuauuuuuuuuapauuuupuuuuuuuuuuou",
    },
    items: state({ moonpearl: true }),
    medallions: noMedallions,
    name: "moonpearl alone",
  },
  {
    expected: {
      bosses: "uuuuuuuuuuuu",
      markers:
        "uaauuaauuauuauaauuuaauuuauuuuuuuuauuauauuauuaauaauuuuuuaapauuuupppuuuuuuuuou",
    },
    items: state({ flute: true, glove: 2, mirror: true }),
    medallions: noMedallions,
    name: "flute, titans mitt and mirror",
  },
  {
    expected: {
      bosses: "upuuuuuuuuuu",
      markers:
        "uaauuaauuauuauaauuuaauuuauuuuuuuuauuauuuuuuuauuaauuuuuuaaaauuuuppuuuuuuuuuou",
    },
    items: state({ book: true, firerod: true, glove: 1 }),
    medallions: noMedallions,
    name: "desert access",
  },
  {
    expected: {
      bosses: "uuuuuuuuuuuu",
      markers:
        "uaauuaauuauuauaauuuaauuuauuuuuuuuuuuauuuuuuuauuauuuuuuuuapauuuupuuuuuuuuuuou",
    },
    items: state({ hammer: true, hookshot: true, mirror: true }),
    medallions: noMedallions,
    name: "hera access",
  },
  {
    expected: {
      bosses: "aaaoaaaaaaau",
      markers:
        "aaaaaaaaaaaaaaaaaaaaaaaaauaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaauuaaaaaaaaaaaou",
    },
    items: everything,
    medallions: [0, 0, 0, 0, 0, 0, 0, 0, 1, 2],
    name: "all medallions with mire bombos and turtle ether",
  },
  {
    expected: {
      bosses: "aaaoaaaaauuu",
      markers:
        "aaaauaaaaaaaaaaaaaaaaaaaauaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaauuaaaaaaaauuaou",
    },
    items: state({ ...everything, bombos: true, ether: false, quake: false }),
    medallions: [0, 0, 0, 0, 0, 0, 0, 0, 2, 3],
    name: "bombos only against ether and quake gates",
  },
  {
    expected: {
      bosses: "aaaoaaaaaaau",
      markers:
        "aaaaaaaaaaaaaaaaaaaaaaaaauaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaauuaaaaaaaaaaaou",
    },
    items: state({ ...everything, chest4: 2 }),
    medallions: allMedallions,
    name: "swamp palace down to two chests",
  },
  {
    expected: {
      bosses: "uaaouaaaaaau",
      markers:
        "aaaaaaaaaaaaaaaaaaaaaaaaauaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaauuaaapaaaaaaaou",
    },
    items: state({ ...everything, bow: 0 }),
    medallions: allMedallions,
    name: "everything except the bow",
  },
];

/** What the map shows for a state: its markers, and its dungeons' bosses. */
const shown = (items: ItemState, medallions: number[]) => {
  const run = {
    checked: {},
    items,
    medallions,
    settings: getPreset("open").settings,
    smallKeys: Array(10).fill(0),
  };
  return {
    bosses: MARKED_DUNGEONS.map((id) => CODES[bossStateOf(id, run)]).join(""),
    markers: MARKERS.map(
      (marker) =>
        CODES[
          marker.dungeon === undefined
            ? markerStateOf(marker, run)
            : dungeonStateOf(marker.dungeon, run)
        ],
    ).join(""),
  };
};

describe("what the map shows, by the alttpr pack", () => {
  it.each(scenarios)("$name", ({ expected, items, medallions }) => {
    expect(shown(items, medallions)).toEqual(expected);
  });

  it("covers every marker and dungeon in each expectation", () => {
    for (const { expected, name } of scenarios) {
      expect(expected.markers, name).toHaveLength(MARKERS.length);
      expect(expected.bosses, name).toHaveLength(MARKED_DUNGEONS.length);
    }
  });
});
