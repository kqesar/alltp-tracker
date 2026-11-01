import type { Settings, State } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { vanillaDoorNotes, vanillaLayoutNotes } from "../../test/dr-doors";
import { solveFacts } from "../facts";
import { everything } from "../keys";
import { settingsFromUpstream } from "../settings";
import { vanillaConnections } from "./connections";
import {
  type DoorKindNote,
  type DoorNotes,
  type DoorShuffleSettings,
  doorId,
  portalId,
} from "./doors";
import { DR_DATA } from "./dr-data";
import {
  DR_DEFAULTS,
  drKeyLogic,
  drLocationId,
  drWorld,
  KEY_ITEMS,
} from "./index";
import type { KeyRules } from "./key-analysis/analysis";
import { accessibleEntrances, forgetNotedKeyLogic } from "./key-analysis/noted";
import { ALTERNATIVE_CRYSTAL_DOORS } from "./keys";
import { type OwrNotes, screensOf } from "./overworld";
import { OWR_DATA } from "./owr-data";
import { roomDungeons } from "./shuffle";

type Mode = "open" | "standard" | "inverted";

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
        data: DR_DATA,
        doors: { notes: vanillaDoorNotes(s, DR_DATA), settings: s },
      });
      const vanilla = drWorld(settings("open"), { data: DR_DATA });
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
      data: DR_DATA,
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
    const notes = vanillaDoorNotes(s, DR_DATA);
    const all = everything(settingsFromUpstream("open"));
    // Eastern's cannonball room leads on to its courtyard by a plain door
    const bridge = doorId("Eastern Cannonball N");
    const { [bridge]: _, ...unknown } = notes.kinds ?? {};
    const maybe = drWorld(settings("open"), {
      data: DR_DATA,
      doors: { notes: { ...notes, kinds: unknown }, settings: s },
    });
    expect(answers(maybe, all).get(BIG_CHEST)).toBe("maybe");
    const plain = drWorld(settings("open"), {
      data: DR_DATA,
      doors: {
        notes: { ...notes, kinds: { ...notes.kinds, [bridge]: "normal" } },
        settings: s,
      },
    });
    expect(answers(plain, all).get(BIG_CHEST)).toBe("yes");
  });

  it("asks a basic dungeon's key doors for all its keys, or maybe", () => {
    const s = shuffle();
    const notes = vanillaDoorNotes(s, DR_DATA);
    const world = drWorld(settings("open", { wildKeys: true }), {
      data: DR_DATA,
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
    const notes = vanillaDoorNotes(s, DR_DATA);
    // Eastern's lobby bridge leads into Ganon's Tower's big chest room
    const bridge = doorId("Eastern Lobby Bridge N");
    const tower = doorId("GT Big Chest SW");
    const world = drWorld(settings("open"), {
      data: DR_DATA,
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
    // From intensity 3 (lobbies DR picks, portals it marks at random) a
    // pool's key doors are strict-safe: they wait for the dungeon's count
    const all = everything(settingsFromUpstream("open"));
    const s3 = shuffle({ intensity: 3, shuffle: "crossed" });
    const notes3 = vanillaDoorNotes(s3, DR_DATA);
    const counted = drWorld(settings("open"), {
      data: DR_DATA,
      doors: {
        notes: { ...notes3, keys: { "Eastern Palace": 2 } },
        settings: s3,
      },
    });
    const location = drLocationId("Eastern Palace - Big Key Chest");
    const uncounted = drWorld(settings("open"), {
      data: DR_DATA,
      doors: { notes: notes3, settings: s3 },
    });
    expect(uncounted.doorKeyLogic?.size).toBe(0);
    expect(answers(uncounted, all).get(location)).toBe("maybe");
    expect(answers(counted, all).get(location)).toBe("yes");
    // Below 3, the layout noted whole, DR's own analysis asks its keys
    // with no count noted (the key doors' own, calc_max_chests)
    const analysed = drWorld(settings("open"), {
      data: DR_DATA,
      doors: { notes, settings: s },
    });
    expect(analysed.doorKeyLogic?.has("Eastern Palace")).toBe(true);
    expect(answers(analysed, all).get(location)).toBe("yes");
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
        data: DR_DATA,
        doors: { notes: {}, settings: s },
        start,
      });
      expect(answers(world, all).get(pot), `pot keys ${potKeys}`).toBe("maybe");
    }
  });

  it("opens a portal on its noted lobby alone from intensity 3", () => {
    const s = shuffle({ intensity: 3 });
    const notes = vanillaDoorNotes(s, DR_DATA);
    const { [portalId("Eastern")]: _, ...others } = notes.lobbies ?? {};
    const world = drWorld(settings("open"), {
      data: DR_DATA,
      doors: { notes: { ...notes, lobbies: others }, settings: s },
    });
    const all = everything(settingsFromUpstream("open"));
    expect(answers(world, all).get(COMPASS)).toBe("no");
  });

  it("gives a room joined only to a drop's landing the drop's dungeon", () => {
    // dungeon_drops (DungeonGenerator.py:4239-4242): Skull Woods is built
    // from its holes as from a lobby. avianart kxnOoGUE9 (OWR, partitioned)
    // joins Swamp's map ledge to Skull Pinball alone, @ Skull Woods
    const rooms = roomDungeons(
      DR_DATA,
      [
        { from: "Skull Pinball", to: "Swamp Map Ledge" },
        { from: "Swamp Map Ledge", to: "Skull Pinball" },
      ],
      new Map(),
      {
        notes: {},
        settings: {
          decoupled: false,
          intensity: 3,
          shuffle: "partitioned",
          trapMode: "oneway",
        },
      },
    );
    expect(rooms.get("Swamp Map Ledge")).toBe("Skull Woods");
    expect(rooms.get("Swamp Lobby")).toBe("Swamp Palace");
  });
});

