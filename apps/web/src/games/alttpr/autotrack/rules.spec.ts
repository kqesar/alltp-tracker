// Autotracking held to the rules: a console holding every item, read and
// laid on a fresh board in each world and dungeon item level the app
// tracks, gives the rules every pack item at the level the game holds, but
// for the reviewed exceptions below. The pack's specs prove each decoder
// reads its byte, and logic/atoms.spec.ts that the board can record what
// the rules read; this one proves the two meet. An item memory holds that
// no cell carries to the logic fails here: the hearts and the escape's Ten
// Bombs did until 2.52.0.
import {
  ITEMS,
  type ItemId,
  LEGACY_DUNGEONS,
  toState,
} from "@alltp/pack-alttpr";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type Board,
  gameView,
  keysInHand,
  mergeView,
} from "@/games/alttpr/autotrack/apply";
import {
  checkIn,
  readingOf,
  SAVE,
  seedMemory,
  writePrizeTables,
} from "@/games/alttpr/autotrack/fixtures";
import {
  type DungeonItems,
  getPreset,
  type RunSettings,
} from "@/games/alttpr/data/presets";
import { packSettings } from "@/games/alttpr/logic/settings";
import { trackerInput } from "@/games/alttpr/logic/solution";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/**
 * A console in play holding every item at its top, as z3randomizer's SRAM
 * map lays them out (sram.asm:80-185), every boss beaten and every prize
 * taken, with the seed's prize tables, which the world map draws from the
 * start (MapMode $00).
 */
const holdingEverything = (race: boolean) => {
  const memory = writePrizeTables(seedMemory({ race }), 0x00);
  // The equipment, a byte each (sram.asm:80-110): held at 1, the mirror at
  // 2 (1 is the scroll), the levels at their top
  for (let offset = 0x341; offset <= 0x357; offset++) memory[SAVE(offset)] = 1;
  memory[SAVE(0x353)] = 0x02; // the mirror
  memory[SAVE(0x354)] = 0x02; // Titan's Mitt
  memory[SAVE(0x359)] = 0x04; // the gold sword
  memory[SAVE(0x35a)] = 0x03; // the mirror shield
  memory[SAVE(0x35b)] = 0x02; // the red mail
  // Four empty bottles (sram.asm:111-115)
  memory.fill(0x02, SAVE(0x35c), SAVE(0x360));
  // Every compass, big key and map (sram.asm:119-126)
  memory.fill(0xff, SAVE(0x364), SAVE(0x36a));
  memory[SAVE(0x36c)] = 0xa0; // 20 hearts (sram.asm:131-132)
  memory[SAVE(0x374)] = 0x07; // the three pendants (sram.asm:139-140)
  memory[SAVE(0x37a)] = 0x7f; // the seven crystals (sram.asm:148-150)
  memory[SAVE(0x37b)] = 0x02; // quarter magic (sram.asm:151)
  // Small keys in hand, more than any dungeon's (sram.asm:153-168)
  memory.fill(9, SAVE(0x37c), SAVE(0x38a));
  // InventoryTracking: every bit, the flute active, any bomb (sram.asm:
  // 175-179); BowTracking: the bow, the silver arrows, both progressive
  // bows (sram.asm:180-185)
  memory.set([0xff, 0x03, 0xf0], SAVE(0x38c));
  memory[SAVE(0x3c5)] = 0x03; // Agahnim defeated (sram.asm:191-193)
  memory[SAVE(0x3cc)] = 0x0d; // Link carries the big bomb (sram.asm:211)
  memory[SAVE(0x40f)] = 0x01; // Agahnim 2 too (events.asm:104-106)
  memory.fill(0xff, SAVE(0x472), SAVE(0x474)); // every prize taken
  for (const dungeon of LEGACY_DUNGEONS) checkIn(memory, `${dungeon}/boss`);
  return memory;
};

/** A fresh board of a run, as the store starts it. */
const freshBoard = (settings: RunSettings): Board => {
  useGameStore.getState().applyRun("open", settings);
  const { checked, items, medallions, smallKeys } = useGameStore.getState();
  return { checked, items, medallions, settings, smallKeys };
};

/**
 * The pack items the rules get below the level the game holds, once the
 * game is read and laid on a fresh board as the follower lays it.
 * @param drop - Board cells left out of the game's view, for the spec that
 * shows this one fails
 */
const shortOf = (
  settings: RunSettings,
  race: boolean,
  drop: readonly string[] = [],
): string[] => {
  const board = freshBoard(settings);
  const reading = readingOf(holdingEverything(race), { race });
  // The follower latches the big bomb as it sees it carried
  const view = gameView(
    reading,
    board,
    keysInHand(reading),
    {},
    reading.progress.bigBomb === true,
  );
  const items = { ...view.items };
  for (const id of drop) delete items[id];
  const laid = mergeView(board, { ...view, items });
  const state = toState(
    trackerInput({ ...board, ...laid?.next }),
    packSettings(settings),
  ) as Readonly<Record<string, number>>;
  return ITEMS.filter(({ id, max }) => (state[id] ?? 0) < max).map(
    ({ id }) => id,
  );
};

