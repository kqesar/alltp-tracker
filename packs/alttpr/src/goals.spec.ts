// Go mode per goal: what each asks, where the run stands against it, and
// what it is missing.
import { type Atom, analyze, type Blockers } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { dungeon } from "./dungeons";
import { filler } from "./fill";
import {
  GO_MODES,
  type GoMode,
  goModeBlockers,
  goModeOf,
  goModeStatus,
  huntGoModeOf,
  joinBlockers,
  TRIFORCE_HUNT,
} from "./goals";
import { withUntracked } from "./keys";
import { compile, regionModules, STATE_NAMES } from "./pack";
import {
  type AlttprSettings,
  OPEN,
  STANDARD,
  settingsFromUpstream,
} from "./settings";
import {
  EMPTY_INPUT,
  type InventoryItemId,
  type TrackerInput,
  toState,
} from "./tracker";

/** The site's default preset with another goal. */
const withGoal = (goal: "dungeons" | "fast_ganon" | "pedestal") =>
  settingsFromUpstream("open", {
    accessibility: "items",
    dungeonItems: "standard",
    goal,
    itemPlacement: "advanced",
    logic: "NoGlitches",
    "mode.weapons": "randomized",
  });

const FAST_GANON = withGoal("fast_ganon");
const PEDESTAL = withGoal("pedestal");

/** Everything a player can hold at the end of a run. */
const END_ITEMS: Partial<Record<InventoryItemId, number>> = {
  armor: 2,
  bombos: 1,
  bookOfMudora: 1,
  boomerang: 1,
  bottle: 4,
  bow: 1,
  bugCatchingNet: 1,
  caneOfByrna: 1,
  caneOfSomaria: 1,
  cape: 1,
  ether: 1,
  fireRod: 1,
  flippers: 1,
  flute: 1,
  glove: 2,
  hammer: 1,
  hookshot: 1,
  iceRod: 1,
  lamp: 1,
  magicMirror: 1,
  moonPearl: 1,
  mushroom: 1,
  pegasusBoots: 1,
  powder: 1,
  quake: 1,
  redBoomerang: 1,
  shield: 3,
  shovel: 1,
  silverArrowUpgrade: 1,
  sword: 4,
};

/**
 * The escape, Agahnim and the ten dungeons of the grid beaten, their prizes
 * known.
 */
const END_DUNGEONS: Pick<TrackerInput, "beaten" | "prizes" | "medallions"> = {
  beaten: {
    "castle-tower": true,
    "desert-palace": true,
    "eastern-palace": true,
    // The escape, which rescues Zelda in a Standard world
    "hyrule-castle": true,
    "ice-palace": true,
    "misery-mire": true,
    "palace-of-darkness": true,
    "skull-woods": true,
    "swamp-palace": true,
    "thieves-town": true,
    "tower-of-hera": true,
    "turtle-rock": true,
  },
  medallions: { mire: "ether", turtleRock: "quake" },
  prizes: {
    "desert-palace": "pendant",
    "eastern-palace": "greenPendant",
    "ice-palace": "redCrystal",
    "misery-mire": "redCrystal",
    "palace-of-darkness": "crystal",
    "skull-woods": "crystal",
    "swamp-palace": "crystal",
    "thieves-town": "crystal",
    "tower-of-hera": "pendant",
    "turtle-rock": "crystal",
  },
};

const END_GAME: TrackerInput = { ...END_DUNGEONS, items: END_ITEMS };

/** The end game less some items, some dungeons more beaten. */
const endGame = ({
  without = [],
  beaten = {},
  prizes = {},
}: {
  without?: InventoryItemId[];
  beaten?: TrackerInput["beaten"];
  prizes?: TrackerInput["prizes"];
} = {}): TrackerInput => ({
  ...END_GAME,
  beaten: { ...END_GAME.beaten, ...beaten },
  items: Object.fromEntries(
    Object.entries(END_ITEMS).filter(
      ([id]) => !without.includes(id as InventoryItemId),
    ),
  ),
  prizes: { ...END_GAME.prizes, ...prizes },
});

const fillers = new Map<AlttprSettings, ReturnType<typeof filler>>();
const fillerOf = (settings: AlttprSettings) => {
  let found = fillers.get(settings);
  if (found === undefined) {
    found = filler(compile(settings), settings);
    fillers.set(settings, found);
  }
  return found;
};

/** Where a recorded run stands against its goal's go mode. */
const status = (input: TrackerInput, settings: AlttprSettings) => {
  const mode = goModeOf(settings) as GoMode;
  return goModeStatus(fillerOf(settings), toState(input, settings), mode);
};

