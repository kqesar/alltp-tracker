import { rtaMs } from "@alltp/pack-sm";
import { beforeEach, describe, expect, it } from "vitest";
import { createSmFollower } from "@/games/sm/autotrack/follow";
import { readSm } from "@/games/sm/autotrack/reading";
import { useSmStore } from "@/games/sm/store";
import { timerMs } from "@/utils/runTimer";
import {
  MEMORY_RANGE,
  type MemoryRangeId,
} from "../../../../../../packs/sm/src/autotrack/memory";
import {
  type MapRandoGame,
  viewOf,
  writeMapRando,
} from "../../../../../../packs/sm/test/sm-rom";

const run = () => useSmStore.getState();

/** What the tracker reads of a Map Rando game. */
const reading = (game: MapRandoGame = {}) =>
  readSm(viewOf(writeMapRando(new Uint8Array(0x100_0000), game)), 0);

const MORPH = 0x0004;

/** What a race leaves unread (the pack's race profile). */
const RACE_UNREAD = [
  "objective-count",
  "objective-flags",
  "seed",
  "events",
  "collected",
  "nothing-mask",
  "rta-saved",
  "rta-pending",
] satisfies MemoryRangeId[];
const BOMBS = 0x1000;
const WAVE = 0x0001;

beforeEach(() => {
  localStorage.clear();
  useSmStore.setState(useSmStore.getInitialState(), true);
});

describe("the Super Metroid run following the game", () => {
  it("lays the game's items, objectives and settings, as no undo step", () => {
    run().step("varia", 1);
    const follower = createSmFollower();

    follower.read(
      reading({
        beams: WAVE,
        done: ["kraid"],
        items: MORPH | BOMBS,
        maxEnergy: 299,
        maxMissiles: 15,
        objectives: ["kraid", "botwoon"],
      }),
    );

    expect(run().items).toMatchObject({
      bombs: 1,
      energyTank: 2,
      missile: 3,
      morph: 1,
      varia: 1,
      wave: 1,
    });
    expect(run().objectives).toEqual(["kraid", "botwoon"]);
    expect(run().done).toEqual(["kraid"]);
    // Undoing the player's change leaves the game's
    run().undo();
    expect(run().items).toMatchObject({ morph: 1, varia: 0 });
    expect(run().future).toHaveLength(1);
  });

  it("lays in Race Mode the boss kills among the player's objectives, and no setting", () => {
    // Map Rando's one rule on autotracking permits "items and boss kills": a
    // race reads neither the seed's objectives and settings nor the events
    const raced = (at: number) =>
      readSm(
        viewOf(
          writeMapRando(new Uint8Array(0x100_0000), {
            done: ["kraid", "crocomire", "ridley", "plasmaRoom"],
            items: MORPH,
            objectives: ["kraid", "botwoon"],
            wallJump: true,
          }),
          RACE_UNREAD,
        ),
        at,
        true,
      );
    run().setObjectives(["kraid", "crocomire", "plasmaRoom"]);
    const follower = createSmFollower();
    follower.read(raced(0));
    expect(run()).toMatchObject({
      // Ridley fell but is no objective of the player's; a room cleared is
      // no boss kill
      done: ["kraid", "crocomire"],
      // The player's objectives stay; the seed's were never read
      objectives: ["kraid", "crocomire", "plasmaRoom"],
      wallJump: false,
    });
    expect(run().items.morph).toBe(1);
    // The player marks the rest, and the game never takes a mark back
    run().toggleDone("plasmaRoom");
    follower.read(raced(1));
    expect(run().done).toEqual(["kraid", "crocomire", "plasmaRoom"]);
  });

  it("follows the seed's Wall Jump Boots and split Speed Booster", () => {
    const follower = createSmFollower();
    follower.read(reading({ wallJump: true }));
    expect(run()).toMatchObject({ splitSpeed: false, wallJump: true });

    follower.read(reading({ splitSpeed: true, wallJump: true }));
    expect(run()).toMatchObject({ splitSpeed: true, wallJump: true });

    // The player's own setting stands while the seed's does not change
    run().setOption("wallJump", false);
    follower.read(reading({ splitSpeed: true, wallJump: true }));
    expect(run().wallJump).toBe(false);
  });

  it("lays nothing while no game is in play", () => {
    const follower = createSmFollower();

    // The title screen ($0998 = $01) still holds the last file's items
    follower.read(reading({ items: MORPH, state: 0x01 }));

    expect(run()).toMatchObject({ items: useSmStore.getInitialState().items });
  });

  it("lays news only: a mark the player changed stays until the game moves", () => {
    const follower = createSmFollower();
    follower.read(reading({ items: MORPH, maxMissiles: 10 }));
    expect(run().items).toMatchObject({ missile: 2, morph: 1 });

    // The player takes the Morph Ball back and marks a third missile pack
    run().step("morph", -1);
    run().step("missile", 1);
    follower.read(reading({ items: MORPH, maxMissiles: 10 }));
    expect(run().items).toMatchObject({ missile: 3, morph: 0 });

    // The game finds another pack: the player's count stands, higher
    follower.read(reading({ items: MORPH, maxMissiles: 15 }));
    expect(run().items).toMatchObject({ missile: 3, morph: 0 });
    follower.read(reading({ items: MORPH, maxMissiles: 20 }));
    expect(run().items.missile).toBe(4);
  });

  it("keeps an objective the player marked done, and drops one the seed lacks", () => {
    run().setObjectives(["kraid", "ridley", "phantoon"]);
    run().toggleDone("ridley");
    run().toggleDone("phantoon");
    const follower = createSmFollower();

    follower.read(
      reading({ done: ["kraid"], objectives: ["kraid", "ridley", "draygon"] }),
    );

    expect(run().objectives).toEqual(["kraid", "ridley", "draygon"]);
    expect([...run().done].sort()).toEqual(["kraid", "ridley"]);
  });

  it("writes nothing for a reading with no news", () => {
    const follower = createSmFollower();
    follower.read(reading({ items: MORPH }));
    const before = run();

    follower.read(reading({ items: MORPH }));

    expect(run()).toBe(before);
  });
});