/** What the game holds that the rules never get from it, and why. */
const EXCEPTIONS: Readonly<Partial<Record<ItemId, string>>> = {
  // The silver bow: the board shows the bow and its silver arrows, which
  // canShootArrows2 reads beside it (`bow >= 2 | silverArrowUpgrade & bow`)
  bow: "the silver bow, as the bow and the silver arrows",
  // No memory says a shop sells them: the player marks the shop found
  shopArrow: "a retro shop's arrows",
  shopKey: "a retro shop's keys",
};

/**
 * The big bomb, which no flag keeps (check-flags.ts, UNMAPPED_LOCATIONS):
 * the follower latches the Bomb Merchant from the bomb carried, outside
 * Race Mode (the follower byte also says Zelda follows) and in the one
 * world whose map has the Merchant, Inverted, whose Pyramid Fairy wants it.
 */
const bombShort = (mode: RunSettings["mode"], race: boolean) =>
  race || mode !== "inverted";

/** The small keys, which the board records only while they leave their dungeons. */
const SMALL_KEYS = ITEMS.map(({ id }) => id).filter((id) =>
  /^key[A-Z]\d$/.test(id),
);

/**
 * What Race Mode keeps from the rules beside the exceptions and the bomb:
 * nothing. The bottles (v2.0's bottle contents) and the pendants and
 * crystals (prizes upon collection) reach them; the crystals as a count,
 * which gives all seven here, red ones included, only because seven
 * crystals leave none regular to count.
 */
const RACE_WITHHELD: readonly ItemId[] = [];

const RUNS = (["open", "standard", "inverted", "retro"] as const).flatMap(
  (mode) =>
    (["standard", "mc", "mcs", "full"] as const).map(
      (dungeonItems: DungeonItems) => ({
        dungeonItems,
        mode,
        name: `${mode} ${dungeonItems}`,
        settings: { ...getPreset("open").settings, dungeonItems, mode },
      }),
    ),
);

/**
 * The items a run's rules never get from the game: the exceptions, and the
 * small keys while the board does not record them (in their dungeons, the
 * key model holds them; retro's generic keys, the key model never vouches
 * for one).
 */
const expectedShort = (
  mode: RunSettings["mode"],
  dungeonItems: DungeonItems,
  race: boolean,
) => {
  const keysOnBoard =
    mode !== "retro" && (dungeonItems === "mcs" || dungeonItems === "full");
  return ITEMS.map(({ id }) => id).filter(
    (id) =>
      id in EXCEPTIONS ||
      (id === "bigRedBomb" && bombShort(mode, race)) ||
      (!keysOnBoard && SMALL_KEYS.includes(id)) ||
      (race && RACE_WITHHELD.includes(id)),
  );
};

beforeEach(() => {
  useGameStore.setState(useGameStore.getInitialState(), true);
});

describe("autotracking feeds the rules", () => {
  it.each(RUNS)(
    "every item the game holds, but the exceptions: $name",
    ({ dungeonItems, mode, settings }) => {
      expect(shortOf(settings, false)).toEqual(
        expectedShort(mode, dungeonItems, false),
      );
    },
  );

  it.each(RUNS)(
    "in Race Mode, all but what the race profile keeps: $name",
    ({ dungeonItems, mode, settings }) => {
      expect(shortOf(settings, true)).toEqual(
        expectedShort(mode, dungeonItems, true),
      );
    },
  );

  it("gives the silver bow as the bow and its silver arrows", () => {
    const settings = getPreset("open").settings;
    const board = freshBoard(settings);
    const reading = readingOf(holdingEverything(false));
    const laid = mergeView(board, gameView(reading, board));
    const state = toState(
      trackerInput({ ...board, ...laid?.next }),
      packSettings(settings),
    ) as Readonly<Record<string, number>>;
    expect(reading.items.counts.bow).toBe(2);
    expect([state.bow, state.silverArrowUpgrade]).toEqual([1, 1]);
  });

  it("would catch what the game holds that no cell lays on the board", () => {
    // The board before 2.52.0: no hearts cell, no Ten Bombs
    const short = shortOf(getPreset("open").settings, false, [
      "hearts",
      "tenbombs",
    ]);
    expect(short).toEqual(
      expect.arrayContaining(["heartContainer", "pieceOfHeart", "tenBombs"]),
    );
  });

  it("would catch the flute activated, and the prizes a race reads, left off the board", () => {
    // The board before 2.53: no cell for them
    const settings = getPreset("open").settings;
    const cells = ["fluteactive", "heldcrystals", "heldgreen", "heldpendants"];
    expect(shortOf(settings, false, cells)).toContain("flute");
    expect(shortOf(settings, true, cells)).toEqual(
      expect.arrayContaining([
        "flute",
        "crystal1",
        "crystal5",
        "pendantOfCourage",
        "pendantOfPower",
      ]),
    );
  });
});
