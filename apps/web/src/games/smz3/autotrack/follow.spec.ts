import { smz3Ms } from "@alltp/pack-smz3";
import { beforeEach, describe, expect, it } from "vitest";
import { createSmz3Follower } from "@/games/smz3/autotrack/follow";
import { readSmz3 } from "@/games/smz3/autotrack/reading";
import { useSmz3Store } from "@/games/smz3/store";
import { timerMs } from "@/utils/runTimer";
import type { MemoryRangeId } from "../../../../../../packs/smz3/src/autotrack/memory";
import {
  type Smz3Game,
  viewOf,
  writeSmz3,
} from "../../../../../../packs/smz3/test/smz3-rom";

const run = () => useSmz3Store.getState();

const CLOCK_IDS: MemoryRangeId[] = [
  "clock-sm-live",
  "clock-sm-saved",
  "clock-zelda-live",
  "clock-zelda-saved",
];

/** A reading at an instant; `race` leaves out the counters, as Race Mode does. */
const readingAt = (at: number, game: Smz3Game = {}, race = false) =>
  readSmz3(
    viewOf(
      writeSmz3(new Uint8Array(0x100_0000), game),
      game.mode ?? "zelda",
      race ? CLOCK_IDS : [],
    ),
    race,
    at,
  );

const T0 = 1_000_000;
/** Super Metroid's states and Zelda's modes: the title, the file select, play, a pause, a door, a death. */
const SM = {
  DOOR: 0x0a,
  FILE_SELECT: 0x04,
  LOAD: 0x1f,
  PAUSED: 0x0c,
  PLAY: 0x08,
};
const ZELDA = { DEATH: 0x12, FILE_SELECT: 0x01, PLAY: 0x09, PRE_DUNGEON: 0x06 };

beforeEach(() => {
  localStorage.clear();
  useSmz3Store.setState(useSmz3Store.getInitialState(), true);
});

