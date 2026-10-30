import type { Settings, State } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { solveFacts } from "../facts";
import { everything } from "../keys";
import { settingsFromUpstream } from "../settings";
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
import { DR_DATA } from "./dr-data";
import {
  DR_DEFAULTS,
  drKeyLogic,
  drLocationId,
  drWorld,
  KEY_ITEMS,
} from "./index";
import type { KeyLogic } from "./key-analysis/analysis";
import { forgetNotedKeyLogic } from "./key-analysis/noted";
import { ALTERNATIVE_CRYSTAL_DOORS, UGLY_SMALLS } from "./keys";
import { OWR_DATA } from "./owr-data";

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
      if (one === undefined || !isShuffledDoor(one, s, DR_DATA)) continue;
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
        data: DR_DATA,
        doors: { notes: vanillaNotes(s), settings: s },
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
    const notes = vanillaNotes(s);
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
    const notes = vanillaNotes(s);
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
    const notes = vanillaNotes(s);
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
    const notes3 = vanillaNotes(s3);
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
    const notes = vanillaNotes(s);
    const { [portalId("Eastern")]: _, ...others } = notes.lobbies ?? {};
    const world = drWorld(settings("open"), {
      data: DR_DATA,
      doors: { notes: { ...notes, lobbies: others }, settings: s },
    });
    const all = everything(settingsFromUpstream("open"));
    expect(answers(world, all).get(COMPASS)).toBe("no");
  });
});

describe("DR's key analysis on a noted door shuffle", () => {
  /** Each door rule's numbers, by door: what a key door asks. */
  const rulesOf = (
    logic: KeyLogic | undefined,
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
  /** A layout noted where the vanilla world has it, its key doors DR's. */
  const vanillaLayout = (s: DoorShuffleSettings): DoorNotes => {
    const notes = vanillaNotes(s);
    // unmark_ugly_smalls (DoorShuffle.py:476-480): no key doors in DR
    const kinds = { ...notes.kinds };
    for (const name of UGLY_SMALLS) kinds[doorId(name)] = "normal";
    return { ...notes, kinds };
  };

  it("reads a layout noted as the vanilla one as DR's vanilla analysis, but its hand adjustments", () => {
    const s = shuffle();
    const world = drWorld(settings("open"), {
      data: DR_DATA,
      doors: { notes: vanillaLayout(s), settings: s },
    });
    const vanilla = drKeyLogic(DR_DATA, settings("open"));
    expect([...(world.doorKeyLogic?.keys() ?? [])]).toEqual([
      ...vanilla.keys(),
    ]);
    // vanilla_key_logic's own (DoorShuffle.py:282-316), for vanilla doors
    // alone: the escape's three doors, the Palace of Darkness's front door,
    // Misery Mire's blue barriers
    const adjusted: Readonly<Record<string, readonly string[]>> = {
      "Hyrule Castle": [
        "Sewers Secret Room Key Door S",
        "Hyrule Dungeon Map Room Key Door S",
        "Sewers Dark Cross Key Door N",
      ],
      "Misery Mire": [...ALTERNATIVE_CRYSTAL_DOORS],
      "Palace of Darkness": ["PoD Middle Cage N"],
    };
    for (const [dungeon, logic] of vanilla) {
      const noted = world.doorKeyLogic?.get(dungeon);
      expect(rulesOf(noted, adjusted[dungeon]), dungeon).toEqual(
        rulesOf(logic, adjusted[dungeon]),
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

  it("leaves a dungeon strict-safe while a door of its layout or a kind is not noted", () => {
    const s = shuffle();
    const notes = vanillaLayout(s);
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
    const notes = vanillaLayout(s);
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

  it("runs no analysis from intensity 3, with decoupled doors, shuffled entrances or the fork's world", () => {
    const run = (s: DoorShuffleSettings, more = {}) =>
      drWorld(settings("open"), {
        data: DR_DATA,
        doors: { notes: vanillaLayout(s), settings: s },
        ...more,
      }).doorKeyLogic;
    expect(run(shuffle({ intensity: 3 }))?.size).toBe(0);
    expect(run(shuffle({ decoupled: true }))?.size).toBe(0);
    expect(run(shuffle({ shuffle: "crossed" }))?.size).toBe(13);
    // Standard's escape starts from its courtyard and Zelda (std_flag)
    expect(
      drWorld(settings("standard"), {
        data: DR_DATA,
        doors: { notes: vanillaLayout(shuffle()), settings: shuffle() },
      }).doorKeyLogic?.has("Hyrule Castle"),
    ).toBe(false);
    expect(
      drWorld(settings("open"), {
        data: OWR_DATA,
        doors: { notes: vanillaLayout(shuffle()), settings: shuffle() },
      }).doorKeyLogic?.size,
    ).toBe(0);
  });
});
