import { beforeEach, describe, expect, it } from "vitest";
import {
  type Board,
  gameView,
  isEmptyView,
  medallionsShown,
  mergeView,
  newsOf,
  syncView,
} from "@/games/alttpr/autotrack/apply";
import {
  checkIn,
  openEntrance,
  readingOf,
  SAVE,
  seedMemory,
  standOn,
  writeMedallions,
  writePrizeTables,
} from "@/games/alttpr/autotrack/fixtures";
import { DUNGEON_INDICES, MEDALLION_VALUES } from "@/games/alttpr/constants";
import { getPreset } from "@/games/alttpr/data/presets";
import { counterMax } from "@/games/alttpr/logic/settings";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** A new run of a preset, as the store starts it. */
const fresh = (presetId = "open"): Board => {
  useGameStore.getState().applyPreset(presetId);
  const { checked, items, medallions, settings, smallKeys } =
    useGameStore.getState();
  return { checked, items, medallions, settings, smallKeys };
};

/** A board changed by hand from a fresh one. */
const marked = (
  board: Board,
  items: Record<string, number | boolean>,
  checked: readonly string[] = [],
): Board => ({
  ...board,
  checked: {
    ...board.checked,
    ...Object.fromEntries(checked.map((id) => [id, true as const])),
  },
  items: { ...board.items, ...items },
});

/** Sets bits of a little-endian word of the save data. */
const orWord = (memory: Uint8Array, offset: number, bits: number) => {
  memory[SAVE(offset)] |= bits & 0xff;
  memory[SAVE(offset) + 1] |= bits >> 8;
};

/**
 * A dungeon's bit in DungeonsCompleted, MapField and MapOverlay (the pack's
 * DUNGEONS).
 */
const EASTERN = 0x2000;
const DESERT = 0x1000;
const SWAMP = 0x0400;
const PALACE_OF_DARKNESS = 0x0200;
const HERA = 0x0020;

const OPEN = getPreset("open").settings;
const KEYSANITY = getPreset("keysanity").settings;

beforeEach(() => {
  useGameStore.setState(useGameStore.getInitialState(), true);
});