/** A reading at an instant; `race` leaves out the RTA clock, as Race Mode does. */
const readingAt = (at: number, game: MapRandoGame = {}, race = false) =>
  readSm(
    viewOf(
      writeMapRando(new Uint8Array(0x100_0000), game),
      race ? (["rta-pending", "rta-saved"] satisfies MemoryRangeId[]) : [],
    ),
    at,
    race,
  );

const T0 = 1_000_000;
/** The game states: the file select, play, the pause menu, a door, the credits. */
const FILE_SELECT = 0x04;
const PLAY = 0x08;
const PAUSED = 0x0c;
const DOOR = 0x0a;
const CREDITS = 0x27;

describe("the run timer, with the game", () => {
  it("starts on the first reading in play after one before play", () => {
    const follower = createSmFollower();
    follower.read(readingAt(T0, { state: FILE_SELECT }));
    expect(run().timer.startedAt).toBeNull();

    follower.read(readingAt(T0 + 1_000, { state: PLAY }));
    expect(run().timer).toEqual({
      elapsedMs: 0,
      finished: false,
      startedAt: T0 + 1_000,
    });

    // A pause, a door, then play again: the timer runs on, from its start
    follower.read(readingAt(T0 + 5_000, { state: PAUSED }));
    follower.read(readingAt(T0 + 6_000, { state: PLAY }));
    follower.read(readingAt(T0 + 7_000, { state: DOOR }));
    follower.read(readingAt(T0 + 8_000, { state: PLAY }));
    expect(run().timer.startedAt).toBe(T0 + 1_000);
  });

  it("starts nothing for a tracker that connects to a game already in play", () => {
    createSmFollower().read(readingAt(T0, { state: PLAY }));
    expect(run().timer.startedAt).toBeNull();
  });

  it("starts nothing when play follows a pause: that is no new game", () => {
    const follower = createSmFollower();
    follower.read(readingAt(T0, { state: PLAY }));
    follower.read(readingAt(T0 + 1_000, { state: PAUSED }));
    follower.read(readingAt(T0 + 2_000, { state: PLAY }));
    expect(run().timer.startedAt).toBeNull();
  });

  it("stops at the goal: the escape set and Samus in the ship", () => {
    const follower = createSmFollower();
    follower.read(readingAt(T0, { state: FILE_SELECT }));
    follower.read(readingAt(T0 + 1_000, { state: PLAY }));
    // The escape runs in play: not the goal yet
    follower.read(readingAt(T0 + 60_000, { escaping: true, state: PLAY }));
    expect(run().timer.finished).toBe(false);
    // The ending's state without the escape is not the goal either
    follower.read(readingAt(T0 + 61_000, { state: CREDITS }));
    expect(run().timer.finished).toBe(false);

    follower.read(readingAt(T0 + 90_000, { escaping: true, state: CREDITS }));
    expect(run().timer).toEqual({
      elapsedMs: 89_000,
      finished: true,
      startedAt: null,
    });

    // The credits go on: the timer stays where the goal stopped it
    follower.read(readingAt(T0 + 120_000, { escaping: true, state: CREDITS }));
    expect(run().timer.elapsedMs).toBe(89_000);
  });

  it("leaves the timer to the player who turned that off", () => {
    run().setAutoTimer(false);
    const follower = createSmFollower();
    follower.read(readingAt(T0, { state: FILE_SELECT }));
    follower.read(readingAt(T0 + 1_000, { state: PLAY }));
    expect(run().timer.startedAt).toBeNull();

    run().startTimer(T0 + 2_000);
    follower.read(readingAt(T0 + 9_000, { escaping: true, state: CREDITS }));
    expect(run().timer.finished).toBe(false);
    expect(run().timer.startedAt).toBe(T0 + 2_000);
  });

  it("leaves the timer to the player in Race Mode: no Map Rando rule speaks of it", () => {
    const follower = createSmFollower();
    follower.read(readingAt(T0, { state: FILE_SELECT }, true));
    follower.read(readingAt(T0 + 1_000, { state: PLAY }, true));
    expect(run().timer).toEqual({
      elapsedMs: 0,
      finished: false,
      startedAt: null,
    });
    // Started by the player, it is not stopped by the game either
    run().startTimer(T0 + 2_000);
    follower.read(
      readingAt(T0 + 9_000, { escaping: true, state: CREDITS }, true),
    );
    expect(run().timer).toEqual({
      elapsedMs: 0,
      finished: false,
      startedAt: T0 + 2_000,
    });
    expect(run().clockBase).toBeNull();
  });
});