/** What a recorded run misses for its go mode, every key held. */
const missing = (input: TrackerInput, settings: AlttprSettings) => {
  const mode = goModeOf(settings) as GoMode;
  const fill = fillerOf(settings);
  const state = withUntracked(fill, toState(input, settings));
  return goModeBlockers(fill.world, state, mode);
};

const item = (id: string, min = 1): Atom => ({ item: id, min });

describe("GO_MODES", () => {
  it("is chosen by the run's goal, and absent where the end is everything", () => {
    expect(goModeOf(OPEN)).toBe(GO_MODES.ganon);
    expect(goModeOf(STANDARD)).toBe(GO_MODES.ganon);
    expect(goModeOf(FAST_GANON)).toBe(GO_MODES.fastGanon);
    expect(goModeOf(PEDESTAL)).toBe(GO_MODES.pedestal);
    expect(goModeOf(withGoal("dungeons"))).toBeUndefined();
    expect(
      goModeOf(settingsFromUpstream("open", { goal: "completionist" })),
    ).toBeUndefined();
  });

  it("names locations of both worlds, facts a state carries, upstream lines", () => {
    for (const settings of [OPEN, STANDARD]) {
      const ids = new Set(
        regionModules(settings).flatMap((module) =>
          module.regions.flatMap((region) =>
            region.locations.map((location) => location.id),
          ),
        ),
      );
      for (const mode of Object.values(GO_MODES)) {
        expect(mode.source).toMatch(/^app\/Randomizer\.php:\d+$/);
        for (const step of mode.steps) {
          expect(ids.has(step.location), step.location).toBe(true);
          expect(step.source).toMatch(/^app\/Region\/.+\.php:\d+$/);
        }
      }
    }
    // Agahnim 2 gives what Ganon's Tower's event does
    const [tower] = GO_MODES.ganon.steps;
    expect(tower.gives).toBe(dungeon("ganons-tower").event?.item);
    expect(STATE_NAMES).toContain(tower.gives);
  });
});

describe("a triforce hunt", () => {
  it("asks for 20 of the 30 pieces (config/alttp.php:32-41)", () => {
    expect(TRIFORCE_HUNT).toMatchObject({ pool: 30, required: 20 });
  });

  it("is in go mode once the pieces asked for are held", () => {
    expect(huntGoModeOf(0, 20)).toBe("no");
    expect(huntGoModeOf(19, 20)).toBe("no");
    expect(huntGoModeOf(20, 20)).toBe("yes");
    expect(huntGoModeOf(30, 20)).toBe("yes");
    // A seed that asks for fewer
    expect(huntGoModeOf(15, 15)).toBe("yes");
  });
});

describe("goModeStatus", () => {
  it("is out of logic at the start, and every step past the first unsolved", () => {
    const start = status(EMPTY_INPUT, OPEN);
    expect(start.tri).toBe("no");
    expect(start.steps).toEqual([
      { done: false, location: "agahnim-2", tri: "no" },
      { done: false, location: "ganon" },
    ]);
  });

  it("asks Ganon's Tower up to Agahnim 2, then Ganon with Agahnim 2 beaten", () => {
    const end = status(END_GAME, OPEN);
    expect(end.tri).toBe("yes");
    // Ganon himself wants Agahnim 2 beaten, which the player has not
    // marked: the step gives it
    expect(end.steps).toEqual([
      { done: false, location: "agahnim-2", tri: "yes" },
      { done: false, location: "ganon", tri: "yes" },
    ]);
    expect(status(END_GAME, STANDARD).tri).toBe("yes");
  });

  it("is not yet while the tower's climb is out of logic", () => {
    // The Moldorm Chest, which Agahnim 2 wants, wants the hookshot
    const climb = status(endGame({ without: ["hookshot"] }), OPEN);
    expect(climb.tri).toBe("no");
    expect(climb.steps[0]).toEqual({
      done: false,
      location: "agahnim-2",
      tri: "no",
    });
  });

  it("counts a step done once the player holds what it gives", () => {
    const beaten = status(
      endGame({ beaten: { "ganons-tower": true }, without: ["hookshot"] }),
      OPEN,
    );
    expect(beaten.tri).toBe("yes");
    expect(beaten.steps[0]).toEqual({
      done: true,
      location: "agahnim-2",
      tri: "yes",
    });
  });

  it("wants Ganon's own weapons after the tower", () => {
    // The tower's Agahnim falls to a hammer; Ganon wants the Master Sword
    const sword = status(
      { ...endGame({ without: ["sword"] }), items: { ...END_ITEMS, sword: 1 } },
      OPEN,
    );
    expect(sword.steps.map((step) => step.tri)).toEqual(["yes", "no"]);
    expect(sword.tri).toBe("no");
  });

  it("asks fast Ganon for the crystals and the pyramid, not Agahnim 2", () => {
    expect(status(endGame({ without: ["hookshot"] }), FAST_GANON).tri).toBe(
      "yes",
    );
    // A crystal fewer: Ice Palace's red crystal unknown
    const six = endGame({ prizes: { "ice-palace": undefined } });
    expect(status(six, FAST_GANON).tri).toBe("no");
  });

  it("asks the pedestal for the three pendants", () => {
    expect(status(END_GAME, PEDESTAL).tri).toBe("yes");
    const two = endGame({ prizes: { "tower-of-hera": undefined } });
    expect(status(two, PEDESTAL).tri).toBe("no");
  });
});