describe("gameView", () => {
  it("reads the board's items, bosses and checks from a game in play", () => {
    const view = gameView(readingOf(seedMemory({ race: false })), fresh());

    expect(view.items).toMatchObject({
      agahnim: 0,
      boss0: 2,
      boss1: 1,
      bottle: 1,
      bow: 0,
      hookshot: true,
      moonpearl: false,
      sword: 2,
      tunic: 1,
    });
    // No dungeon finished: no prize to tell
    expect(view.items).not.toHaveProperty("reward0");
    expect(view.checked).toMatchObject({
      "eastern-palace/boss": true,
      "eastern-palace/compass-chest": true,
      "kings-tomb": false,
      "links-house": true,
    });
    expect(view.smallKeys).toEqual({});
  });

  it("counts a dungeon's items left from its checked locations", () => {
    const memory = seedMemory({ race: false });
    const before = gameView(readingOf(memory), fresh());
    // Two of Eastern Palace's three items found: the compass chest held one
    expect(before.counters.chest0).toEqual([1, 1]);
    expect(before.counters.chest3).toEqual([
      counterMax(3, OPEN),
      counterMax(3, OPEN),
    ]);

    // The compass, which stays inside: the compass chest held no item
    orWord(memory, 0x364, 0x2000);
    expect(gameView(readingOf(memory), fresh()).counters.chest0).toEqual([
      2, 2,
    ]);
  });

  it("tells a chest that held a small key from one that held an item", () => {
    const memory = seedMemory({ race: false });
    checkIn(memory, "desert-palace/map-chest");
    checkIn(memory, "desert-palace/torch");

    // Desert Palace's two items, and one small key among its locations: no
    // key found, so both held items
    expect(counterMax(1, OPEN)).toBe(2);
    expect(gameView(readingOf(memory), fresh()).counters.chest1).toEqual([
      0, 0,
    ]);
    // The base patch counts the key found: one of the two held it
    memory[SAVE(0x4e0 + 3)] = 1;
    expect(gameView(readingOf(memory), fresh()).counters.chest1).toEqual([
      1, 1,
    ]);
    // A key in hand an enemy dropped is no location's
    memory[SAVE(0x4e0 + 3)] = 0;
    memory[SAVE(0x37c + 3)] = 1;
    expect(gameView(readingOf(memory), fresh()).counters.chest1).toEqual([
      0, 0,
    ]);
  });

  it("counts Ganon's Tower's items left too, on its own cell", () => {
    const memory = seedMemory({ race: false });
    const keysanity = fresh("keysanity");
    expect(gameView(readingOf(memory), keysanity).counters.chest12).toEqual([
      27, 27,
    ]);

    checkIn(memory, "ganons-tower/bobs-torch");
    checkIn(memory, "ganons-tower/tile-room");
    expect(gameView(readingOf(memory), keysanity).counters.chest12).toEqual([
      25, 25,
    ]);
  });

  it("counts every location with keysanity", () => {
    const view = gameView(
      readingOf(seedMemory({ race: false })),
      fresh("keysanity"),
    );

    expect(view.counters.chest0).toEqual([
      counterMax(0, KEYSANITY) - 2,
      counterMax(0, KEYSANITY) - 2,
    ]);
  });

  it("tells a dungeon's prize when only one fits", () => {
    const memory = seedMemory({ race: false });
    orWord(memory, 0x472, EASTERN);
    // The Pendant of Courage, and one dungeon finished
    expect(gameView(readingOf(memory), fresh()).items.reward0).toBe(1);

    orWord(memory, 0x472, DESERT);
    memory[SAVE(0x37a)] |= 0x04; // crystal 5
    // Two dungeons, two classes: either way round
    const both = gameView(readingOf(memory), fresh()).items;
    expect(both).not.toHaveProperty("reward0");
    expect(both).not.toHaveProperty("reward1");
    // The player named Eastern Palace's: Desert Palace's is the red crystal
    const named = gameView(readingOf(memory), marked(fresh(), { reward0: 1 }));
    expect(named.items.reward1).toBe(4);
    // A name the game contradicts tells nothing
    const wrong = gameView(readingOf(memory), marked(fresh(), { reward0: 3 }));
    expect(wrong.items).not.toHaveProperty("reward1");
  });

  it("tells every prize at once when they are all of one class", () => {
    const memory = seedMemory({ race: false });
    memory[SAVE(0x374)] = 0; // no pendant
    memory[SAVE(0x37a)] = 0x04 | 0x01; // crystals 5 and 6
    orWord(memory, 0x472, EASTERN | DESERT);

    expect(gameView(readingOf(memory), fresh()).items).toMatchObject({
      reward0: 4,
      reward1: 4,
    });
  });

  describe("with the ROM's prize tables", () => {
    /** Desert Palace (crystal 1) and Swamp Palace (crystal 5) finished. */
    const midRun = () => {
      const memory = writePrizeTables(seedMemory({ race: false }));
      memory[SAVE(0x374)] = 0; // no pendant
      memory[SAVE(0x37a)] = 0x02 | 0x04; // crystals 1 and 5
      orWord(memory, 0x472, DESERT | SWAMP);
      return memory;
    };
    const rewards = (items: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(items).filter(([id]) => id.startsWith("reward")),
      );

    it("names each finished dungeon's prize where elimination cannot", () => {
      const memory = midRun();
      // Without the tables: a crystal and a red crystal, either way round
      const blind = gameView(
        readingOf(memory, { unread: ["prize-bits"] }),
        fresh(),
      );
      expect(rewards(blind.items)).toEqual({});
      // With them: exactly, and no unfinished dungeon's (map mode $01, no map)
      const view = gameView(readingOf(memory), fresh());
      expect(rewards(view.items)).toEqual({ reward1: 3, reward4: 4 });
    });

    it("names an unfinished dungeon's prize once the world map shows it", () => {
      const memory = midRun();
      orWord(memory, 0x368, EASTERN | PALACE_OF_DARKNESS); // their maps
      // In the Light World, Eastern Palace's: a pendant
      expect(rewards(gameView(readingOf(memory), fresh()).items)).toEqual({
        reward0: 2,
        reward1: 3,
        reward4: 4,
      });
      // In the Dark World, the Palace of Darkness's
      memory[SAVE(0x3ca)] = 0x40;
      expect(rewards(gameView(readingOf(memory), fresh()).items)).toEqual({
        reward1: 3,
        reward3: 2,
        reward4: 4,
      });
      // Sahasrahla's reveal: Tower of Hera, the Pendant of Courage
      memory[SAVE(0x3ca)] = 0x00;
      orWord(memory, 0x414, HERA);
      expect(gameView(readingOf(memory), fresh()).items.reward2).toBe(1);
    });

    it("names every prize of Link's world where the map always shows them", () => {
      const memory = writePrizeTables(seedMemory({ race: false }), 0x00);
      expect(rewards(gameView(readingOf(memory), fresh()).items)).toEqual({
        reward0: 2,
        reward1: 3,
        reward2: 1,
      });
    });

    it("keeps the prize the player named, merged or synced", () => {
      const memory = midRun();
      const board = marked(fresh(), { reward4: 3 });
      const view = gameView(readingOf(memory), board);
      expect(rewards(view.items)).toEqual({ reward1: 3 });
      expect(mergeView(board, view)?.next.items?.reward4).toBe(3);
      expect(syncView(board, view)?.next.items?.reward4).toBe(3);
    });

    it("tells no prize in Race Mode", () => {
      const memory = midRun();
      memory.set([0x01, 0x00], 0x18_0213); // the race flag
      const view = gameView(readingOf(memory, { race: true }), fresh());
      expect(rewards(view.items)).toEqual({});
    });
  });

  it("reads the second progressive bow as the bow with its silver arrows", () => {
    const memory = seedMemory({ race: false });
    memory[SAVE(0x38e)] = 0x10 | 0x20 | 0x40;
    expect(gameView(readingOf(memory), fresh()).items.bow).toBe(3);

    memory[SAVE(0x38e)] = 0x80; // a plain bow
    expect(gameView(readingOf(memory), fresh()).items.bow).toBe(2);
    memory[SAVE(0x38e)] = 0x40; // the silver arrows alone
    expect(gameView(readingOf(memory), fresh()).items.bow).toBe(1);
  });

  it("lays in Race Mode what v2.0 permits, and leaves the rest out", () => {
    const memory = seedMemory({ race: true });
    orWord(memory, 0x472, EASTERN);
    memory[SAVE(0x3cc)] = 0x0d; // Link carries the big bomb
    const raced = readingOf(memory, { race: true });
    const view = gameView(raced, fresh(), {}, true);

    // The bottles (bottle contents) and the prizes held by class (prizes
    // upon collection), the green pendant by name
    expect(view.items).toMatchObject({
      boss0: 2,
      bottle: 1,
      heldcrystals: 0,
      heldgreen: 1,
      heldpendants: 0,
      hookshot: true,
      sword: 2,
    });
    // No dungeon's prize named: the casual reading names Eastern Palace's
    // by elimination (its pendant the only prize held), a race never ties
    // a prize to its dungeon
    expect(gameView(readingOf(memory), fresh()).items.reward0).toBe(1);
    expect(view.items).not.toHaveProperty("reward0");
    // Nor Zelda's rescue: the escape not known, done as by hand, whatever a
    // reading before the race said
    expect(view.items.escape).toBe(0);
    // The checks inside dungeons (dungeon-locations), and the counter
    expect(view.checked).toMatchObject({
      "eastern-palace/boss": true,
      "eastern-palace/compass-chest": true,
      "links-house": true,
    });
    expect(view.counters.chest0).toEqual([1, 1]);
    // The big bomb, though latched, is no check in Open, and the follower
    // latches none in a race (follow.spec.ts)
    expect(view.checked).not.toHaveProperty("bomb-merchant");
    expect(raced.progress.bigBomb).toBe("race-mode");
  });

  it("leaves out what was not read yet", () => {
    const memory = seedMemory({ race: false });
    orWord(memory, 0x472, EASTERN);
    const view = gameView(
      readingOf(memory, {
        unread: [
          "equipment-a",
          "dungeons-completed",
          "eastern-palace-boss-room",
        ],
      }),
      fresh(),
    );

    expect(view.items).not.toHaveProperty("hookshot");
    expect(view.items).toMatchObject({ boss1: 1, sword: 2 });
    // Not whether the dungeon was finished, nor its boss beaten
    expect(view.items).not.toHaveProperty("reward0");
    expect(view.items).not.toHaveProperty("boss0");
  });

  it("counts small keys with keysanity only, within each dungeon's", () => {
    const memory = seedMemory({ race: false });
    memory[SAVE(0x4e0 + 6)] = 2; // two Palace of Darkness keys found
    memory[SAVE(0x37c + 6)] = 0; // and spent on doors
    memory[SAVE(0x37c + 5)] = 1; // a Swamp Palace key a pot dropped, held
    memory[SAVE(0x4e0 + 10)] = 2; // Tower of Hera's basement key, counted twice
    const reading = readingOf(memory);

    expect(gameView(reading, fresh("keysanity")).smallKeys).toMatchObject({
      2: 1,
      3: 2,
      4: 0,
    });
    expect(gameView(reading, fresh()).smallKeys).toEqual({});
    // Small keys leave their dungeons from MCS Shuffle up, not MC
    const level = (dungeonItems: "mc" | "mcs") => {
      useGameStore.getState().applyRun("open", { ...OPEN, dungeonItems });
      const { checked, items, medallions, settings, smallKeys } =
        useGameStore.getState();
      return { checked, items, medallions, settings, smallKeys };
    };
    expect(gameView(reading, level("mcs")).smallKeys).toMatchObject({ 3: 2 });
    expect(gameView(reading, level("mc")).smallKeys).toEqual({});
  });
});