describe("the run timer, on the game's time", () => {
  /** The game's frames now, as a reading of the RTA clock. */
  const at = (
    when: number,
    frames: number,
    game: MapRandoGame = {},
    race = false,
  ) =>
    readingAt(
      T0 + when,
      {
        clock: { pending: frames % 255, saved: frames - (frames % 255) },
        state: PLAY,
        ...game,
      },
      race,
    );
  const start = (follower = createSmFollower()) => {
    follower.read(readingAt(T0, { state: FILE_SELECT }));
    // The clock counts since the SRAM was set up: 100 000 frames already
    follower.read(at(1_000, 100_000));
    return follower;
  };

  beforeEach(() => run().setTimerClock("game"));

  it("counts the game's time since the run's start, not the clock's", () => {
    const follower = start();
    expect(run().clockBase).toBe(100_000);
    expect(run().timer).toEqual({
      elapsedMs: 0,
      finished: false,
      startedAt: T0 + 1_000,
    });

    // A minute of real time, 4 000 frames of the game (66.5 s: the emulator
    // ran fast): the timer is set on the game's
    follower.read(at(61_000, 104_000));
    expect(run().timer).toEqual({
      elapsedMs: rtaMs(4_000),
      finished: false,
      startedAt: T0 + 61_000,
    });
  });

  it("writes nothing for a reading that agrees with the timer", () => {
    const follower = start();
    follower.read(at(11_000, 100_601));
    const timer = run().timer;
    follower.read(at(12_000, 100_661));
    expect(run().timer).toBe(timer);
  });

  it("stops while the counter stands still: a paused emulator", () => {
    const follower = start();
    follower.read(at(11_000, 100_601));
    follower.read(at(12_000, 100_601));
    expect(run().timer).toEqual({
      elapsedMs: rtaMs(601),
      finished: false,
      startedAt: null,
    });
    // It runs again as the counter moves
    follower.read(at(20_000, 100_900));
    expect(run().timer).toMatchObject({
      elapsedMs: rtaMs(900),
      startedAt: T0 + 20_000,
    });
  });

  it("stops at the game's last time when a poll finds memory unchanged, and goes on when it moves", () => {
    const follower = start();
    follower.read(at(11_000, 100_601));
    expect(run().timer.startedAt).not.toBeNull();

    // The emulator is paused: no reading comes, a steady poll does
    follower.steady(T0 + 12_000);
    expect(run().timer).toEqual({
      elapsedMs: rtaMs(601),
      finished: false,
      startedAt: null,
    });
    const held = run().timer;
    follower.steady(T0 + 13_000);
    expect(run().timer).toBe(held);

    // It runs again: the next reading resumes the timer
    follower.read(at(30_000, 101_201));
    expect(run().timer).toEqual({
      elapsedMs: rtaMs(1_201),
      finished: false,
      startedAt: T0 + 30_000,
    });
  });

  it("leaves a timer alone that real time counts", () => {
    run().setTimerClock("real");
    const follower = start();
    const running = run().timer;
    follower.steady(T0 + 12_000);
    expect(run().timer).toBe(running);
  });

  it("holds a reading a flush split, and takes the next", () => {
    const follower = start();
    // 250 frames held in the NMI counter, 100 255 flushed ahead of them
    follower.read(at(11_000, 0, { clock: { pending: 250, saved: 100_255 } }));
    const before = run().timer;
    // The SRAM word read before a flush, the counter after it: 250 frames short
    follower.read(at(12_000, 0, { clock: { pending: 3, saved: 100_255 } }));
    expect(run().timer).toBe(before);
    // The flush done: the word moved on and the counter is small
    follower.read(at(13_000, 0, { clock: { pending: 33, saved: 100_510 } }));
    expect(run().timer.elapsedMs).toBe(rtaMs(100_543 - 100_000));
    expect(run().timer.startedAt).not.toBeNull();
  });

  it("stops at the goal on the game's time, and the credits do not move it", () => {
    const follower = start();
    follower.read(at(61_000, 103_606, { escaping: true, state: CREDITS }));
    expect(run().timer).toEqual({
      elapsedMs: rtaMs(3_606),
      finished: true,
      startedAt: null,
    });
    follower.read(at(90_000, 105_000, { escaping: true, state: CREDITS }));
    expect(run().timer.elapsedMs).toBe(rtaMs(3_606));
  });

  it("does not stop at the goal when the player turned that off", () => {
    run().setAutoTimer(false);
    const follower = createSmFollower();
    run().startTimer(T0);
    follower.read(at(61_000, 103_606, { escaping: true, state: CREDITS }));
    expect(run().timer.finished).toBe(false);
  });

  it("goes on from the timer's own time when the clock was not known at its start", () => {
    // A timer the player started and ran 30 s in real time, then chose Game time
    run().setTimerClock("real");
    run().startTimer(T0);
    run().setTimerClock("game");
    const follower = createSmFollower();
    follower.read(at(30_000, 777_000));
    const shown = (when: number) => timerMs(run().timer, T0 + when);
    expect(shown(30_000)).toBeGreaterThanOrEqual(29_990);
    expect(shown(30_000)).toBeLessThanOrEqual(30_010);
    const base = run().clockBase ?? 0;
    expect(777_000 - base).toBe(Math.round((30_000 * 60.098_811_86) / 1000));

    // Two seconds of real time, a game second more: set on the game's
    follower.read(at(32_000, 777_000 + 1_863 + 60));
    expect(shown(32_000)).toBe(rtaMs(777_000 + 1_863 + 60 - base));
  });

  it("takes a new base when the clock falls behind it: the SRAM was set up again", () => {
    const follower = start();
    follower.read(at(11_000, 100_601));
    follower.read(at(12_000, 5_000));
    // Carried on from the 10 s the timer held, not set to 0 or negative
    expect(run().clockBase).toBeLessThan(5_000);
    expect(timerMs(run().timer, T0 + 12_000)).toBeGreaterThan(10_000);
  });

  it("leaves a timer alone that has not begun, and the clock unread in a race", () => {
    const follower = createSmFollower();
    follower.read(at(0, 100_000));
    expect(run().timer).toEqual({
      elapsedMs: 0,
      finished: false,
      startedAt: null,
    });

    // Race Mode: the clock is never read, the timer counts real time
    run().startTimer(T0);
    follower.read(at(10_000, 100_600, {}, true));
    expect(run().timer).toEqual({
      elapsedMs: 0,
      finished: false,
      startedAt: T0,
    });
  });

  it("keeps the real-time timer while real time is chosen, noting the base", () => {
    run().setTimerClock("real");
    const follower = start();
    expect(run().clockBase).toBe(100_000);
    follower.read(at(11_000, 100_000 + 4_000));
    // 4 000 frames are 66 s of the game; the timer is the player's clock
    expect(run().timer).toEqual({
      elapsedMs: 0,
      finished: false,
      startedAt: T0 + 1_000,
    });
  });

  it("forgets the base with the timer: a new game", () => {
    start();
    expect(run().clockBase).toBe(100_000);
    run().reset();
    expect(run().clockBase).toBeNull();
    expect(run().timer.startedAt).toBeNull();
  });
});