describe("goModeBlockers", () => {
  it("says nothing is missing in go mode", () => {
    expect(missing(END_GAME, OPEN)).toEqual({ sets: [[]], truncated: false });
  });

  it("joins what each step misses", () => {
    // The tower wants the hookshot; Ganon, after it, the Master Sword
    const both = endGame({ without: ["hookshot", "sword"] });
    const sets = missing(
      { ...both, items: { ...both.items, sword: 1 } },
      OPEN,
    ).sets;
    expect(sets).toContainEqual([item("hookshot"), item("sword", 2)]);
    for (const set of sets) {
      expect(
        set.some((atom) => "item" in atom && atom.item === "hookshot"),
      ).toBe(true);
    }
  });

  it("skips a step done", () => {
    const beaten = endGame({
      beaten: { "ganons-tower": true },
      without: ["hookshot"],
    });
    expect(missing(beaten, OPEN).sets).toEqual([[]]);
  });

  it("names the crystals fast Ganon asks for as one goal", () => {
    const six = endGame({ prizes: { "ice-palace": undefined } });
    expect(missing(six, FAST_GANON).sets).toEqual([
      [{ group: "crystal", min: 7 }],
    ]);
  });

  it("is the pedestal's own blockers for the pedestal goal", () => {
    const two = endGame({ prizes: { "tower-of-hera": undefined } });
    const state = toState(two, PEDESTAL);
    const { world } = fillerOf(PEDESTAL);
    expect(missing(two, PEDESTAL)).toEqual(
      analyze(world, state).blockers("master-sword-pedestal", "yes"),
    );
    expect(missing(two, PEDESTAL).sets).toEqual([[item("pendantOfWisdom")]]);
  });
});

describe("joinBlockers", () => {
  const of = (...sets: Atom[][]): Blockers => ({ sets, truncated: false });

  it("keeps each atom at its higher level, the minimal sets first", () => {
    expect(
      joinBlockers(
        of([item("hammer")], [item("sword", 2)]),
        of([item("sword", 3)], [item("hammer"), item("lamp")]),
      ).sets,
      // Hammer and Tempered Sword, Hammer, Lamp and Master Sword: each asks
      // for more than a set kept
    ).toEqual([[item("sword", 3)], [item("hammer"), item("lamp")]]);
  });

  it("drops a set past the bound, and keeps what is already there", () => {
    const three = of([item("a"), item("b"), item("c")]);
    expect(joinBlockers(three, of([item("d")])).sets).toEqual([]);
    expect(joinBlockers(three, of([item("d")]), 4).sets).toEqual([
      [item("a"), item("b"), item("c"), item("d")],
    ]);
    expect(joinBlockers(of([]), three)).toEqual(three);
    expect(joinBlockers(of(), three).sets).toEqual([]);
  });

  it("says truncated when either side was", () => {
    const cut: Blockers = { sets: [[item("a")]], truncated: true };
    expect(joinBlockers(cut, of([])).truncated).toBe(true);
    expect(joinBlockers(of([]), cut).truncated).toBe(true);
    expect(joinBlockers(of([]), of([])).truncated).toBe(false);
  });

  it("orders items before groups, by name, then by level", () => {
    expect(
      joinBlockers(
        of([{ group: "crystal", min: 7 }]),
        of([item("moonPearl")], [item("flippers")]),
      ).sets,
    ).toEqual([
      [item("flippers"), { group: "crystal", min: 7 }],
      [item("moonPearl"), { group: "crystal", min: 7 }],
    ]);
  });
});