describe("the run timer, with the game", () => {
  it("starts on the first reading in play after one before play, in Super Metroid", () => {
    const follower = createSmz3Follower();
    follower.read(readingAt(T0, { mode: "sm", state: SM.FILE_SELECT }));
    expect(run().timer.startedAt).toBeNull();

    follower.read(readingAt(T0 + 1_000, { mode: "sm", state: SM.PLAY }));
    expect(run().timer).toEqual({
      elapsedMs: 0,
      finished: false,
      startedAt: T0 + 1_000,
    });

    // A pause, a door, a portal, Zelda: the timer runs on, from its start
    follower.read(readingAt(T0 + 5_000, { mode: "sm", state: SM.PAUSED }));
    follower.read(readingAt(T0 + 6_000, { mode: "sm", state: SM.PLAY }));
    follower.read(readingAt(T0 + 7_000, { mode: "sm", state: SM.DOOR }));
    follower.read(readingAt(T0 + 8_000, { state: ZELDA.PLAY }));
    expect(run().timer.startedAt).toBe(T0 + 1_000);
  });

  it("starts in Zelda for a file that starts there, after Super Metroid's boot and its set-up", () => {
    const follower = createSmz3Follower();
    // The ROM boots into Super Metroid: the title, then a new game's set-up
    follower.read(readingAt(T0, { mode: "sm", state: 0x00 }));
    follower.read(readingAt(T0 + 1_000, { mode: "sm", state: SM.LOAD }));
    expect(run().timer.startedAt).toBeNull();
    // Zelda is loading, then in play: the readings between do not disarm it
    follower.read(readingAt(T0 + 2_000, { state: ZELDA.PRE_DUNGEON }));
    expect(run().timer.startedAt).toBeNull();
    follower.read(readingAt(T0 + 3_000, { state: ZELDA.PLAY }));
    expect(run().timer.startedAt).toBe(T0 + 3_000);
  });

  it("starts in Zelda too from its own file select", () => {
    const follower = createSmz3Follower();
    follower.read(readingAt(T0, { state: ZELDA.FILE_SELECT }));
    follower.read(readingAt(T0 + 1_000, { state: ZELDA.PLAY }));
    expect(run().timer.startedAt).toBe(T0 + 1_000);
  });

  it("starts nothing for a tracker that connects to a game already in play", () => {
    createSmz3Follower().read(readingAt(T0, { state: ZELDA.PLAY }));
    createSmz3Follower().read(readingAt(T0, { mode: "sm", state: SM.PLAY }));
    expect(run().timer.startedAt).toBeNull();
  });

  it("starts nothing when play follows a pause, a door, a death or a portal: no new game", () => {
    const follower = createSmz3Follower();
    follower.read(readingAt(T0, { mode: "sm", state: SM.PLAY }));
    follower.read(readingAt(T0 + 1_000, { mode: "sm", state: SM.PAUSED }));
    follower.read(readingAt(T0 + 2_000, { mode: "sm", state: SM.PLAY }));
    follower.read(readingAt(T0 + 3_000, { state: ZELDA.DEATH }));
    follower.read(readingAt(T0 + 4_000, { state: ZELDA.PLAY }));
    follower.read(readingAt(T0 + 5_000, { state: ZELDA.PRE_DUNGEON }));
    follower.read(readingAt(T0 + 6_000, { state: ZELDA.PLAY }));
    expect(run().timer.startedAt).toBeNull();
  });

  it("stops when the credits run: the game byte is $11", () => {
    const follower = createSmz3Follower();
    follower.read(readingAt(T0, { mode: "sm", state: SM.FILE_SELECT }));
    follower.read(readingAt(T0 + 1_000, { mode: "sm", state: SM.PLAY }));
    // Nothing short of the credits stops it: not the end of either game
    follower.read(
      readingAt(T0 + 60_000, {
        sm: { 2: 0x04 },
        state: ZELDA.PLAY,
      }),
    );
    expect(run().timer.finished).toBe(false);

    follower.read(readingAt(T0 + 90_000, { mode: "credits" }));
    expect(run().timer).toEqual({
      elapsedMs: 89_000,
      finished: true,
      startedAt: null,
    });

    // The credits go on: the timer stays where they stopped it
    follower.read(readingAt(T0 + 120_000, { mode: "credits" }));
    expect(run().timer.elapsedMs).toBe(89_000);
  });

  it("leaves the timer to the player who turned that off", () => {
    run().setAutoTimer(false);
    const follower = createSmz3Follower();
    follower.read(readingAt(T0, { mode: "sm", state: SM.FILE_SELECT }));
    follower.read(readingAt(T0 + 1_000, { mode: "sm", state: SM.PLAY }));
    expect(run().timer.startedAt).toBeNull();

    run().startTimer(T0 + 2_000);
    follower.read(readingAt(T0 + 9_000, { mode: "credits" }));
    expect(run().timer.finished).toBe(false);
    expect(run().timer.startedAt).toBe(T0 + 2_000);
  });

  it("works in Race Mode, which never reads the counters", () => {
    const follower = createSmz3Follower();
    follower.read(readingAt(T0, { mode: "sm", state: SM.FILE_SELECT }, true));
    follower.read(readingAt(T0 + 1_000, { mode: "sm", state: SM.PLAY }, true));
    expect(run().timer.startedAt).toBe(T0 + 1_000);
    follower.read(readingAt(T0 + 9_000, { mode: "credits" }, true));
    expect(run().timer).toEqual({
      elapsedMs: 8_000,
      finished: true,
      startedAt: null,
    });
  });
});