describe("the run's seed", () => {
  it("records the seed's name the ROM holds, as no undo step", () => {
    run().step("varia", 1);
    createSmFollower().read(reading({ items: MORPH, name: "dsjF6gGsH" }));

    expect(run().seed).toBe("dsjF6gGsH");
    run().undo();
    expect(run().items.varia).toBe(0);
    expect(run().seed).toBe("dsjF6gGsH");
  });

  it("lays nothing while no game is in play", () => {
    createSmFollower().read(reading({ name: "dsjF6gGsH", state: 0x02 }));

    expect(run().seed).toBeNull();
  });

  it("follows another seed after New game, and gives the earlier run back as it was", () => {
    const follower = createSmFollower();
    follower.read(reading({ name: "dsjF6gGsH" }));
    run().step("morph", 1);

    run().reset();
    expect(run().seed).toBeNull();
    follower.read(reading({ name: "cHXhTSCB8" }));
    expect(run().seed).toBe("cHXhTSCB8");

    run().undo();
    expect(run().items.morph).toBe(1);
    expect(run().seed).toBe("dsjF6gGsH");
  });
});

/** Bits of the table: Brinstar Reserve Tank Room's middle item, 230 Missile Room's, the Moat's. */
const RESERVE_ROOM = 19;
const MISSILE_ROOM = 12;
const MOAT = 4;

