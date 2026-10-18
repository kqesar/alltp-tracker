import { beforeEach, describe, expect, it } from "vitest";
import {
  type Board,
  gameView,
  isEmptyView,
  keysInHand,
  mergeView,
  newsOf,
  syncView,
} from "@/autotrack/apply";
import { checkIn, readingOf, SAVE, seedMemory } from "@/autotrack/fixtures";
import { getPreset } from "@/data/presets";
import { counterMax } from "@/logic/settings";
import { useGameStore } from "@/stores/gameStore";

/** A new run of a preset, as the store starts it. */
const fresh = (presetId = "open"): Board => {
  useGameStore.getState().applyPreset(presetId);
  const { checked, items, settings, smallKeys } = useGameStore.getState();
  return { checked, items, settings, smallKeys };
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

/** DungeonsCompleted's bits: Eastern Palace's and Desert Palace's prize. */
const EASTERN = 0x2000;
const DESERT = 0x1000;

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

  it("keeps a counter open while a chest may have held a small key", () => {
    const memory = seedMemory({ race: false });
    checkIn(memory, "desert-palace/map-chest");
    checkIn(memory, "desert-palace/torch");

    // Desert Palace's two items, and one small key among its chests: both
    // items found, or one and the key
    expect(counterMax(1, OPEN)).toBe(2);
    expect(gameView(readingOf(memory), fresh()).counters.chest1).toEqual([
      0, 1,
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

  it("reads the second progressive bow as the bow with its silver arrows", () => {
    const memory = seedMemory({ race: false });
    memory[SAVE(0x38e)] = 0x10 | 0x20 | 0x40;
    expect(gameView(readingOf(memory), fresh()).items.bow).toBe(3);

    memory[SAVE(0x38e)] = 0x80; // a plain bow
    expect(gameView(readingOf(memory), fresh()).items.bow).toBe(2);
    memory[SAVE(0x38e)] = 0x40; // the silver arrows alone
    expect(gameView(readingOf(memory), fresh()).items.bow).toBe(1);
  });

  it("leaves what Race Mode withholds out", () => {
    const memory = seedMemory({ race: true });
    orWord(memory, 0x472, EASTERN);
    const view = gameView(readingOf(memory, { race: true }), fresh());

    expect(view.items).toMatchObject({ boss0: 2, hookshot: true, sword: 2 });
    // Bottles are on the HUD; pendants and crystals are prizes
    expect(view.items).not.toHaveProperty("bottle");
    expect(view.items).not.toHaveProperty("reward0");
    expect(view.checked).toMatchObject({ "links-house": true });
    expect(
      Object.keys(view.checked).filter((id) => id.startsWith("eastern-")),
    ).toEqual([]);
    expect(view.counters).toEqual({});
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
    memory[SAVE(0x37c + 6)] = 2; // Palace of Darkness keys in hand
    const reading = readingOf(memory);
    expect(keysInHand(reading)).toMatchObject({ 3: 2 });

    expect(gameView(reading, fresh("keysanity"), { 3: 2 }).smallKeys).toEqual({
      3: 2,
    });
    expect(gameView(reading, fresh("keysanity"), { 4: 9 }).smallKeys).toEqual({
      4: 1,
    });
    expect(gameView(reading, fresh(), { 3: 2 }).smallKeys).toEqual({});
    // Small keys leave their dungeons from MCS Shuffle up, not MC
    const level = (dungeonItems: "mc" | "mcs") => {
      useGameStore.getState().applyRun("open", { ...OPEN, dungeonItems });
      const { checked, items, settings, smallKeys } = useGameStore.getState();
      return { checked, items, settings, smallKeys };
    };
    expect(gameView(reading, level("mcs"), { 3: 2 }).smallKeys).toEqual({
      3: 2,
    });
    expect(gameView(reading, level("mc"), { 3: 2 }).smallKeys).toEqual({});
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
    const reading = readingOf(seedMemory({ race: false }));
    const open = gameView(reading, fresh());
    const keysanity = gameView(reading, fresh("keysanity"), { 3: 1 });

    const news = newsOf(open, keysanity);

    expect(news.counters).toEqual(keysanity.counters);
    expect(news.smallKeys).toEqual({ 3: 1 });
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
      hookshot: true,
      sword: 2,
    });
    expect(laid?.next.checked).toEqual({
      "eastern-palace/boss": true,
      "eastern-palace/compass-chest": true,
      "links-house": true,
    });
    // Hookshot, sword, bottle, Armos Knights, the counter, three checks
    expect(laid?.count).toBe(8);
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
    const reading = readingOf(seedMemory({ race: false }));
    const laid = mergeView(board, gameView(reading, board, { 3: 2, 9: 0 }));

    expect(laid?.next.smallKeys).toEqual([
      0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    // A count the player set higher stays
    const higher = {
      ...board,
      smallKeys: [0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    };
    expect(
      mergeView(higher, gameView(reading, higher, { 3: 2 }))?.next.smallKeys,
    ).toBeUndefined();
  });

  it("lays no counter or key count of another run's view", () => {
    const reading = readingOf(seedMemory({ race: false }));
    const view = gameView(reading, fresh(), { 3: 2 });
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

  it("keeps a counter within what the game allows, and the keys above its floor", () => {
    const memory = seedMemory({ race: false });
    checkIn(memory, "desert-palace/map-chest");
    checkIn(memory, "desert-palace/torch");
    const board = {
      ...marked(fresh("keysanity"), {}),
      smallKeys: [0, 0, 0, 5, 0, 0, 0, 0, 0, 0],
    };
    const open = marked(fresh(), { chest1: 1 });

    // Desert Palace's counter may be 0 or 1: the player's 1 stands
    expect(
      syncView(open, gameView(readingOf(memory), open))?.next.items?.chest1,
    ).toBe(1);
    // Memory bounds the keys found from below only
    expect(
      syncView(board, gameView(readingOf(memory), board, { 3: 2 }))?.next
        .smallKeys,
    ).toBeUndefined();
  });

  it("leaves what Race Mode withholds as the player marked it", () => {
    const memory = seedMemory({ race: true });
    orWord(memory, 0x472, EASTERN);
    const board = marked(fresh(), { bottle: 4, chest0: 0, reward0: 3 }, [
      "eastern-palace/big-chest",
      "kings-tomb",
    ]);

    const laid = syncView(
      board,
      gameView(readingOf(memory, { race: true }), board),
    );

    expect(laid?.next.items).toMatchObject({
      bottle: 4,
      chest0: 0,
      hookshot: true,
      reward0: 3,
      sword: 2,
    });
    // Outside dungeons the game tells; inside, the player does
    expect(laid?.next.checked).toEqual({
      "eastern-palace/big-chest": true,
      "links-house": true,
    });
  });
});