describe("the run timer, on the game's time", () => {
  /** A reading in play at `when` ms after T0, the games' counters as given. */
  const at = (
    when: number,
    clock: { sm: number; zelda: number },
    game: Smz3Game = {},
    race = false,
  ) => readingAt(T0 + when, { clock, state: ZELDA.PLAY, ...game }, race);
  /** Zelda's file select, then Zelda in play with its counter at `zelda` frames. */
  const start = (
    clock = { sm: 0, zelda: 0 },
    follower = createSmz3Follower(),
  ) => {
    follower.read(readingAt(T0, { state: ZELDA.FILE_SELECT }));
    follower.read(at(1_000, clock));
    return follower;
  };

  beforeEach(() => run().setTimerClock("game"));

  it("is the sum of both games' counters: the running game's live one and the other's saved", () => {
    const follower = start({ sm: 6_000, zelda: 1_500 });
    expect(run().timer).toEqual({
      elapsedMs: smz3Ms(7_500),
      finished: false,
      startedAt: T0 + 1_000,
    });

    // Super Metroid runs: its live counter is the one that moves, Zelda's is
    // the saved one. A portal does not move the sum
    follower.read(
      at(11_000, { sm: 6_000, zelda: 1_500 }, { mode: "sm", state: SM.PLAY }),
    );
    expect(run().timer.elapsedMs).toBe(smz3Ms(7_500));
    follower.read(
      at(12_000, { sm: 6_600, zelda: 1_500 }, { mode: "sm", state: SM.PLAY }),
    );
    expect(run().timer.elapsedMs).toBe(smz3Ms(8_100));

    // Back to Zelda: Super Metroid's 6 600 saved, Zelda runs on from 1 500
    follower.read(
      at(22_000, { sm: 6_600, zelda: 1_500 }, { state: ZELDA.PLAY }),
    );
    expect(run().timer.elapsedMs).toBe(smz3Ms(8_100));
    follower.read(
      at(82_000, { sm: 6_600, zelda: 5_100 }, { state: ZELDA.PLAY }),
    );
    expect(run().timer).toEqual({
      elapsedMs: smz3Ms(11_700),
      finished: false,
      startedAt: T0 + 82_000,
    });
  });

  it("counts a frame as a sixtieth of a second: the time the credits print", () => {
    start({ sm: 0, zelda: 216_000 });
    expect(run().timer.elapsedMs).toBe(3_600_000);
  });

  it("follows the game back when a death or a reload sets the counters to the last save", () => {
    const follower = start({ sm: 0, zelda: 12_000 });
    follower.read(at(61_000, { sm: 0, zelda: 15_600 }));
    expect(timerMs(run().timer, T0 + 61_000)).toBe(smz3Ms(15_600));

    // Dead: the game reloads its last save, 2 minutes of play back. The timer
    // goes back with it, as the credits' total would
    follower.read(at(70_000, { sm: 0, zelda: 12_000 }));
    expect(run().timer).toEqual({
      elapsedMs: smz3Ms(12_000),
      finished: false,
      startedAt: T0 + 70_000,
    });
  });

  it("writes nothing for a reading that agrees with the timer", () => {
    const follower = start({ sm: 0, zelda: 1_000 });
    follower.read(at(11_000, { sm: 0, zelda: 1_600 }));
    const timer = run().timer;
    follower.read(at(12_000, { sm: 0, zelda: 1_660 }));
    expect(run().timer).toBe(timer);
  });

  it("stops while the sum stands still: a paused emulator", () => {
    const follower = start({ sm: 0, zelda: 1_000 });
    follower.read(at(11_000, { sm: 0, zelda: 1_600 }));
    follower.read(at(12_000, { sm: 0, zelda: 1_600 }));
    expect(run().timer).toEqual({
      elapsedMs: smz3Ms(1_600),
      finished: false,
      startedAt: null,
    });
    // It runs again as the counters move
    follower.read(at(20_000, { sm: 0, zelda: 1_900 }));
    expect(run().timer).toMatchObject({
      elapsedMs: smz3Ms(1_900),
      startedAt: T0 + 20_000,
    });
  });

  it("stops at the game's last time when a poll finds memory unchanged, and goes on when it moves", () => {
    const follower = start({ sm: 0, zelda: 1_000 });
    follower.read(at(11_000, { sm: 0, zelda: 1_600 }));
    expect(run().timer.startedAt).not.toBeNull();

    // The emulator is paused: no reading comes, a steady poll does
    follower.steady(T0 + 12_000);
    expect(run().timer).toEqual({
      elapsedMs: smz3Ms(1_600),
      finished: false,
      startedAt: null,
    });
    const held = run().timer;
    follower.steady(T0 + 13_000);
    expect(run().timer).toBe(held);

    follower.read(at(30_000, { sm: 0, zelda: 2_200 }));
    expect(run().timer).toEqual({
      elapsedMs: smz3Ms(2_200),
      finished: false,
      startedAt: T0 + 30_000,
    });
  });

  it("leaves a timer alone that real time counts, a steady poll too", () => {
    run().setTimerClock("real");
    const follower = start({ sm: 0, zelda: 1_000 });
    const running = run().timer;
    follower.steady(T0 + 12_000);
    follower.read(at(20_000, { sm: 0, zelda: 9_000 }));
    expect(run().timer).toBe(running);
  });

  it("holds the timer through a reading with no counters: the tick of a portal", () => {
    const follower = start({ sm: 0, zelda: 1_000 });
    follower.read(at(11_000, { sm: 0, zelda: 1_600 }));
    const timer = run().timer;
    // The poller counts the new mode's ranges unread for a tick
    follower.read(
      readSmz3(
        {
          ...viewOf(
            writeSmz3(new Uint8Array(0x100_0000), {
              clock: { sm: 1_600, zelda: 1_600 },
              mode: "sm",
              state: SM.PLAY,
            }),
            "sm",
          ),
          has: (id: string) => !id.startsWith("clock-"),
        },
        false,
        T0 + 12_000,
      ),
    );
    expect(run().timer).toBe(timer);
    follower.read(
      at(13_000, { sm: 1_700, zelda: 1_600 }, { mode: "sm", state: SM.PLAY }),
    );
    expect(run().timer.elapsedMs).toBe(smz3Ms(3_300));
  });

  it("stops at the credits on the game's final time, which the credits do not move", () => {
    const follower = start({ sm: 0, zelda: 1_000 });
    follower.read(at(11_000, { sm: 0, zelda: 1_600 }));
    // Both counters saved: the credits' TOTAL TIME
    follower.read(
      readingAt(T0 + 20_000, {
        clock: { sm: 100_000, zelda: 50_000 },
        mode: "credits",
      }),
    );
    expect(run().timer).toEqual({
      elapsedMs: smz3Ms(150_000),
      finished: true,
      startedAt: null,
    });
    follower.read(
      readingAt(T0 + 30_000, {
        clock: { sm: 100_000, zelda: 50_000 },
        mode: "credits",
      }),
    );
    expect(run().timer.elapsedMs).toBe(smz3Ms(150_000));
  });

  it("waits for the credits' counters to stop on their total, not on real time", () => {
    const follower = start({ sm: 0, zelda: 1_000 });
    // The tick that sees the credits is a new mode: its counters are unread
    follower.read(
      readSmz3(
        {
          ...viewOf(
            writeSmz3(new Uint8Array(0x100_0000), { mode: "credits" }),
            "credits",
          ),
          has: (id: string) => !id.startsWith("clock-"),
        },
        false,
        T0 + 20_000,
      ),
    );
    expect(run().timer.finished).toBe(false);
    follower.read(
      readingAt(T0 + 21_000, {
        clock: { sm: 100_000, zelda: 50_000 },
        mode: "credits",
      }),
    );
    expect(run().timer).toEqual({
      elapsedMs: smz3Ms(150_000),
      finished: true,
      startedAt: null,
    });
  });

  it("does not stop at the credits when the player turned that off", () => {
    run().setAutoTimer(false);
    run().startTimer(T0);
    const follower = createSmz3Follower();
    follower.read(
      readingAt(T0 + 20_000, {
        clock: { sm: 100_000, zelda: 50_000 },
        mode: "credits",
      }),
    );
    expect(run().timer.finished).toBe(false);
  });

  it("leaves a timer alone that has not begun, and the counters unread in a race", () => {
    const follower = createSmz3Follower();
    follower.read(at(1_000, { sm: 5, zelda: 5 }));
    expect(run().timer).toEqual(useSmz3Store.getInitialState().timer);

    // Started by hand, then a race: the counters are not read, real time stands
    run().startTimer(T0 + 2_000);
    const running = run().timer;
    follower.read(at(3_000, { sm: 9, zelda: 9 }, {}, true));
    follower.steady(T0 + 4_000);
    expect(run().timer).toBe(running);
  });
});
