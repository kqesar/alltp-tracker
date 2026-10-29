import type { State } from "@alltp/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { erSeed } from "../test/er-seeds";
import {
  BOSS_FACTS,
  BOSS_PLACES,
  type BossKnowledge,
  type BossPlaceId,
  bossesAt,
  bossFacts,
  type ShuffledBoss,
} from "./bosses";
import { entranceNamed, erLocationId, targetNamed } from "./entrances";
import {
  analyzeFacts,
  crossedConnections,
  type ErConnections,
  erConnections,
  erWorld,
  solveFacts,
  solveFactsState,
  vanillaConnections,
} from "./er-world";
import { ITEMS } from "./items";
import { everything } from "./keys";
import { MARKERS } from "./markers";
import { MEDALLION_FACTS } from "./medallions";
import { OPEN, STANDARD, settingsFromUpstream } from "./settings";

const id = (name: string) => entranceNamed(name).id;
const target = (name: string) => targetNamed(name).id;

/** A location's answer in a world, with `state` held. */
const at = (
  connections: ErConnections,
  state: State,
  location: string,
  settings = OPEN,
) =>
  solveFacts(erWorld(settings, connections), state).location(
    erLocationId(location),
  );

/** Everything, but some items. */
const allBut = (...items: string[]): State => ({
  ...everything(OPEN),
  ...Object.fromEntries(items.map((item) => [item, 0])),
});

describe("the entrance randomizer's connections", () => {
  it("connect a cave both ways, a single door or a hole one way", () => {
    const connections = crossedConnections("open", {
      [id("Kakariko Shop")]: target("Elder House Exit (East)"),
      [id("Big Bomb Shop")]: target("Blinds Hideout"),
      [id("Kakariko Well Drop")]: target("Bat Cave (right)"),
      // An id this version does not know is left out
      unknown: "elder-house-exit-west",
    });
    expect(connections.get("Kakariko Shop")).toBe("Elder House");
    expect(connections.get("Elder House Exit (East)")).toBe("Light World");
    expect(connections.get("Big Bomb Shop")).toBe("Blinds Hideout");
    expect(connections.get("Kakariko Well Drop")).toBe("Bat Cave (right)");
    // What the shuffle keeps: Link's House, the Tavern's back door
    expect(connections.get("Links House")).toBe("Links House");
    expect(connections.get("Tavern North")).toBe("Tavern");
    expect(connections.has("Hyrule Castle Entrance (South)")).toBe(false);
    // Standard keeps the escape's doors
    expect(
      crossedConnections("standard", {}).get(
        "Hyrule Castle Secret Entrance Drop",
      ),
    ).toBe("Hyrule Castle Secret Entrance");
  });

  it("keep the castle whole in a Standard world's simple and restricted shuffles", () => {
    // simple_shuffle_dungeons leaves Hyrule Castle and Agahnim's Tower
    // (EntranceShuffle.py:2054-2069); the full and crossed ones its front
    // door alone (:279-280, :380-381)
    const castle = [
      "Hyrule Castle Entrance (South)",
      "Hyrule Castle Entrance (East)",
      "Hyrule Castle Entrance (West)",
      "Agahnims Tower",
    ];
    const kept = (connections: ErConnections) =>
      castle.filter((door) => connections.has(door));
    for (const shuffle of ["simple", "restricted"] as const) {
      const connections = erConnections(shuffle, "standard", {});
      expect(kept(connections)).toEqual(castle);
      expect(connections.get("Agahnims Tower Exit")).toBe(
        "Hyrule Castle Ledge",
      );
      expect(kept(erConnections(shuffle, "open", {}))).toEqual([]);
    }
    for (const shuffle of ["full", "crossed"] as const)
      expect(kept(erConnections(shuffle, "standard", {}))).toEqual([
        "Hyrule Castle Entrance (South)",
      ]);
    // Agahnim's Tower behind its own door: reached with the cape
    const world = erConnections("simple", "standard", {});
    expect(
      at(world, everything(STANDARD), "Castle Tower - Room 03", STANDARD),
    ).toBe("yes");
    expect(
      at(
        crossedConnections("standard", {}),
        everything(STANDARD),
        "Castle Tower - Room 03",
        STANDARD,
      ),
    ).toBe("no");
  });

  it("lead only through the doors noted", () => {
    const none = crossedConnections("open", {});
    // Outdoors, from Link's House
    expect(at(none, everything(OPEN), "Mushroom")).toBe("yes");
    // Behind the Tavern's back door, which the shuffle keeps
    expect(at(none, everything(OPEN), "Kakariko Tavern")).toBe("yes");
    // Behind a door not noted
    expect(at(none, everything(OPEN), "Blind's Hideout - Top")).toBe("no");
    const noted = crossedConnections("open", {
      [id("Kakariko Shop")]: target("Blinds Hideout"),
    });
    expect(at(noted, {}, "Blind's Hideout - Top")).toBe("yes");
  });
});