describe("newsOf", () => {
  it("holds only what changed since the last view", () => {
    const memory = seedMemory({ race: false });
    const before = gameView(readingOf(memory), fresh());
    expect(isEmptyView(newsOf(before, before))).toBe(true);

    memory[SAVE(0x357)] = 0x01; // Moon Pearl
    checkIn(memory, "kings-tomb");
    const news = newsOf(before, gameView(readingOf(memory), fresh()));

    expect(news.items).toEqual({ moonpearl: true });
    expect(news.checked).toEqual({ "kings-tomb": true });
    expect(news.counters).toEqual({});
    expect(isEmptyView(news)).toBe(false);
  });

  it("counts every counter and key as news for a run of other settings", () => {
    const memory = seedMemory({ race: false });
    memory[SAVE(0x4e0 + 6)] = 1; // a Palace of Darkness key found
    const reading = readingOf(memory);
    const open = gameView(reading, fresh());
    const keysanity = gameView(reading, fresh("keysanity"));

    const news = newsOf(open, keysanity);

    expect(news.counters).toEqual(keysanity.counters);
    expect(news.smallKeys).toEqual(keysanity.smallKeys);
    expect(news.smallKeys[3]).toBe(1);
    expect(news.items).toEqual({});
  });
});

describe("mergeView", () => {
  it("raises the board to the game", () => {
    const board = fresh();
    const laid = mergeView(
      board,
      gameView(readingOf(seedMemory({ race: false })), board),
    );

    expect(laid?.next.items).toMatchObject({
      boss0: 2,
      bottle: 1,
      chest0: 1,
      // Zelda in the Sanctuary, the green pendant held
      escape: 2,
      // No flute: read, not activated
      fluteactive: 2,
      heldgreen: 1,
      hookshot: true,
      sword: 2,
      // No Ten Bombs found: known, none
      tenbombs: 1,
    });
    expect(laid?.next.checked).toEqual({
      "eastern-palace/boss": true,
      "eastern-palace/compass-chest": true,
      "links-house": true,
    });
    // Hookshot, sword, bottle, Armos Knights, the counter, the bombs, the
    // escape, the green pendant, the flute not activated, three checks
    expect(laid?.count).toBe(12);
  });

  it("never undoes what the player marked beyond the game", () => {
    const memory = seedMemory({ race: false });
    memory[SAVE(0x38e)] = 0x80; // a plain bow
    const board = marked(
      fresh(),
      { bow: 1, chest0: 0, hookshot: true, sword: 3 },
      ["kings-tomb"],
    );

    const laid = mergeView(board, gameView(readingOf(memory), board));

    // The silver arrows marked by hand join the game's bow
    expect(laid?.next.items).toMatchObject({
      bow: 3,
      chest0: 0,
      hookshot: true,
      sword: 3,
    });
    expect(laid?.next.checked).toMatchObject({ "kings-tomb": true });
  });

  it("changes nothing, and says so, when the board holds it all", () => {
    const board = fresh();
    const view = gameView(readingOf(seedMemory({ race: false })), board);
    const merged = { ...board, ...mergeView(board, view)?.next };

    expect(mergeView(merged, view)).toBeNull();
  });

  it("returns only the slices it changes", () => {
    const board = fresh();
    const memory = seedMemory({ race: false });
    const view = gameView(readingOf(memory), board);
    const merged = { ...board, ...mergeView(board, view)?.next };
    checkIn(memory, "kings-tomb");

    const laid = mergeView(merged, gameView(readingOf(memory), merged));

    expect(laid?.next).toEqual({
      checked: { ...merged.checked, "kings-tomb": true },
    });
  });

  it("raises the small keys found with keysanity", () => {
    const board = marked(fresh("keysanity"), {});
    const memory = seedMemory({ race: false });
    memory[SAVE(0x4e0 + 6)] = 2; // two Palace of Darkness keys found
    const reading = readingOf(memory);
    const laid = mergeView(board, gameView(reading, board));

    expect(laid?.next.smallKeys).toEqual([
      0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    // A count the player set higher stays
    const higher = {
      ...board,
      smallKeys: [0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    };
    expect(
      mergeView(higher, gameView(reading, higher))?.next.smallKeys,
    ).toBeUndefined();
  });

  it("lays no counter or key count of another run's view", () => {
    const memory = seedMemory({ race: false });
    memory[SAVE(0x4e0 + 6)] = 2;
    const view = gameView(readingOf(memory), fresh());
    const board = fresh("keysanity");

    const laid = mergeView(board, view);

    expect(laid?.next.items?.chest0).toBe(board.items.chest0);
    expect(laid?.next.smallKeys).toBeUndefined();
  });
});

describe("syncView", () => {
  it("sets the board to the game, the player's marks beyond it included", () => {
    const board = marked(
      fresh(),
      { bow: 1, chest0: 0, moonpearl: true, sword: 3 },
      ["kings-tomb", "links-house"],
    );

    const laid = syncView(
      board,
      gameView(readingOf(seedMemory({ race: false })), board),
    );

    expect(laid?.next.items).toMatchObject({
      bow: 0,
      // The counter goes up to the least the game allows, no further
      chest0: 1,
      hookshot: true,
      moonpearl: false,
      sword: 2,
    });
    expect(laid?.next.checked).toEqual({
      "eastern-palace/boss": true,
      "eastern-palace/compass-chest": true,
      "links-house": true,
    });
  });

  it("sets the small keys found to the game's count", () => {
    const memory = seedMemory({ race: false });
    // The game counts the keys found: the player's count beyond it goes
    memory[SAVE(0x4e0 + 6)] = 2;
    const board = {
      ...marked(fresh("keysanity"), {}),
      smallKeys: [0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    };
    expect(
      syncView(board, gameView(readingOf(memory), board))?.next.smallKeys?.[3],
    ).toBe(2);
  });

  it("leaves what Race Mode withholds as the player marked it", () => {
    const memory = seedMemory({ race: true });
    orWord(memory, 0x472, EASTERN);
    const board = marked(
      fresh(),
      { bottle: 4, chest0: 0, escape: 1, reward0: 3 },
      ["eastern-palace/big-chest", "kings-tomb"],
    );

    const laid = syncView(
      board,
      gameView(readingOf(memory, { race: true }), board),
    );

    expect(laid?.next.items).toMatchObject({
      // What a race reads: the bottles, and the counter from the checks
      bottle: 1,
      chest0: 1,
      // What it does not: the dungeon's prize, kept as the player named it;
      // Zelda's rescue, an escape read before the race no longer known
      escape: 0,
      hookshot: true,
      reward0: 3,
      sword: 2,
    });
    // The game tells the checks, inside dungeons too
    expect(laid?.next.checked).toEqual({
      "eastern-palace/boss": true,
      "eastern-palace/compass-chest": true,
      "links-house": true,
    });
  });
});

describe("the pads' medallions", () => {
  const MIRE = DUNGEON_INDICES.MISERY_MIRE;
  const ROCK = DUNGEON_INDICES.TURTLE_ROCK;
  /** A seed asking Ether at the Mire and Quake at Turtle Rock, Link on `screen`. */
  const standing = (screen: number) =>
    standOn(writeMedallions(seedMemory({ race: false }), 1, 2), screen);

  it("lays the medallion of the pad Link stands at, and no other", () => {
    const board = fresh();
    const mire = gameView(readingOf(standing(0x70)), board);
    expect(mire.medallions).toEqual({ [MIRE]: MEDALLION_VALUES.ETHER });
    expect(mergeView(board, mire)?.next.medallions).toEqual(
      board.medallions.map((value, i) =>
        i === MIRE ? MEDALLION_VALUES.ETHER : value,
      ),
    );

    const rock = gameView(readingOf(standing(0x47)), board);
    expect(rock.medallions).toEqual({ [ROCK]: MEDALLION_VALUES.QUAKE });
    expect(gameView(readingOf(standing(0x30)), board).medallions).toEqual({});
  });

  it("lays a pad's medallion once its entrance is open, wherever Link is", () => {
    const memory = openEntrance(standing(0x30), 0x47);
    expect(gameView(readingOf(memory), fresh()).medallions).toEqual({
      [ROCK]: MEDALLION_VALUES.QUAKE,
    });
  });

  it("keeps what was shown when a later reading shows none", () => {
    const board = fresh();
    const shown = medallionsShown(readingOf(standing(0x70)));
    const away = readingOf(standing(0x30));
    expect(gameView(away, board).medallions).toEqual({});
    expect(gameView(away, board, shown).medallions).toEqual({
      [MIRE]: MEDALLION_VALUES.ETHER,
    });
  });

  it("lays nothing in Race Mode, whose snapshot holds no ROM byte", () => {
    const view = gameView(readingOf(standing(0x70), { race: true }), fresh());
    expect(view.medallions).toEqual({});
  });

  it("leaves a medallion the player named theirs, on a merge only", () => {
    const board = fresh();
    const named = board.medallions.map((value, i) =>
      i === MIRE ? MEDALLION_VALUES.BOMBOS : value,
    );
    const mine = { ...board, medallions: named };
    const view = gameView(readingOf(standing(0x70)), mine);

    expect(mergeView(mine, view)?.next.medallions).toBeUndefined();
    expect(syncView(mine, view)?.next.medallions?.[MIRE]).toBe(
      MEDALLION_VALUES.ETHER,
    );
  });

  it("is news once, not again on a reading that shows it still", () => {
    const board = fresh();
    const away = gameView(readingOf(standing(0x30)), board);
    const first = gameView(readingOf(standing(0x70)), board);
    const again = gameView(readingOf(standing(0x70)), board);
    expect(isEmptyView(newsOf(first, again))).toBe(true);
    expect(newsOf(away, first).medallions).toEqual({
      [MIRE]: MEDALLION_VALUES.ETHER,
    });
  });
});

describe("the hearts", () => {
  /** A game showing `max` in MaximumHealth and `pieces` toward the next. */
  const showing = (max: number, pieces = 0) => {
    const memory = seedMemory({ race: false });
    memory[SAVE(0x36c)] = max;
    memory[SAVE(0x36b)] = pieces;
    return memory;
  };

  it("lays the hearts on screen from the game, Race Mode too", () => {
    // 10 hearts and three pieces: 10 on screen, the cell's 8
    const memory = showing(0x50, 3);
    for (const race of [false, true]) {
      const board = fresh();
      const view = gameView(readingOf(memory, { race }), board);
      expect(view.items.hearts, `race ${race}`).toBe(8);
      expect(mergeView(board, view)?.next.items?.hearts).toBe(8);
    }
    // 9 and three pieces stay 9: one short of the basic placement's 10
    expect(gameView(readingOf(showing(0x48, 3)), fresh()).items.hearts).toBe(7);
  });

  it("leaves the cell alone while the game shows no hearts", () => {
    const view = gameView(readingOf(showing(0)), fresh());
    expect(view.items).not.toHaveProperty("hearts");
  });

  it("keeps more hearts the player marked on a merge, and the game's on a sync", () => {
    const board = marked(fresh(), { hearts: 10 });
    const view = gameView(readingOf(showing(0x50)), board);
    expect(mergeView(board, view)?.next.items?.hearts ?? 10).toBe(10);
    expect(syncView(board, view)?.next.items?.hearts).toBe(8);
  });
});