/** A reading whose ranges are served or, in a race, never read. */
const locationsAt = (
  at: number,
  game: MapRandoGame = {},
  unread: MemoryRangeId[] = [],
) =>
  readSm(viewOf(writeMapRando(new Uint8Array(0x100_0000), game), unread), at);

describe("the locations found, with the game", () => {
  it("dates each new location with the timer's reading, as no undo step", () => {
    const follower = createSmFollower();
    follower.read(locationsAt(T0, { state: FILE_SELECT }));
    follower.read(locationsAt(T0 + 1_000, { state: PLAY }));
    expect(run().found).toEqual({});

    run().step("varia", 1);
    follower.read(
      locationsAt(T0 + 61_000, { collected: [RESERVE_ROOM], state: PLAY }),
    );
    expect(run().found).toEqual({ "46:3": { at: T0 + 61_000, ms: 60_000 } });

    follower.read(
      locationsAt(T0 + 91_000, {
        collected: [RESERVE_ROOM, MISSILE_ROOM],
        state: PLAY,
      }),
    );
    expect(run().found).toEqual({
      "17:2": { at: T0 + 91_000, ms: 90_000 },
      "46:3": { at: T0 + 61_000, ms: 60_000 },
    });
    // Undoing the player's change leaves what the game found
    run().undo();
    expect(run().items.varia).toBe(0);
    expect(Object.keys(run().found).sort()).toEqual(["17:2", "46:3"]);
  });

  it("dates a location found before the timer started with none", () => {
    createSmFollower().read(
      locationsAt(T0, { collected: [MISSILE_ROOM], state: PLAY }),
    );
    expect(run().found).toEqual({ "17:2": { at: T0, ms: null } });
  });

  it("never takes a location back, nor changes the time of one found", () => {
    const follower = createSmFollower();
    follower.read(locationsAt(T0, { collected: [MISSILE_ROOM], state: PLAY }));
    // A death reloads the save: the bit is gone, then back later
    follower.read(locationsAt(T0 + 1_000, { state: PLAY }));
    expect(Object.keys(run().found)).toEqual(["17:2"]);
    follower.read(
      locationsAt(T0 + 9_000, { collected: [MISSILE_ROOM], state: PLAY }),
    );
    expect(run().found["17:2"]).toEqual({ at: T0, ms: null });
  });

  it("lays nothing while no game is in play", () => {
    createSmFollower().read(
      locationsAt(T0, { collected: [MISSILE_ROOM], state: 0x01 }),
    );
    expect(run().found).toEqual({});
  });

  it("never names a Nothing location, whose bit is set from a new game on", () => {
    const follower = createSmFollower();
    follower.read(locationsAt(T0, { nothing: [MOAT], state: PLAY }));
    expect(run().found).toEqual({});
    follower.read(
      locationsAt(T0 + 1_000, {
        collected: [RESERVE_ROOM],
        nothing: [MOAT],
        state: PLAY,
      }),
    );
    expect(Object.keys(run().found)).toEqual(["46:3"]);
  });

  it("lays nothing from a reading whose mask the bits do not cover, then goes on", () => {
    const GREEN_HILL = 25;
    const follower = createSmFollower();
    follower.read(
      locationsAt(T0, {
        collected: [MISSILE_ROOM],
        nothing: [MOAT],
        state: PLAY,
      }),
    );
    expect(Object.keys(run().found)).toEqual(["17:2"]);

    // Another seed's mask met these bits (a ROM swapped between the reads):
    // the Moat's bit is in the mask, not in the bits
    const memory = writeMapRando(new Uint8Array(0x100_0000), {
      collected: [MISSILE_ROOM, GREEN_HILL],
      state: PLAY,
    });
    memory[MEMORY_RANGE["nothing-mask"].address] |= 1 << (MOAT & 7);
    follower.read(readSm(viewOf(memory), T0 + 1_000));
    expect(Object.keys(run().found)).toEqual(["17:2"]);

    // The next tick reads one seed's bits and mask: the find is laid
    follower.read(
      locationsAt(T0 + 2_000, {
        collected: [MISSILE_ROOM, GREEN_HILL],
        nothing: [MOAT],
        state: PLAY,
      }),
    );
    expect(Object.keys(run().found).sort()).toEqual(["17:2", "54:4"]);
  });

  it("lays nothing in a race, which never reads the bits", () => {
    createSmFollower().read(
      locationsAt(T0, { collected: [MISSILE_ROOM], state: PLAY }, [
        "collected",
        "nothing-mask",
      ]),
    );
    expect(run().found).toEqual({});
  });

  it("writes nothing for a reading with no new location", () => {
    const follower = createSmFollower();
    follower.read(locationsAt(T0, { collected: [MISSILE_ROOM], state: PLAY }));
    const before = run();
    follower.read(
      locationsAt(T0 + 1_000, { collected: [MISSILE_ROOM], state: PLAY }),
    );
    expect(run()).toBe(before);
  });
});