describe("the entrance randomizer's world", () => {
  const vanilla = vanillaConnections();

  it("holds an event once its location is reached", () => {
    // The floodgate's event opens the Sunken Treasure (Rules.py:136, 295)
    expect(at(vanilla, {}, "Sunken Treasure")).toBe("yes");
    expect(at(crossedConnections("open", {}), {}, "Sunken Treasure")).toBe(
      "no",
    );
  });

  it("asks a ganonhunt's Ganon for the pieces (Rules.py:454)", () => {
    const hunt = settingsFromUpstream("open", { goal: "ganonhunt" });
    const without = allBut("ganonhuntPieces");
    expect(at(vanilla, without, "Ganon", OPEN)).toBe("yes");
    expect(at(vanilla, without, "Ganon", hunt)).toBe("no");
    expect(at(vanilla, { ...without, ganonhuntPieces: 1 }, "Ganon", hunt)).toBe(
      "yes",
    );
  });

  it("takes the pearl in the dark world, the bunny's rules", () => {
    // Up the Dark World's mountain by the teleporter, no pearl asked; its
    // cave lies in the dark world once the regions are marked
    const location = erLocationId("Superbunny Cave - Top");
    const bunny = (marked: boolean) =>
      solveFacts(
        erWorld(OPEN, vanilla, { marked }),
        allBut("moonPearl"),
      ).location(location);
    expect(bunny(true)).toBe("no");
    expect(bunny(false)).toBe("yes");
  });

  it("asks the big bomb's route by where the shop's door is", () => {
    // The vanilla door is a southern Dark World one: the peg bridge, or the
    // mirror through the castle's gate (Rules.py:1263-1266)
    const solution = solveFacts(
      erWorld(OPEN, vanilla),
      allBut("hammer", "magicMirror"),
    );
    // The shop is reached, its bomb not brought back
    expect(solution.region("bigBombShop")).toBe("yes");
    expect(solution.location(erLocationId("Pyramid Fairy - Left"))).toBe("no");
    expect(at(vanilla, allBut("hammer"), "Pyramid Fairy - Left")).toBe("yes");
  });

  it("counts Turtle Rock's keys by what everything held reaches", () => {
    // Every part of it reached: its back door's rules, four keys
    const keys = (n: number) => ({ ...everything(OPEN), keyD7: n });
    expect(at(vanilla, keys(3), "Turtle Rock - Big Key Chest")).not.toBe("yes");
    expect(at(vanilla, keys(4), "Turtle Rock - Big Key Chest")).toBe("yes");
  });

  it("reads Turtle Rock's key rules off the seed's whole world, the doors noted bounding it", () => {
    // The seed: Elder House's east door and the eye bridge's ledge swap
    // places, so everything held reaches the eye bridge from Kakariko, and
    // each key door wants four keys (Rules.py:1023-1025, 1042-1044)
    const before = (exit: string) => vanilla.get(exit) ?? "";
    const seed = new Map([
      ...vanilla,
      ["Elder House (East)", before("Turtle Rock Isolated Ledge Entrance")],
      ["Turtle Rock Isolated Ledge Exit", before("Elder House Exit (East)")],
      ["Turtle Rock Isolated Ledge Entrance", before("Elder House (East)")],
      ["Elder House Exit (East)", before("Turtle Rock Isolated Ledge Exit")],
    ]);
    // The player has noted every door but Elder House's east one
    const noted = new Map(seed);
    noted.delete("Elder House (East)");
    noted.delete("Turtle Rock Isolated Ledge Exit");
    const keysanity = settingsFromUpstream("open", { dungeonItems: "full" });
    const chomps = (connections: ErConnections, keyD7: number) =>
      at(
        connections,
        { ...everything(keysanity), keyD7, lamp: 0 },
        "Turtle Rock - Chain Chomps",
        keysanity,
      );
    for (const keys of [1, 2]) {
      expect(chomps(seed, keys)).toBe("no");
      // Read off the doors noted alone, the eye bridge not reached, fewer
      // keys opened the doors
      expect(chomps(noted, keys)).not.toBe("yes");
    }
    // Four keys open them whatever the door not noted leads to
    expect(chomps(seed, 4)).toBe("yes");
    expect(chomps(noted, 4)).toBe("yes");
  });

  it("says what a check misses through its facts, in items", () => {
    // The Blacksmith wants the smith back (an event), who wants the frog
    // (another), whom only the Titan's Mitt and the pearl reach
    const world = erWorld(OPEN, vanilla);
    const { state } = solveFactsState(world, {});
    expect(state.openFloodgate).toBe(1);
    const analysis = analyzeFacts(world, state, { maxAtoms: 3 });
    expect(analysis.blockers("blacksmith", "yes")).toEqual({
      sets: [
        [
          { item: "glove", min: 2 },
          { item: "moonPearl", min: 1 },
        ],
      ],
      truncated: false,
    });
    expect(analysis.blockers("sunken-treasure", "yes").sets).toEqual([[]]);
  });

  it("starts Standard by the uncle", () => {
    expect(at(vanilla, {}, "Link's Uncle", STANDARD)).toBe("yes");
  });

  it("refuses the Inverted world", () => {
    expect(() => erWorld(settingsFromUpstream("inverted"), vanilla)).toThrow(
      /Inverted/,
    );
  });
});

