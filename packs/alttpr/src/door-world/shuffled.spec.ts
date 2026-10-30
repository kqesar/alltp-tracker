import type { Settings, State } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { solveFacts } from "../facts";
import { everything } from "../keys";
import { settingsFromUpstream } from "../settings";
import { DR_DATA } from "./data";
import {
  type DoorKindNote,
  type DoorNotes,
  type DoorShuffleSettings,
  doorId,
  isShuffledDoor,
  kindShuffled,
  portalId,
  vanillaKind,
} from "./doors";
import { DR_DEFAULTS, drLocationId, drWorld, KEY_ITEMS } from "./index";

type Mode = "open" | "standard";

const settings = (mode: Mode, more: Settings = {}): Settings => ({
  ...DR_DEFAULTS,
  ...settingsFromUpstream(mode),
  drVersion: 158,
  ...more,
});

const shuffle = (
  more: Partial<DoorShuffleSettings> = {},
): DoorShuffleSettings => ({
  decoupled: false,
  intensity: 2,
  shuffle: "basic",
  trapMode: "optional",
  ...more,
});

/**
 * The notes of a player whose seed kept every door where the vanilla
 * world has it (a layout DR may make): each shuffled door's vanilla pair,
 * each kind its room's, each portal on its own door.
 */
function vanillaNotes(s: DoorShuffleSettings): DoorNotes {
  const links: Record<string, string> = {};
  for (const table of [
    "default_door_connections",
    "default_one_way_connections",
    "spiral_staircases",
    "open_edges",
    "straight_staircases",
    "ladders",
  ])
    for (const [a, b] of DR_DATA.pairsOf("DoorShuffle.py", table)) {
      const one = DR_DATA.doors.find((d) => d.name === a);
      if (one === undefined || !isShuffledDoor(one, s)) continue;
      links[doorId(a)] = doorId(b);
      links[doorId(b)] = doorId(a);
    }
  const kinds: Record<string, DoorKindNote> = {};
  for (const door of DR_DATA.doors)
    if (kindShuffled(door, s)) kinds[doorId(door.name)] = vanillaKind(door);
  const lobbies = Object.fromEntries(
    DR_DATA.portals.map((p) => [portalId(p.name), doorId(p.door)]),
  );
  return { kinds, links, lobbies };
}

/** Each location's answer, by id. */
function answers(world: ReturnType<typeof drWorld>, state: State) {
  const solution = solveFacts(world, state);
  return new Map(
    [...world.locationIds.values()].map((id) => [id, solution.location(id)]),
  );
}

const BIG_CHEST = drLocationId("Eastern Palace - Big Chest");

/** A state with every key, thirty small keys of each dungeon. */
const keyed = (state: State): State => ({
  ...state,
  ...Object.fromEntries(
    KEY_ITEMS.map((item) => [item, item.startsWith("big") ? 1 : 30]),
  ),
});
const COMPASS = drLocationId("Eastern Palace - Compass Chest");