describe("DR's key analysis on a noted door shuffle", () => {
  /** Each door rule's numbers, by door: what a key door asks. */
  const rulesOf = (
    logic: KeyRules | undefined,
    leave: readonly string[] = [],
  ) =>
    Object.fromEntries(
      [...(logic?.doorRules ?? [])]
        .filter(([door]) => !leave.includes(door))
        .map(([door, rule]) => [
          door,
          [rule.smallKeyNum, rule.worstCase, rule.allowSmall, rule.lockNum],
        ]),
    );
  /**
   * vanilla_key_logic's own adjustments (DoorShuffle.py:282-316), for
   * vanilla doors alone: the escape's three doors, the Palace of
   * Darkness's front door, Misery Mire's blue barriers.
   */
  const ADJUSTED: Readonly<Record<string, readonly string[]>> = {
    "Hyrule Castle": [
      "Sewers Secret Room Key Door S",
      "Hyrule Dungeon Map Room Key Door S",
      "Sewers Dark Cross Key Door N",
    ],
    "Misery Mire": [...ALTERNATIVE_CRYSTAL_DOORS],
    "Palace of Darkness": ["PoD Middle Cage N"],
  };

  it("reads a layout noted as the vanilla one as DR's vanilla analysis, but its hand adjustments", () => {
    const s = shuffle();
    const world = drWorld(settings("open"), {
      data: DR_DATA,
      doors: { notes: vanillaLayoutNotes(s, DR_DATA), settings: s },
    });
    const vanilla = drKeyLogic(DR_DATA, settings("open"));
    expect([...(world.doorKeyLogic?.keys() ?? [])]).toEqual([
      ...vanilla.keys(),
    ]);
    for (const [dungeon, logic] of vanilla) {
      const noted = world.doorKeyLogic?.get(dungeon);
      expect(rulesOf(noted, ADJUSTED[dungeon]), dungeon).toEqual(
        rulesOf(logic, ADJUSTED[dungeon]),
      );
      expect(noted?.layout.maxChests, dungeon).toBe(logic.layout.maxChests);
    }
    // Where DR's hand moves a door, the analysis's own number stands
    expect(
      world.doorKeyLogic
        ?.get("Palace of Darkness")
        ?.doorRules.get("PoD Middle Cage N")?.smallKeyNum,
    ).toBe(6);
  });

  it("keeps each analysis without the key world it was walked on", () => {
    const s = shuffle();
    const world = drWorld(settings("open"), {
      data: DR_DATA,
      doors: { notes: vanillaLayoutNotes(s, DR_DATA), settings: s },
    });
    // Every object an entry reaches: none a region or a door of the world
    // (a KDoor's `to`, a region's `doors`), whose graph reaches all of it
    const seen = new Set<object>();
    const walk = (value: unknown): void => {
      if (typeof value !== "object" || value === null || seen.has(value))
        return;
      seen.add(value);
      expect(value).not.toHaveProperty("to");
      expect(value).not.toHaveProperty("doors");
      expect(value).not.toHaveProperty("world");
      const children =
        value instanceof Map
          ? [...value.keys(), ...value.values()]
          : value instanceof Set || Array.isArray(value)
            ? [...value]
            : Object.values(value);
      for (const child of children) walk(child);
    };
    expect(world.doorKeyLogic?.size).toBe(13);
    for (const logic of world.doorKeyLogic?.values() ?? []) walk(logic);
    // A few thousand small objects in all, against the world's tens of
    // thousands
    expect(seen.size).toBeLessThan(5_000);
  });

  it("tells a lobby the start walk finds only past Skull Pinball's trap as uncertain", () => {
    const s = shuffle();
    const vanilla = vanillaConnections(DR_DATA, "open", 156, {
      notes: vanillaLayoutNotes(s, DR_DATA),
      settings: s,
    });
    const walkOf = (connections: ReadonlyMap<string, string>) =>
      accessibleEntrances(
        DR_DATA,
        "open",
        connections,
        s,
        new Set(),
        screensOf("open"),
      ).reached(new Set([lobby]), new Set());
    const lobby = vanilla.get("Eastern Palace") ?? "";
    expect(walkOf(vanilla)).toEqual({ certain: true, found: new Set([lobby]) });
    // Eastern's door from outside leads back out: the walk misses its
    // lobby, and knows it
    const shut = new Map(vanilla).set("Eastern Palace", "Eastern Palace Area");
    expect(walkOf(shut)).toEqual({ certain: true, found: new Set() });
    // The lobby only past the trap DR opens once its generator used the
    // pinball room (DungeonGenerator.py:170-178), which no note tells
    const past = new Map(shut).set("Skull Pinball WS", lobby);
    expect(walkOf(past)).toEqual({ certain: false, found: new Set() });
  });

  it("leaves a dungeon strict-safe while a door of its layout or a kind is not noted", () => {
    const s = shuffle();
    const notes = vanillaLayoutNotes(s, DR_DATA);
    const build = (more: Partial<DoorNotes>) =>
      drWorld(settings("open"), {
        data: DR_DATA,
        doors: { notes: { ...notes, ...more }, settings: s },
      }).doorKeyLogic;
    // A link left out, both its ways
    const links: Record<string, string> = { ...notes.links };
    const door = doorId("Eastern Big Key NE");
    const partner = links[door] ?? "";
    delete links[door];
    delete links[partner];
    const unlinked = build({ links });
    expect(unlinked?.has("Eastern Palace")).toBe(false);
    expect(unlinked?.has("Tower of Hera")).toBe(true);
    const kinds: Record<string, DoorKindNote> = { ...notes.kinds };
    delete kinds[doorId("Hera Lobby Key Stairs")];
    expect(build({ kinds })?.has("Tower of Hera")).toBe(false);
  });

  it("works a dungeon's analysis out again only when its own layout's notes change", () => {
    const s = shuffle({ shuffle: "crossed" });
    const notes = vanillaLayoutNotes(s, DR_DATA);
    const build = (kinds: DoorNotes["kinds"]) =>
      drWorld(settings("open"), {
        data: DR_DATA,
        doors: { notes: { ...notes, kinds }, settings: s },
      }).doorKeyLogic ?? new Map();
    forgetNotedKeyLogic();
    const before = build(notes.kinds);
    // Eastern's big key door noted plain: Eastern's analysis moves, no other
    const after = build({
      ...notes.kinds,
      [doorId("Eastern Big Key NE")]: "normal",
    });
    expect(after.get("Eastern Palace")).not.toBe(before.get("Eastern Palace"));
    expect(after.get("Eastern Palace")?.bkDoors.size).toBeLessThan(
      before.get("Eastern Palace")?.bkDoors.size ?? 0,
    );
    for (const [dungeon, logic] of before)
      if (dungeon !== "Eastern Palace")
        expect(after.get(dungeon), dungeon).toBe(logic);
    // Noted back: the analysis kept is the one first worked out
    expect(build(notes.kinds).get("Eastern Palace")).toBe(
      before.get("Eastern Palace"),
    );
  });

  it("runs no analysis from intensity 3 or with decoupled doors", () => {
    const run = (s: DoorShuffleSettings, more = {}) =>
      drWorld(settings("open"), {
        data: DR_DATA,
        doors: { notes: vanillaLayoutNotes(s, DR_DATA), settings: s },
        ...more,
      }).doorKeyLogic;
    expect(run(shuffle({ intensity: 3 }))?.size).toBe(0);
    expect(run(shuffle({ decoupled: true }))?.size).toBe(0);
    expect(run(shuffle({ shuffle: "crossed" }))?.size).toBe(13);
    // Shuffled entrances, none noted yet: DR's portals follow them
    expect(
      run(shuffle(), {
        entrances: {
          noted: {},
          pool: {
            dropShuffle: "none",
            enemyShuffle: false,
            mode: "open",
            pottery: "none",
            shopsanity: false,
            shuffleLinks: false,
            shuffleTavern: false,
          },
          shuffle: "crossed",
        },
      }),
    ).toBeUndefined();
    // Standard's escape starts from its courtyard and Zelda (std_flag)
    expect(
      drWorld(settings("standard"), {
        data: DR_DATA,
        doors: {
          notes: vanillaLayoutNotes(shuffle(), DR_DATA),
          settings: shuffle(),
        },
      }).doorKeyLogic?.has("Hyrule Castle"),
    ).toBe(false);
  });

  it("reads a layout noted as the vanilla one in the fork's world as its vanilla analysis, but its hand adjustments", () => {
    // The fork's analysis is DR's (owr:KeyDoorShuffle.py), on its own data
    // and its screens: its walks start where the screens put Link, its
    // destinations stand by screen (owr:DoorShuffle.py:99-110)
    for (const mode of ["open", "inverted"] as const) {
      const s = shuffle();
      const run = settings(
        mode,
        mode === "inverted" ? { invertedMode: true } : {},
      );
      const world = drWorld(run, {
        data: OWR_DATA,
        doors: { notes: vanillaLayoutNotes(s, OWR_DATA), settings: s },
      });
      const vanilla = drKeyLogic(OWR_DATA, run);
      expect([...(world.doorKeyLogic?.keys() ?? [])], mode).toEqual([
        ...vanilla.keys(),
      ]);
      for (const [dungeon, logic] of vanilla) {
        const noted = world.doorKeyLogic?.get(dungeon);
        expect(
          rulesOf(noted, ADJUSTED[dungeon]),
          `${mode}: ${dungeon}`,
        ).toEqual(rulesOf(logic, ADJUSTED[dungeon]));
        expect(noted?.layout.maxChests, dungeon).toBe(logic.layout.maxChests);
      }
    }
  });

  it("waits for the fork's overworld to be noted whole", () => {
    const s = shuffle();
    const build = (overworld: OwrNotes) =>
      drWorld(settings("open"), {
        data: OWR_DATA,
        doors: { notes: vanillaLayoutNotes(s, OWR_DATA), settings: s },
        overworld,
      }).doorKeyLogic?.size;
    // Whirlpools shuffled, none noted: a way the walks need may be one
    expect(build({ whirlpools: {} })).toBe(0);
    // Every one noted, as the vanilla world pairs them
    const whirlpools: Record<string, string> = {};
    const pairs = OWR_DATA.tableOf<unknown>(
      "OverworldShuffle.py",
      "default_whirlpool_connections",
    ) as unknown as readonly (readonly [
      readonly [number, string, string],
      readonly [number, string, string],
    ])[];
    for (const [a, b] of pairs) {
      whirlpools[a[1]] = b[1];
      whirlpools[b[1]] = a[1];
    }
    expect(build({ whirlpools })).toBe(13);
    // DR's own world reads no overworld note: analysed as before
    expect(
      drWorld(settings("open"), {
        data: DR_DATA,
        doors: { notes: vanillaLayoutNotes(s, DR_DATA), settings: s },
      }).doorKeyLogic?.size,
    ).toBe(13);
  });

  it("keeps strict-safe a dungeon with a prize entered from Ganon's Tower's door among others", () => {
    // prize_relevance (KeyDoorShuffle.py:1519-1525): that start stays shut
    // until the dungeon's prize (create_key_counters, :1789-1797), a walk
    // the port does not make. Crossed: Ganon's Tower's lobby stairs down
    // into Eastern's dark room, Eastern's attic into the tower's torch
    // room, so Eastern's layout holds both lobbies, each a start
    const s = shuffle({ shuffle: "crossed" });
    const notes = vanillaLayoutNotes(s, DR_DATA);
    const link = (pairs: readonly (readonly [string, string])[]) => {
      const links: Record<string, string> = { ...notes.links };
      for (const [a, b] of pairs) {
        links[doorId(a)] = doorId(b);
        links[doorId(b)] = doorId(a);
      }
      return links;
    };
    const world = drWorld(settings("open"), {
      data: DR_DATA,
      doors: {
        notes: {
          ...notes,
          links: link([
            ["GT Lobby Left Down Stairs", "Eastern Darkness Up Stairs"],
            ["GT Torch Up Stairs", "Eastern Attic Start Down Stairs"],
          ]),
        },
        settings: s,
      },
    });
    expect(world.roomDungeons?.get("GT Lobby")).toBe("Eastern Palace");
    expect(world.roomDungeons?.get("Eastern Lobby")).toBe("Eastern Palace");
    expect(world.doorKeyLogic?.has("Eastern Palace")).toBe(false);
    expect(world.doorKeyLogic?.has("Tower of Hera")).toBe(true);
  });
});