describe("the entrance randomizer's boss slots", () => {
  const vanilla = vanillaConnections();
  const shuffled = { ...OPEN, bossShuffle: true };
  /** Each slot's boss without boss shuffle (Dungeons.py:18-39). */
  const VANILLA: Required<BossKnowledge> = {
    desertPalace: "lanmolas",
    easternPalace: "armosKnights",
    ganonsTowerBottom: "armosKnights",
    ganonsTowerMiddle: "lanmolas",
    ganonsTowerTop: "moldorm",
    icePalace: "kholdstare",
    miseryMire: "vitreous",
    palaceOfDarkness: "helmasaurKing",
    skullWoods: "mothula",
    swampPalace: "arrghus",
    thievesTown: "blind",
    towerOfHera: "moldorm",
    turtleRock: "trinexx",
  };
  /** A location's answer, with `known` of the bosses and nothing else. */
  const boss = (
    settings: typeof OPEN,
    state: State,
    known: BossKnowledge,
    location = "Eastern Palace - Boss",
  ) =>
    solveFacts(erWorld(settings, vanilla), {
      ...state,
      ...Object.fromEntries(BOSS_FACTS.map((fact) => [fact, 0])),
      ...bossFacts(known),
    }).location(erLocationId(location));

  /** Each item at a random level, most not held, and the pads' facts. */
  const anyItems: fc.Arbitrary<State> = fc.record(
    Object.fromEntries([
      ...ITEMS.map(({ id, max }) => [
        id,
        fc.nat({ max: 2 * max }).map((n) => Math.max(0, n - max)),
      ]),
      ...MEDALLION_FACTS.map((f) => [f, fc.integer({ max: 1, min: 0 })]),
    ]),
  );
  /** Some slots known, each as a boss it may hold. */
  const anyBosses: fc.Arbitrary<BossKnowledge> = fc.record(
    Object.fromEntries(
      (Object.keys(BOSS_PLACES) as BossPlaceId[]).map((place) => [
        place,
        fc.option(fc.constantFrom(...bossesAt(place)), { nil: undefined }),
      ]),
    ),
  );

  for (const settings of [OPEN, STANDARD, { ...OPEN, swordless: true }]) {
    const name = `${settings.standardMode ? "Standard" : "Open"}${settings.swordless === true ? ", swordless" : ""}`;
    const plain = erWorld(settings, vanilla);
    const moved = erWorld({ ...settings, bossShuffle: true }, vanilla);

    it(`read the vanilla bosses without boss shuffle, whatever is known (${name})`, () => {
      // and under boss shuffle with every slot known as its vanilla boss
      fc.assert(
        fc.property(anyItems, anyBosses, (items, known) => {
          const expected = solveFacts(plain, {
            ...items,
            ...bossFacts({}),
          }).locations();
          expect(
            solveFacts(plain, { ...items, ...bossFacts(known) }).locations(),
          ).toEqual(expected);
          expect(
            solveFacts(moved, { ...items, ...bossFacts(VANILLA) }).locations(),
          ).toEqual(expected);
        }),
        { numRuns: 60, seed: 7 },
      );
    });
  }

  it("read a boss known exactly, an unknown one as every boss its slot may hold", () => {
    const noIceRod = allBut("iceRod");
    // Trinexx in Eastern Palace wants both rods (Bosses.py:98-103)
    expect(boss(shuffled, noIceRod, { easternPalace: "trinexx" })).toBe("no");
    expect(boss(shuffled, everything(OPEN), { easternPalace: "trinexx" })).toBe(
      "yes",
    );
    // Without boss shuffle, the Armos Knights
    expect(boss(OPEN, noIceRod, { easternPalace: "trinexx" })).toBe("yes");
    // Unknown: some boss it may hold falls, not every one
    expect(boss(shuffled, noIceRod, {})).toBe("maybe");
    expect(boss(shuffled, everything(OPEN), {})).toBe("yes");
  });

  it("leave out of a slot what can_place_boss refuses there", () => {
    // Neither Trinexx nor Arrghus at Tower of Hera (Bosses.py:135-136):
    // the ice rod and the hookshot are none of its bosses' needs
    const noRodNorHook = allBut("iceRod", "hookshot");
    expect(boss(shuffled, noRodNorHook, {}, "Tower of Hera - Boss")).toBe(
      "yes",
    );
    expect(boss(shuffled, noRodNorHook, {}, "Desert Palace - Boss")).toBe(
      "maybe",
    );
    // Ganon's Tower's top, on the climb past its gap (Rules.py:444)
    const top = (boss3: ShuffledBoss) =>
      boss(
        shuffled,
        allBut("hammer", "sword"),
        {
          // Its big key behind the bottom's boss, its torches the middle's
          ganonsTowerBottom: "armosKnights",
          ganonsTowerMiddle: "lanmolas",
          ganonsTowerTop: boss3,
        },
        "Ganons Tower - Validation Chest",
      );
    expect(top("moldorm")).toBe("no");
    expect(top("vitreous")).toBe("yes");
  });

  it("place no Kholdstare but in Ice Palace when swordless (Bosses.py:124)", () => {
    // Without the fire rod nor Bombos, Kholdstare stands: Tower of Hera
    // may hold him, unless the world is swordless
    const noFire = { ...allBut("fireRod", "bombos"), sword: 0 };
    const hera = (settings: typeof OPEN) =>
      boss(settings, noFire, {}, "Tower of Hera - Boss");
    expect(hera(shuffled)).toBe("maybe");
    expect(hera({ ...shuffled, swordless: true })).toBe("yes");
  });
});

