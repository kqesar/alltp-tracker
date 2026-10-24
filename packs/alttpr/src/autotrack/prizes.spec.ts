import { describe, expect, it } from "vitest";
import seeds from "../../test/prize-tables.json" with { type: "json" };
import { ITEMS } from "../items";
import { PRIZES, type Prize } from "../tracker";
import type { MemoryView } from "./decode";
import { DUNGEON, DUNGEONS, MEMORY_RANGE, type MemoryRangeId } from "./memory";
import {
  decodePrizes as decodeShown,
  type PrizeDungeon,
  type PrizeReading,
  prizeClass,
} from "./prizes";
import { ALTTPR_RACE_PROFILE } from "./race-profile";

// The fixture holds, for four alttpr.com seeds at v31, the bytes of the
// ROM's two prize tables, its map mode and its reveals, with the prizes
// their spoilers list: the rig's Open seed read from its ROM, three more
// (Open, Standard with mc, Inverted with full) read from the patch alttpr.com
// serves for each. Written by a script, never by hand (the PR that added it
// says how).

/** Ranges' bytes, by id; a range left out was not read. */
const view = (
  ranges: Partial<Record<MemoryRangeId, number[]>>,
): MemoryView => ({
  bytes: (id) => Uint8Array.from(ranges[id as MemoryRangeId] ?? []),
  has: (id) => id in ranges,
});

/** A word's two bytes, little-endian. */
const word = (value: number) => [value & 0xff, value >> 8];

/** Every prize dungeon's bit, as DungeonsCompleted or MapField sets it. */
const ALL = DUNGEONS.reduce((bits, { bit }) => bits | bit, 0);

const LIGHT = 0x00;
const DARK = 0x40;

type Seed = (typeof seeds.seeds)[number];

/** A reading's prizes alone, by dungeon, without why each is shown. */
const classesOf = (reading: PrizeReading) =>
  typeof reading === "string"
    ? reading
    : Object.fromEntries(
        Object.entries(reading).map(([code, { prize }]) => [code, prize]),
      );

/** decodePrizes, its prizes alone. */
const decodePrizes = (memory: MemoryView, options: { race: boolean }) =>
  classesOf(decodeShown(memory, options));

/** The ranges a seed's ROM and a save in play give. */
const seedMemory = (
  seed: Seed,
  save: { completed?: number; world?: number; maps?: number; overlay?: number },
) =>
  view({
    "current-world": [save.world ?? LIGHT],
    "dungeons-completed": word(save.completed ?? 0),
    "map-mode": [seed.mapMode],
    "map-overlay": word(save.overlay ?? 0),
    maps: word(save.maps ?? 0),
    "prize-bits": seed.prizeBits,
    "prize-kinds": seed.prizeKinds,
  });

/** A dungeon's code from the spoiler's name. */
const codeOf = (name: string) => {
  const found = DUNGEONS.find(
    (d) => d.name.replace("'", "") === name.replace("'", ""),
  );
  if (found === undefined) throw new RangeError(name);
  return found.code as PrizeDungeon;
};

/** The class of a spoiler's item: `PendantOfCourage` is `pendantOfCourage`. */
const classOf = (item: string): Prize => {
  const id = item[0].toLowerCase() + item.slice(1);
  expect(ITEMS.some((known) => known.id === id)).toBe(true);
  const found = (Object.keys(PRIZES) as Prize[]).find((prize) =>
    (PRIZES[prize] as readonly string[]).includes(id),
  );
  if (found === undefined) throw new RangeError(item);
  return found;
};

/** What the spoiler says each dungeon holds, as prize classes. */
const spoiled = (seed: Seed) =>
  Object.fromEntries(
    Object.entries(seed.spoilerPrizes).map(([name, item]) => [
      codeOf(name),
      classOf(item),
    ]),
  );

const LIGHT_WORLD = ["P1", "P2", "P3"];

