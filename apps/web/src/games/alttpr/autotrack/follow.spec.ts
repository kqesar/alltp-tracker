import { playTimeMs } from "@alltp/pack-alttpr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { settle } from "@/autotrack/fixtures";
import {
  checkIn,
  GAME_MODE,
  readingOf,
  SAVE,
  seedMemory,
  standOn,
  writeMedallions,
} from "@/games/alttpr/autotrack/fixtures";
import { createFollower } from "@/games/alttpr/autotrack/follow";
import { DUNGEON_INDICES, MEDALLION_VALUES } from "@/games/alttpr/constants";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import {
  comeOut,
  goIn,
} from "../../../../../../packs/alttpr/test/entrance-rom";

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

describe("the run timer, on the game's time", () => {
  /** A reading in `mode`, the game's counter at `frames`, `seconds` on. */
  const at = (
    memory: Uint8Array,
    mode: number,
    frames: number,
    seconds = 0,
    race = false,
  ) => {
    memory[GAME_MODE] = mode;
    memory.set(
      [frames & 0xff, (frames >> 8) & 0xff, (frames >> 16) & 0xff, 0],
      SAVE(0x43e),
    );
    const reading = readingOf(memory, { race });
    return { ...reading, at: reading.at + seconds * 1000 };
  };

  beforeEach(() => store().setTimerClock("game"));

  it("shows the game's time at each reading, ticking between them", () => {
    const memory = seedMemory({ race: false });
    const follower = createFollower();

    // The file select clears the counter: no time to set the timer on
    follower.read(at(memory, 0x01, 0));
    expect(store().timer.elapsedMs).toBe(0);
    expect(store().timer.startedAt).toBeNull();

    // The player joined a run at 10 minutes: the timer takes the game's time
    const first = at(memory, 0x07, 36_000, 1);
    follower.read(first);
    expect(store().timer).toEqual({
      elapsedMs: playTimeMs(36_000),
      finished: false,
      startedAt: first.at,
    });

    // Two seconds of game time later, a reading three real seconds on
    // (the game was slower than the clock): the timer is set right
    const second = at(memory, 0x07, 36_000 + 120, 4);
    follower.read(second);
    expect(store().timer).toEqual({
      elapsedMs: playTimeMs(36_120),
      finished: false,
      startedAt: second.at,
    });
  });

  it("writes nothing for a reading that agrees with the timer", () => {
    const memory = seedMemory({ race: false });
    const follower = createFollower();
    follower.read(at(memory, 0x07, 6_000, 0));
    const timer = store().timer;

    follower.read(at(memory, 0x07, 6_000 + 60, 1));
    expect(store().timer).toBe(timer);
  });

  it("stops while the game is before play, and goes on from there", () => {
    const memory = seedMemory({ race: false });
    const follower = createFollower();
    follower.read(at(memory, 0x07, 6_000, 0));

    // The spawn select after a load: the file's time, not counting
    follower.read(at(memory, 0x05, 6_000, 5));
    expect(store().timer).toEqual({
      elapsedMs: playTimeMs(6_000),
      finished: false,
      startedAt: null,
    });
    // A menu in play does count (the item menu is in the game's time)
    follower.read(at(memory, 0x0e, 6_060, 6));
    expect(store().timer.startedAt).not.toBeNull();
    expect(store().timer.elapsedMs).toBe(playTimeMs(6_060));
  });

  it("pauses at the title, whose counter reads 0, and sets nothing from it", () => {
    const memory = seedMemory({ race: false });
    const follower = createFollower();
    follower.read(at(memory, 0x07, 6_000, 0));
    expect(store().timer.startedAt).not.toBeNull();

    const title = at(memory, 0x00, 0, 30);
    follower.read(title);
    expect(store().timer).toEqual({
      elapsedMs: playTimeMs(6_000) + 30_000,
      finished: false,
      startedAt: null,
    });
  });

  it("finishes at the goal on the game's final time, and stays there", () => {
    const memory = seedMemory({ race: false });
    const follower = createFollower();
    follower.read(at(memory, 0x07, 6_000, 0));

    follower.read(at(memory, 0x19, 216_000, 10));
    expect(store().timer).toEqual({
      elapsedMs: playTimeMs(216_000),
      finished: true,
      startedAt: null,
    });
    // The credits, and a counter the game stopped
    follower.read(at(memory, 0x1a, 216_000, 20));
    expect(store().timer.elapsedMs).toBe(playTimeMs(216_000));
    expect(store().timer.finished).toBe(true);
  });

  it("answers to the choice, not to Start and stop with the game", () => {
    store().setAutoTimer(false);
    const memory = seedMemory({ race: false });
    const follower = createFollower();

    follower.read(at(memory, 0x07, 6_000, 0));
    expect(store().timer.startedAt).not.toBeNull();
  });

  it("counts real time in Race Mode, where the counter is never read", () => {
    const memory = seedMemory({ race: true });
    const follower = createFollower();

    follower.read(at(memory, 0x01, 6_000, 0, true));
    const start = at(memory, 0x07, 6_000, 1, true);
    follower.read(start);
    // Started as the real-time timer is, from 0, not from the counter
    expect(store().timer).toEqual({
      elapsedMs: 0,
      finished: false,
      startedAt: start.at,
    });
  });

  it("counts real time while the counter is unsettled", () => {
    const memory = seedMemory({ race: false });
    const follower = createFollower();
    follower.read(at(memory, 0x01, 0, 0));
    memory[GAME_MODE] = 0x07;
    const start = {
      ...readingOf(memory, { unread: ["stats"] }),
      at: Date.UTC(2026, 9, 16, 20, 16),
    };
    follower.read(start);

    expect(store().timer.elapsedMs).toBe(0);
    expect(store().timer.startedAt).toBe(start.at);
  });

  it("keeps a sensible value when the choice changes in the middle of a run", () => {
    const memory = seedMemory({ race: false });
    const follower = createFollower();
    store().setTimerClock("real");
    follower.read(at(memory, 0x01, 0, 0));
    follower.read(at(memory, 0x07, 100, 1));
    // Real time: the game's counter changes nothing
    const real = store().timer;
    expect(real.elapsedMs).toBe(0);
    follower.read(at(memory, 0x07, 6_000, 61));
    expect(store().timer).toBe(real);

    // Game time: the next reading sets the timer on the game's
    store().setTimerClock("game");
    follower.read(at(memory, 0x07, 6_060, 62));
    expect(store().timer.elapsedMs).toBe(playTimeMs(6_060));
    expect(store().timer.startedAt).not.toBeNull();

    // Back to real time: the timer goes on from what it shows
    store().setTimerClock("real");
    const shown = store().timer;
    follower.read(at(memory, 0x07, 6_300, 66));
    expect(store().timer).toBe(shown);
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

  describe("the pads' medallions", () => {
    const MIRE = DUNGEON_INDICES.MISERY_MIRE;
    const ROCK = DUNGEON_INDICES.TURTLE_ROCK;
    /** The Mire asks Ether, Turtle Rock Quake; Link on `screen`. */
    const standing = (screen: number, mode = 0x09) =>
      readingOf(
        standOn(
          writeMedallions(seedMemory({ race: false }), 1, 2),
          screen,
          mode,
        ),
      );

    it("fills a pad once Link reaches its screen, and keeps it away from it", () => {
      const follower = createFollower();

      follower.read(standing(0x30));
      expect(store().medallions[MIRE]).toBe(MEDALLION_VALUES.UNKNOWN);

      follower.read(standing(0x70));
      expect(store().medallions[MIRE]).toBe(MEDALLION_VALUES.ETHER);
      expect(store().medallions[ROCK]).toBe(MEDALLION_VALUES.UNKNOWN);

      // Into a cave, then across the map: the pad stays known
      follower.read(standing(0x70, 0x07));
      follower.read(standing(0x30));
      expect(store().medallions[MIRE]).toBe(MEDALLION_VALUES.ETHER);
    });

    it("leaves the change the player makes after the game showed it", () => {
      const follower = createFollower();
      follower.read(standing(0x70));

      store().handleMedallionChange(MIRE, MEDALLION_VALUES.BOMBOS);
      follower.read(standing(0x30));
      follower.read(standing(0x70));
      expect(store().medallions[MIRE]).toBe(MEDALLION_VALUES.BOMBOS);
    });

    it("leaves a medallion the player named before the game showed it", () => {
      const follower = createFollower();
      store().handleMedallionChange(ROCK, MEDALLION_VALUES.BOMBOS);

      follower.read(standing(0x47));
      expect(store().medallions[ROCK]).toBe(MEDALLION_VALUES.BOMBOS);
      // Sync from game sets it to what the game shows
      follower.sync();
      expect(store().medallions[ROCK]).toBe(MEDALLION_VALUES.QUAKE);
    });

    it("fills nothing in Race Mode", () => {
      const follower = createFollower();
      const memory = standOn(
        writeMedallions(seedMemory({ race: true }), 1, 2),
        0x70,
      );
      follower.read(readingOf(memory, { race: true }));
      expect(store().medallions).toEqual(Array(10).fill(0));
    });
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

describe("the doors Link goes through", () => {
  /** A Crosskeys board following the game, with a seed in play. */
  const crosskeys = () => {
    store().applyPreset("crosskeys");
    return { follower: createFollower(), memory: seedMemory({ race: false }) };
  };
  const notes = () => store().entrances;

  it("notes a door Link went in by, as the game's news", async () => {
    const { follower, memory } = crosskeys();
    const steps = store().past.length;
    follower.read(
      readingOf(goIn(memory, "Light Hype Fairy", "Blinds Hideout")),
    );
    await vi.waitFor(() =>
      expect(notes()).toEqual({ "light-hype-fairy": "blinds-hideout" }),
    );
    // News, not a step of the player's
    expect(store().past).toHaveLength(steps);
  });

  it("notes a hole Link fell in by, with its cave's door", async () => {
    const { follower, memory } = crosskeys();
    follower.read(
      readingOf(goIn(memory, "Kakariko Well Drop", "Bat Cave (right)")),
    );
    await vi.waitFor(() =>
      expect(notes()).toEqual({
        "kakariko-well-cave": "bat-cave-exit",
        "kakariko-well-drop": "bat-cave-right",
      }),
    );
  });

  it("notes the door Link came out by", async () => {
    const { follower, memory } = crosskeys();
    goIn(memory, "Light Hype Fairy", "Blinds Hideout");
    follower.read(
      readingOf(comeOut(memory, "Kakariko Shop", "Elder House Exit (East)")),
    );
    await vi.waitFor(() =>
      expect(notes()).toEqual({
        "kakariko-shop": "elder-house-exit-east",
        "light-hype-fairy": "blinds-hideout",
      }),
    );
  });

  it("takes, of rooms alike, the one noted there or else one noted nowhere", async () => {
    const { follower, memory } = crosskeys();
    store().noteEntrance("bonk-fairy-light", "lake-hylia-healer-fairy");
    follower.read(
      readingOf(goIn(memory, "Light Hype Fairy", "Lake Hylia Healer Fairy")),
    );
    await vi.waitFor(() =>
      expect(notes()["light-hype-fairy"]).toBe("swamp-healer-fairy"),
    );
    expect(notes()["bonk-fairy-light"]).toBe("lake-hylia-healer-fairy");
  });

  it("wins over a note the game contradicts", async () => {
    const { follower, memory } = crosskeys();
    store().noteEntrances({
      "kakariko-shop": "blinds-hideout",
      "light-hype-fairy": "chicken-house",
    });
    follower.read(
      readingOf(goIn(memory, "Light Hype Fairy", "Blinds Hideout")),
    );
    await vi.waitFor(() =>
      expect(notes()).toEqual({ "light-hype-fairy": "blinds-hideout" }),
    );
  });

  it("notes again only what the game shows anew", async () => {
    const { follower, memory } = crosskeys();
    goIn(memory, "Light Hype Fairy", "Blinds Hideout");
    follower.read(readingOf(memory));
    await vi.waitFor(() => expect(notes()).not.toEqual({}));
    // The player forgets it: the same door read again leaves it forgotten
    store().noteEntrance("light-hype-fairy", null);
    follower.read(readingOf(memory));
    await settle();
    expect(notes()).toEqual({});
    follower.read(readingOf(goIn(memory, "Kakariko Shop", "Chicken House")));
    await vi.waitFor(() =>
      expect(notes()).toEqual({ "kakariko-shop": "chicken-house" }),
    );
  });

  it("notes nothing in Race Mode, or in a run whose entrances stay put", async () => {
    const raced = crosskeys();
    goIn(raced.memory, "Light Hype Fairy", "Blinds Hideout");
    raced.follower.read(readingOf(raced.memory, { race: true }));
    store().applyPreset("open");
    const open = createFollower();
    open.read(readingOf(raced.memory));
    await settle();
    expect(notes()).toEqual({});
    for (const progress of store().past) expect(progress.entrances).toEqual({});
  });
});