describe("the entrance randomizer's retro world", () => {
  // alttpr.com sends a Retro seed as --mode open --retro
  // (app/EntranceRandomizer.php:79-82)
  const retro = settingsFromUpstream("retro", { dungeonItems: "full" });
  /** Everything held but what a shop sells, with these doors noted. */
  const answer = (
    location: string,
    noted: Readonly<Record<string, string>>,
    held: State = {},
  ) =>
    solveFacts(erWorld(retro, crossedConnections("open", noted)), {
      ...everything(retro),
      shopArrow: 0,
      shopKey: 0,
      ...held,
    }).location(erLocationId(location));
  const eastern = { [id("Eastern Palace")]: target("Eastern Palace Exit") };
  const desert = {
    [id("Desert Palace Entrance (South)")]: target(
      "Desert Palace Exit (South)",
    ),
  };

  it("shoots the bow once an arrow is for sale (BaseClasses.py:378-381)", () => {
    const boss = "Eastern Palace - Boss";
    // No shop reached, none found
    expect(answer(boss, eastern)).toBe("no");
    // A shop the draw may have picked
    const kakariko = { [id("Kakariko Shop")]: target("Kakariko Shop") };
    expect(answer(boss, { ...eastern, ...kakariko })).toBe("maybe");
    // The Red Shield Shop always sells them, a key shop does too
    const redShield = { [id("Red Shield Shop")]: target("Red Shield Shop") };
    expect(answer(boss, { ...eastern, ...redShield })).toBe("yes");
    expect(answer(boss, eastern, { shopArrow: 1 })).toBe("yes");
    expect(answer(boss, eastern, { shopKey: 1 })).toBe("yes");
    // Outside the retro world, the bow alone
    expect(
      solveFacts(
        erWorld(OPEN, crossedConnections("open", eastern)),
        everything(OPEN),
      ).location(erLocationId(boss)),
    ).toBe("yes");
  });

  it("opens a key door once a key is for sale, whatever keys are held", () => {
    // Behind its east wing's key door (Rules.py:270)
    const chest = "Desert Palace - Compass Chest";
    // Every key held counts for nothing (has_key, BaseClasses.py:378-380)
    expect(answer(chest, desert)).toBe("no");
    expect(answer(chest, desert, { shopKey: 1 })).toBe("yes");
    expect(answer(chest, desert, { keyP2: 0, shopKey: 1 })).toBe("yes");
    // A shop arrows are sold at tells no key
    expect(answer(chest, desert, { shopArrow: 1 })).toBe("no");
  });

  it("takes a door noted to a take-any cave (ItemList.py set_up_take_anys)", () => {
    const noted = {
      [id("East Dark World Hint")]: target("Take-Any #4"),
      [id("Checkerboard Cave")]: target("Old Man Sword Cave"),
    };
    const world = erWorld(retro, crossedConnections("open", noted));
    expect(world.compiled.locationIds.length).toBeGreaterThan(200);
  });
});