/** The prizes shown outside Race Mode; fails when none could be read. */
const shownIn = (memory: MemoryView) => {
  const prizes = decodePrizes(memory, { race: false });
  if (typeof prizes === "string") throw new Error(prizes);
  return prizes;
};

describe("decodePrizes on real seeds", () => {
  it("holds four seeds of every map mode", () => {
    expect(seeds.seeds.map((seed) => [seed.mode, seed.mapMode])).toEqual([
      ["open", 0],
      ["open", 0],
      ["standard", 1],
      ["inverted", 1],
    ]);
  });

  for (const seed of seeds.seeds) {
    describe(`${seed.hash} (${seed.mode}, ${seed.dungeonItems})`, () => {
      it("names every finished dungeon's prize as its spoiler does", () => {
        expect(Object.keys(seed.spoilerPrizes)).toHaveLength(10);
        expect(
          decodePrizes(seedMemory(seed, { completed: ALL }), { race: false }),
        ).toEqual(spoiled(seed));
      });

      it("shows on the world map what this seed's map mode shows", () => {
        const expected = spoiled(seed);
        const inWorld = (dark: boolean) =>
          Object.fromEntries(
            Object.entries(expected).filter(
              ([code]) => LIGHT_WORLD.includes(code) !== dark,
            ),
          );
        const light = decodePrizes(seedMemory(seed, { world: LIGHT }), {
          race: false,
        });
        const dark = decodePrizes(seedMemory(seed, { world: DARK }), {
          race: false,
        });
        if (seed.mapMode === 0) {
          // Every prize of the world Link is in, from the start
          expect(light).toEqual(inWorld(false));
          expect(dark).toEqual(inWorld(true));
        } else {
          // None until a map is held or revealed
          expect(light).toEqual({});
          expect(dark).toEqual({});
          const mapped = decodePrizes(
            seedMemory(seed, { maps: ALL, world: DARK }),
            { race: false },
          );
          expect(mapped).toEqual(inWorld(true));
        }
      });

      it("reveals what Sahasrahla and the Bomb Merchant tell", () => {
        if (seed.mapMode === 0) {
          // vt writes no reveal where the map shows every prize
          expect([seed.revealSahasrahla, seed.revealBombShop]).toEqual([0, 0]);
          return;
        }
        const told = (overlay: number) => ({
          ...shownIn(seedMemory(seed, { overlay, world: LIGHT })),
          ...shownIn(seedMemory(seed, { overlay, world: DARK })),
        });
        expect(Object.values(told(seed.revealSahasrahla))).toEqual([
          "greenPendant",
        ]);
        expect(Object.values(told(seed.revealBombShop))).toEqual([
          "redCrystal",
          "redCrystal",
        ]);
      });
    });
  }
});

