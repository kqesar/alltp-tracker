import { beforeEach, describe, expect, it } from "vitest";
import {
  checkIn,
  GAME_MODE,
  readingOf,
  SAVE,
  seedMemory,
} from "@/autotrack/fixtures";
import { createFollower } from "@/autotrack/follow";
import { useGameStore } from "@/stores/gameStore";

const store = () => useGameStore.getState();

/** Palace of Darkness's byte of small keys in hand. */
const POD_KEYS = SAVE(0x37c + 6);

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
});

describe("the run timer, with the game", () => {
  /** A reading of the game in `mode`, `seconds` after the first. */
  const at = (memory: Uint8Array, mode: number, seconds = 0) => {
    memory[GAME_MODE] = mode;
    const reading = readingOf(memory);
    return { ...reading, at: reading.at + seconds * 1000 };
  };

  it("starts when play follows the file select, and stops at the goal", () => {
    const memory = seedMemory({ race: false });
    const follower = createFollower();

    follower.read(at(memory, 0x01));
    expect(store().timer.startedAt).toBeNull();
    const start = at(memory, 0x07, 1);
    follower.read(start);
    expect(store().timer.startedAt).toBe(start.at);

    // A menu, then play again: the timer runs on
    follower.read(at(memory, 0x0e, 30));
    follower.read(at(memory, 0x09, 31));
    expect(store().timer.startedAt).toBe(start.at);

    follower.read(at(memory, 0x19, 61));
    expect(store().timer).toEqual({
      elapsedMs: 60_000,
      finished: true,
      startedAt: null,
    });
    // The credits after: nothing more
    follower.read(at(memory, 0x1a, 70));
    expect(store().timer.elapsedMs).toBe(60_000);
  });

  it("starts nothing when it finds the game in play or in a menu", () => {
    const memory = seedMemory({ race: false });
    const follower = createFollower();

    follower.read(at(memory, 0x09));
    follower.read(at(memory, 0x0e, 1));
    follower.read(at(memory, 0x07, 2));

    expect(store().timer.startedAt).toBeNull();
    expect(store().timer.elapsedMs).toBe(0);
  });

  it("leaves the timer to the player who turned that off", () => {
    store().setAutoTimer(false);
    const memory = seedMemory({ race: false });
    const follower = createFollower();

    follower.read(at(memory, 0x01));
    follower.read(at(memory, 0x07, 1));
    expect(store().timer.startedAt).toBeNull();

    store().startTimer();
    follower.read(at(memory, 0x19, 2));
    expect(store().timer.finished).toBe(false);
  });

  it("goes on through the switch to the seed's run type", () => {
    const memory = seedMemory({ race: false });
    const follower = createFollower();
    follower.read(at(memory, 0x01));
    follower.read(at(memory, 0x07, 1));
    const running = store().timer;

    follower.switchRun("keysanity", store().settings);

    expect(store().presetId).toBe("keysanity");
    expect(store().timer).toBe(running);
  });
});