describe("the pack's ids", () => {
  it("name every location of the map and every dungeon's prize", () => {
    const world = erWorld(OPEN, crossedConnections("open", {}));
    const ids = new Set(world.compiled.locationIds);
    const missing = [
      ...MARKERS.flatMap((marker) => marker.locations),
      "agahnim",
      "agahnim-2",
    ].filter((location) => !ids.has(location));
    expect(missing).toEqual([]);
  });
});

describe("a real Crosskeys seed, its entrances all noted", () => {
  const settings = settingsFromUpstream("open", { dungeonItems: "full" });
  // Link's House and the Tavern's back door stay, its Chris Houlihan room
  // is a way out (entrances.spec.ts)
  const fixed = new Set(["Links House", "Tavern North"]);
  const seed = erSeed("0yAObedRMV").spoiler;
  const noted = Object.fromEntries(
    seed.Entrances.filter(
      (m) => m.direction !== "exit" && !fixed.has(m.entrance),
    ).map((m) => [id(m.entrance), target(m.exit)]),
  );
  const connections = crossedConnections("open", noted);

  it("reaches every location with everything held", () => {
    const solution = solveFacts(
      erWorld(settings, connections),
      everything(settings),
    );
    const missed = Object.entries(solution.locations()).filter(
      ([, tri]) => tri !== "yes",
    );
    expect(Object.keys(solution.locations()).length).toBeGreaterThan(200);
    expect(missed).toEqual([]);
  });

  it("builds and solves within budget", () => {
    // Built once per entrance noted, solved on every click: the fastest of
    // a few runs, far above what a run takes, to catch a blow-up
    const fastest = (run: () => void) => {
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        run();
        best = Math.min(best, performance.now() - start);
      }
      return best;
    };
    const world = erWorld(settings, connections);
    expect(fastest(() => erWorld(settings, connections))).toBeLessThan(100);
    expect(fastest(() => solveFacts(world, {}))).toBeLessThan(10);
  });
});