describe("decodePrizes", () => {
  const [seed] = seeds.seeds.filter((s) => s.mapMode === 1);
  const prizes = spoiled(seed);
  const eastern = DUNGEON.P1.bit;
  const swamp = DUNGEON.D2.bit;

  it("tells a finished dungeon's prize in either world, no other", () => {
    for (const world of [LIGHT, DARK]) {
      expect(
        decodePrizes(seedMemory(seed, { completed: eastern | swamp, world }), {
          race: false,
        }),
      ).toEqual({ D2: prizes.D2, P1: prizes.P1 });
    }
  });

  it("tells an unfinished dungeon's prize once its map is held, in its world", () => {
    const held = (world: number) =>
      decodePrizes(seedMemory(seed, { maps: eastern | swamp, world }), {
        race: false,
      });
    expect(held(LIGHT)).toEqual({ P1: prizes.P1 });
    expect(held(DARK)).toEqual({ D2: prizes.D2 });
    expect(
      decodePrizes(seedMemory(seed, { maps: 0, world: LIGHT }), {
        race: false,
      }),
    ).toEqual({});
  });

  it("shows every prize of a world with map mode $00, a map or not", () => {
    const always = { ...seed, mapMode: 0 };
    expect(
      Object.keys(
        decodePrizes(seedMemory(always, { world: LIGHT }), { race: false }),
      ).sort(),
    ).toEqual(["P1", "P2", "P3"]);
  });

  it("says why it shows each prize, finishing first", () => {
    const why = (memory: MemoryView) => {
      const reading = decodeShown(memory, { race: false });
      if (typeof reading === "string") throw new Error(reading);
      return Object.fromEntries(
        Object.entries(reading).map(([code, { shownBy }]) => [code, shownBy]),
      );
    };
    const hera = DUNGEON.P3.bit;
    const desert = DUNGEON.P2.bit;
    expect(
      why(
        seedMemory(seed, {
          completed: eastern,
          maps: eastern | desert,
          overlay: hera,
          world: LIGHT,
        }),
      ),
    ).toEqual({ P1: "finished", P2: "map", P3: "mark" });
    expect(why(seedMemory({ ...seed, mapMode: 0 }, { world: LIGHT }))).toEqual({
      P1: "map-mode",
      P2: "map-mode",
      P3: "map-mode",
    });
  });

  it("honours the map's whole-world bits", () => {
    expect(
      Object.keys(
        decodePrizes(seedMemory(seed, { overlay: 0x0002, world: DARK }), {
          race: false,
        }),
      ),
    ).toHaveLength(7);
    expect(
      decodePrizes(seedMemory(seed, { overlay: 0x0002, world: LIGHT }), {
        race: false,
      }),
    ).toEqual({});
  });

  it("shows nothing on the map it cannot place: world or map mode unread", () => {
    const ranges = {
      "dungeons-completed": word(eastern),
      maps: word(ALL),
      "prize-bits": seed.prizeBits,
      "prize-kinds": seed.prizeKinds,
    };
    expect(decodePrizes(view(ranges), { race: false })).toEqual({
      P1: prizes.P1,
    });
    expect(
      decodePrizes(view({ ...ranges, "map-mode": [0x00] }), { race: false }),
    ).toEqual({ P1: prizes.P1 });
  });

  it("tells nothing without the ROM's tables, or from a zero-filled ROM", () => {
    expect(
      decodePrizes(view({ "dungeons-completed": word(ALL) }), { race: false }),
    ).toBe("not-read");
    expect(
      decodePrizes(
        view({
          "current-world": [LIGHT],
          "dungeons-completed": word(ALL),
          "map-mode": [0],
          "prize-bits": Array(11).fill(0),
          "prize-kinds": Array(11).fill(0),
        }),
        { race: false },
      ),
    ).toEqual({});
  });

  it("reads nothing in Race Mode, whose profile forbids every range it reads", () => {
    const asked: string[] = [];
    const memory: MemoryView = {
      bytes: (id) => {
        asked.push(id);
        return new Uint8Array(0x10);
      },
      has: (id) => {
        asked.push(id);
        return true;
      },
    };
    expect(decodePrizes(memory, { race: true })).toBe("race-mode");
    expect(asked).toEqual([]);
    for (const id of [
      "prize-bits",
      "prize-kinds",
      "map-mode",
      "map-overlay",
      "current-world",
    ] as const) {
      expect(
        ALTTPR_RACE_PROFILE.categories[MEMORY_RANGE[id].category]?.permitted,
      ).toBe(false);
    }
  });

  it("classes only the bytes vt writes", () => {
    expect(prizeClass(0x04, 0x00)).toBe("greenPendant");
    expect(prizeClass(0x01, 0x00)).toBe("pendant");
    expect(prizeClass(0x02, 0x00)).toBe("pendant");
    expect(prizeClass(0x04, 0x40)).toBe("redCrystal");
    expect(prizeClass(0x01, 0x40)).toBe("redCrystal");
    expect(prizeClass(0x02, 0x40)).toBe("crystal");
    expect(prizeClass(0x08, 0x40)).toBe("crystal");
    expect(prizeClass(0x08, 0x00)).toBeNull();
    expect(prizeClass(0x04, 0x80)).toBeNull();
    expect(prizeClass(0x00, 0x40)).toBeNull();
  });
});