describe("following the game", () => {
  it("lays the first reading in play on the board, outside the history", () => {
    const follower = createFollower();

    follower.read(readingOf(seedMemory({ race: false })));

    expect(store().items).toMatchObject({
      boss0: 2,
      chest0: 1,
      hookshot: true,
      sword: 2,
    });
    expect(store().checked).toMatchObject({ "links-house": true });
    expect(store().past).toEqual([]);
  });

  it("tells a board holding the game alone from one the player marked", () => {
    const follower = createFollower();
    expect(follower.holdsGameOnly()).toBe(true);

    follower.read(readingOf(seedMemory({ race: false })));
    expect(store().items.hookshot).toBe(true);
    expect(follower.holdsGameOnly()).toBe(true);

    store().handleItemClick("flute");
    expect(follower.holdsGameOnly()).toBe(false);
    store().undo();
    store().toggleChecks(["library"]);
    expect(follower.holdsGameOnly()).toBe(false);
  });

  it("lays nothing while no game is in play", () => {
    const memory = seedMemory({ race: false });
    memory[0xf5_0010] = 0x00; // the title screen
    const follower = createFollower();

    follower.read(readingOf(memory));
    follower.read(
      readingOf(seedMemory({ race: false }), { unread: ["game-mode"] }),
    );

    expect(store().items.hookshot).toBe(false);
    expect(follower.sync()).toBeNull();
  });

  it("lays only what the game changed: a mark the player changed stays", () => {
    const memory = seedMemory({ race: false });
    const follower = createFollower();
    follower.read(readingOf(memory));

    // The player takes the hookshot off and checks King's Tomb by hand
    store().handleItemClick("hookshot");
    store().toggleChecks(["kings-tomb"]);
    memory[SAVE(0x357)] = 0x01; // the game: the Moon Pearl
    follower.read(readingOf(memory));

    expect(store().items).toMatchObject({ hookshot: false, moonpearl: true });
    expect(store().checked).toMatchObject({ "kings-tomb": true });
    // Until the game changes it again: the hookshot, lost and found
    memory[SAVE(0x342)] = 0x00;
    follower.read(readingOf(memory));
    memory[SAVE(0x342)] = 0x01;
    follower.read(readingOf(memory));
    expect(store().items.hookshot).toBe(true);
  });

  it("never undoes the game's news when the player undoes their own change", () => {
    const memory = seedMemory({ race: false });
    const follower = createFollower();
    follower.read(readingOf(memory));
    store().handleItemClick("hammer");
    memory[SAVE(0x357)] = 0x01; // Moon Pearl
    follower.read(readingOf(memory));

    store().undo();

    expect(store().items).toMatchObject({ hammer: false, moonpearl: true });
    store().redo();
    expect(store().items).toMatchObject({ hammer: true, moonpearl: true });
    expect(store().past).toHaveLength(1);
  });

  it("syncs the board to the game in one undo step", () => {
    const memory = seedMemory({ race: false });
    const follower = createFollower();
    follower.read(readingOf(memory));
    store().handleItemClick("sword"); // Tempered Sword, by hand
    store().toggleChecks(["kings-tomb"]);
    const before = store().past.length;

    expect(follower.sync()).toBe(2);

    expect(store().items.sword).toBe(2);
    expect(store().checked["kings-tomb"]).toBeUndefined();
    expect(store().past).toHaveLength(before + 1);
    store().undo();
    expect(store().items.sword).toBe(3);
    expect(store().checked["kings-tomb"]).toBe(true);
    // In step with the game: nothing to change
    store().redo();
    expect(follower.sync()).toBe(0);
    expect(store().past).toHaveLength(before + 1);
  });

  it("counts every small key picked up, though doors spend them", () => {
    store().applyPreset("keysanity");
    const memory = seedMemory({ race: false });
    const follower = createFollower();
    follower.read(readingOf(memory));

    memory[POD_KEYS] = 1; // a key
    follower.read(readingOf(memory));
    memory[POD_KEYS] = 0; // a door
    follower.read(readingOf(memory));
    memory[POD_KEYS] = 1; // another key
    checkIn(memory, "kings-tomb"); // any other news
    follower.read(readingOf(memory));

    expect(store().smallKeys[3]).toBe(2);
  });

  it("starts each stretch of play from the board's key count", () => {
    store().applyPreset("keysanity");
    const memory = seedMemory({ race: false });
    memory[POD_KEYS] = 1;
    const follower = createFollower();
    follower.read(readingOf(memory));
    expect(store().smallKeys[3]).toBe(1);

    // Out of play, the player counts a key spent before they connected
    memory[0xf5_0010] = 0x0e;
    follower.read(readingOf(memory));
    store().handleSmallKeyClick(3);
    memory[0xf5_0010] = 0x09;
    follower.read(readingOf(memory));
    memory[POD_KEYS] = 2;
    follower.read(readingOf(memory));

    expect(store().smallKeys[3]).toBe(3);
  });

  it("switches the run type with the game laid on it, as one undo step", () => {
    const follower = createFollower();
    follower.read(readingOf(seedMemory({ race: false })));
    store().handleItemClick("flute");

    follower.switchRun("keysanity", {
      ...store().settings,
      dungeonItems: "full",
    });

    expect(store().presetId).toBe("keysanity");
    // The game's marks on the fresh run, the player's own gone
    expect(store().items).toMatchObject({
      flute: false,
      hookshot: true,
      sword: 2,
    });
    expect(store().checked).toMatchObject({ "links-house": true });
    store().undo();
    expect(store().presetId).toBe("open");
    expect(store().items).toMatchObject({ flute: true, hookshot: true });
  });

  it("switches to a bare run before any game in play was read", () => {
    createFollower().switchRun("keysanity", {
      ...store().settings,
      dungeonItems: "full",
    });

    expect(store().presetId).toBe("keysanity");
    expect(store().items.hookshot).toBe(false);
  });
});