describe("DR's world on noted doors", () => {
  it("reaches what the vanilla world does once every door is noted vanilla", () => {
    for (const intensity of [1, 2, 3] as const) {
      const s = shuffle({ intensity });
      const world = drWorld(settings("open"), {
        doors: { notes: vanillaNotes(s), settings: s },
      });
      const vanilla = drWorld(settings("open"));
      const all = keyed(everything(settingsFromUpstream("open")));
      const noted = answers(world, all);
      const own = answers(vanilla, all);
      const differ = [...own].filter(
        ([id, answer]) => answer === "yes" && noted.get(id) !== "yes",
      );
      expect(differ, `intensity ${intensity}`).toEqual([]);
    }
  });

  it("leads a door no note names nowhere, never to a guess", () => {
    const s = shuffle();
    const all = everything(settingsFromUpstream("open"));
    const bare = drWorld(settings("open"), {
      doors: { notes: {}, settings: s },
    });
    const got = answers(bare, all);
    // The lobby's room, through its portal; nothing past its doors
    expect(got.get(COMPASS)).toBe("no");
    expect(got.get(BIG_CHEST)).toBe("no");
    expect(got.get(drLocationId("Link's Uncle"))).toBe("yes");
  });

  it("reads a kind not noted as maybe, and a noted trap as no way out", () => {
    const s = shuffle();
    const notes = vanillaNotes(s);
    const all = everything(settingsFromUpstream("open"));
    // Eastern's cannonball room leads on to its courtyard by a plain door
    const bridge = doorId("Eastern Cannonball N");
    const { [bridge]: _, ...unknown } = notes.kinds ?? {};
    const maybe = drWorld(settings("open"), {
      doors: { notes: { ...notes, kinds: unknown }, settings: s },
    });
    expect(answers(maybe, all).get(BIG_CHEST)).toBe("maybe");
    const plain = drWorld(settings("open"), {
      doors: {
        notes: { ...notes, kinds: { ...notes.kinds, [bridge]: "normal" } },
        settings: s,
      },
    });
    expect(answers(plain, all).get(BIG_CHEST)).toBe("yes");
  });

  it("asks a basic dungeon's key doors for all its keys, or maybe", () => {
    const s = shuffle();
    const notes = vanillaNotes(s);
    const world = drWorld(settings("open", { wildKeys: true }), {
      doors: { notes, settings: s },
    });
    // Hera's big key behind its key stairs, its one key in a chest
    const all = everything(settingsFromUpstream("open"));
    const keyless = Object.fromEntries(
      Object.entries(all).filter(([item]) => !/^key/.test(item)),
    );
    const location = drLocationId("Tower of Hera - Big Key Chest");
    expect(answers(world, keyless).get(location)).toBe("maybe");
    expect(answers(world, all).get(location)).toBe("yes");
  });

  it("puts a crossed room in the dungeon of the portal it is reached from", () => {
    const s = shuffle({ shuffle: "crossed" });
    const notes = vanillaNotes(s);
    // Eastern's lobby bridge leads into Ganon's Tower's big chest room
    const bridge = doorId("Eastern Lobby Bridge N");
    const tower = doorId("GT Big Chest SW");
    const world = drWorld(settings("open"), {
      doors: {
        notes: {
          ...notes,
          kinds: { ...notes.kinds, [bridge]: "normal" },
          links: { ...notes.links, [bridge]: tower, [tower]: bridge },
        },
        settings: s,
      },
    });
    expect(world.roomDungeons?.get("GT Big Chest")).toBe("Eastern Palace");
    expect(world.roomDungeons?.get("Eastern Lobby")).toBe("Eastern Palace");
    // A pool's key doors wait for the dungeon's count, noted
    const all = everything(settingsFromUpstream("open"));
    const counted = drWorld(settings("open"), {
      doors: {
        notes: { ...notes, keys: { "Eastern Palace": 2 } },
        settings: s,
      },
    });
    const location = drLocationId("Eastern Palace - Big Key Chest");
    expect(
      answers(
        drWorld(settings("open"), { doors: { notes, settings: s } }),
        all,
      ).get(location),
    ).toBe("maybe");
    expect(answers(counted, all).get(location)).toBe("yes");
  });

  it("floods a trench only once its pot is reached, maybe while its item is unknown", () => {
    // not_flooding_a_key (BaseClasses.py:1086-1093): the switch waits on
    // the trench's pot while it holds a key or a progress item. Trench 2's
    // far side (its Departure) and its switch reached, no door noted: the
    // pots past the water ask the flood, which the pot past them holds back
    const s = shuffle({ intensity: 1 });
    const start = ["Swamp Trench 2 Departure", "Swamp Crystal Switch Inner"];
    const all = keyed(everything(settingsFromUpstream("open")));
    const pot = drLocationId("Swamp Palace - Trench 2 Pot Key");
    for (const potKeys of [false, true]) {
      const world = drWorld(settings("open", { potKeys }), {
        doors: { notes: {}, settings: s },
        start,
      });
      expect(answers(world, all).get(pot), `pot keys ${potKeys}`).toBe("maybe");
    }
  });

  it("opens a portal on its noted lobby alone from intensity 3", () => {
    const s = shuffle({ intensity: 3 });
    const notes = vanillaNotes(s);
    const { [portalId("Eastern")]: _, ...others } = notes.lobbies ?? {};
    const world = drWorld(settings("open"), {
      doors: { notes: { ...notes, lobbies: others }, settings: s },
    });
    const all = everything(settingsFromUpstream("open"));
    expect(answers(world, all).get(COMPASS)).toBe("no");
  });
});
