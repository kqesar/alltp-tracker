import type { SpoilerError, SpoilerGame } from "@alltp/spoiler";
import { describe, expect, it, vi } from "vitest";
import {
  boardRestored,
  isRaceHeldByMemory,
  isRaceModeOn,
  isRaceModeOrPending,
  onRaceRestored,
  onRunReplaced,
  type RaceModeState,
  rememberRace,
  runReplaced,
  seedIsRace,
} from "@/autotrack/raceMode";
import { spoilerFile, spoilerLog } from "@/games/alttpr/review/fixtures";
import { reviewGate } from "@/review/gate";
import { parseFile } from "@/review/parse";
import { type ReviewWorker, readSpoiler } from "@/review/read";
import { refusalWords } from "@/review/words";
import { finishTimer, IDLE_TIMER, startTimer } from "@/utils/runTimer";

const OVER = finishTimer(startTimer(IDLE_TIMER, 0), 60_000);

describe("reviewGate", () => {
  it("opens once the timer is stopped for good, outside Race Mode", () => {
    expect(reviewGate({ race: false, timer: OVER })).toBe("open");
  });

  it("stays shut while the run is on, paused or not started", () => {
    expect(reviewGate({ race: false, timer: IDLE_TIMER })).toBe("not-over");
    expect(reviewGate({ race: false, timer: startTimer(IDLE_TIMER, 0) })).toBe(
      "not-over",
    );
    expect(
      reviewGate({
        race: false,
        timer: { elapsedMs: 5000, finished: false, startedAt: null },
      }),
    ).toBe("not-over");
  });

  it("refuses in Race Mode, whatever the timer says", () => {
    expect(reviewGate({ race: true, timer: OVER })).toBe("race-mode");
    expect(reviewGate({ race: true, timer: IDLE_TIMER })).toBe("race-mode");
  });
});

describe("isRaceModeOn", () => {
  const off: RaceModeState = {
    active: false,
    connectOnStart: false,
    raceChoice: "auto",
    raceSeen: false,
    reading: null,
    status: { code: "idle" },
  };

  it("is off by default", () => {
    expect(isRaceModeOn(off)).toBe(false);
  });

  it("is on when the player holds it on", () => {
    expect(isRaceModeOn({ ...off, raceChoice: "on" })).toBe(true);
  });

  it("is on when the game last read is a race's", () => {
    expect(isRaceModeOn({ ...off, reading: { race: true } })).toBe(true);
    expect(isRaceModeOn({ ...off, reading: { race: false } })).toBe(false);
  });

  it("is on when the running session's status says race", () => {
    expect(
      isRaceModeOn({
        ...off,
        active: true,
        status: {
          code: "connected",
          race: { active: true, flag: "race", setting: "auto" },
        } as RaceModeState["status"],
      }),
    ).toBe(true);
  });
});

describe("isRaceModeOrPending", () => {
  const handTracked: RaceModeState = {
    active: false,
    connectOnStart: false,
    raceChoice: "auto",
    raceSeen: false,
    reading: null,
    status: { code: "idle" },
  };
  const connectedOpen = {
    code: "connected",
    race: { active: false, flag: "open", setting: "auto" },
  } as RaceModeState["status"];

  it("is off for a run tracked by hand, autotracking never started", () => {
    expect(isRaceModeOrPending(handTracked)).toBe(false);
  });

  it("is on where Race Mode is", () => {
    expect(isRaceModeOrPending({ ...handTracked, raceChoice: "on" })).toBe(
      true,
    );
    expect(
      isRaceModeOrPending({ ...handTracked, reading: { race: true } }),
    ).toBe(true);
  });

  it("fails closed while autotracking starts and no flag was read", () => {
    // The desktop app's stream starts with the app, before SNI answers
    expect(isRaceModeOrPending({ ...handTracked, connectOnStart: true })).toBe(
      true,
    );
    // Connecting, or waiting on another tab
    expect(isRaceModeOrPending({ ...handTracked, active: true })).toBe(true);
  });

  it("is off once a reading or the session's status told an open seed", () => {
    expect(
      isRaceModeOrPending({
        ...handTracked,
        connectOnStart: true,
        reading: { race: false },
      }),
    ).toBe(false);
    expect(
      isRaceModeOrPending({
        ...handTracked,
        active: true,
        status: connectedOpen,
      }),
    ).toBe(false);
  });

  it("is off for a game without a flag the player turned off", () => {
    expect(
      isRaceModeOrPending({
        ...handTracked,
        active: true,
        connectOnStart: true,
        raceChoice: "off",
      }),
    ).toBe(false);
  });
});

describe("a race remembered (raceSeen)", () => {
  const idle: RaceModeState = {
    active: false,
    connectOnStart: false,
    raceChoice: "auto",
    raceSeen: false,
    reading: null,
    status: { code: "idle" },
  };
  const flagged = (flag: string, active: boolean) =>
    ({
      code: "connected",
      race: { active, flag, setting: "auto" },
    }) as RaceModeState["status"];

  it("keeps Race Mode on for every consumer, with no session and no reading", () => {
    expect(isRaceModeOn(idle)).toBe(false);
    expect(isRaceModeOn({ ...idle, raceSeen: true })).toBe(true);
    // Not even autotracking set to connect and an open flag read after it
    expect(isRaceModeOrPending({ ...idle, raceSeen: true })).toBe(true);
    expect(
      isRaceModeOrPending({
        ...idle,
        active: true,
        raceSeen: true,
        reading: { race: false },
        status: flagged("open", false),
      }),
    ).toBe(true);
  });

  it("reads the seed as a race's from a ROM flag that says race or cannot tell, never from one that says open", () => {
    // In doubt, a race: a flag the tracker does not know or cannot read
    for (const flag of ["race", "unknown", "unreadable"]) {
      expect(seedIsRace({ status: flagged(flag, true) })).toBe(true);
    }
    // Open, none (a game with no flag) and a flag not read yet say nothing
    for (const flag of ["open", "none", "pending"]) {
      expect(seedIsRace({ status: flagged(flag, true) })).toBe(false);
    }
    expect(seedIsRace({ status: { code: "idle" } })).toBe(false);
  });

  it("says when only the memory holds Race Mode", () => {
    const held = { ...idle, raceSeen: true };
    expect(isRaceHeldByMemory(held)).toBe(true);
    expect(isRaceHeldByMemory(idle)).toBe(false);
    // The player's choice, or the session now holding Race Mode, holds it itself
    expect(isRaceHeldByMemory({ ...held, raceChoice: "on" })).toBe(false);
    expect(isRaceHeldByMemory({ ...held, status: flagged("race", true) })).toBe(
      false,
    );
    // A session on an open seed does not: the memory still does
    expect(
      isRaceHeldByMemory({ ...held, status: flagged("open", false) }),
    ).toBe(true);
  });

  describe("rememberRace", () => {
    type Slice = Pick<RaceModeState, "raceSeen" | "status">;
    /** A store that hands each change, and the state before it, to its listeners. */
    const fakeStore = () => {
      let state: Slice = { raceSeen: false, status: { code: "idle" } };
      const listeners = new Set<(next: Slice, before: Slice) => void>();
      const move = (next: Partial<Slice>) => {
        const before = state;
        state = { ...state, ...next };
        for (const listener of listeners) listener(state, before);
      };
      rememberRace({
        getState: () => state,
        setState: (change) => move(change),
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      });
      return { move, seen: () => state.raceSeen };
    };

    it("is set once the session reads a race, or a flag it cannot tell", () => {
      for (const flag of ["race", "unknown", "unreadable"]) {
        const store = fakeStore();
        store.move({ status: flagged("open", false) });
        expect(store.seen()).toBe(false);
        store.move({ status: flagged(flag, true) });
        expect(store.seen()).toBe(true);
      }
    });

    it("is never set by an open flag, or a game that has none", () => {
      const store = fakeStore();
      for (const flag of ["open", "none"]) {
        store.move({ status: flagged(flag, false) });
        store.move({ status: { code: "stopped" } });
      }
      expect(store.seen()).toBe(false);
    });

    it("is set when the session ends before the flag was read, Race Mode in effect", () => {
      const store = fakeStore();
      store.move({ status: flagged("pending", true) });
      // The moment the flag is unread is no word: still not remembered
      expect(store.seen()).toBe(false);
      store.move({ status: { code: "stopped" } });
      expect(store.seen()).toBe(true);
    });

    it("is not set by a session that read open, then ended", () => {
      const store = fakeStore();
      store.move({ status: flagged("pending", true) });
      store.move({ status: flagged("open", false) });
      store.move({ status: { code: "stopped" } });
      expect(store.seen()).toBe(false);
    });
  });

  it("tells a game's listeners its run was replaced, and which race it forgot", () => {
    const heard = vi.fn(() => false);
    const stop = onRunReplaced(heard);
    runReplaced("sm", []);
    stop();
    runReplaced("alttpr", []);

    expect(heard).toHaveBeenCalledOnce();
    expect(heard).toHaveBeenCalledWith("sm");
  });

  it("brings the race back when Undo restores a board of the race that was replaced", () => {
    const board = {};
    const other = {};
    const restored = vi.fn();
    const stops = [
      onRunReplaced((game) => game === "g"),
      onRaceRestored(restored),
    ];
    runReplaced("g", [board]);

    boardRestored("g", other);
    expect(restored).not.toHaveBeenCalled();
    boardRestored("g", board);
    expect(restored).toHaveBeenCalledWith("g");

    // A run replaced with no race remembered marks nothing
    const plain = {};
    runReplaced("h", [plain]);
    boardRestored("h", plain);
    expect(restored).toHaveBeenCalledOnce();
    for (const stop of stops) stop();
  });
});

describe("refusalWords", () => {
  // Every code the package names has a sentence of its own
  const CODES: Record<SpoilerError, string | undefined> = {
    "newer-version": undefined,
    "not-a-spoiler": undefined,
    "not-over": undefined,
    "other-game": "sm",
    "race-mode": undefined,
    "seed-differs": "AAA / BBB",
    "settings-differ": "goal: ganon / pedestal",
    stripped: "off",
    "too-large": "1 MiB",
    unsupported: "multiworld",
  };

  it.each(Object.entries(CODES))("words %s", (code, detail) => {
    const words = refusalWords(
      { detail, error: code as SpoilerError, ok: false },
      "A Link to the Past",
    );
    expect(words.length).toBeGreaterThan(20);
    expect(words).not.toContain("undefined");
  });

  it("says both seeds, and both values of a setting", () => {
    expect(
      refusalWords(
        { detail: "AAA / BBB", error: "seed-differs", ok: false },
        "x",
      ),
    ).toBe("This spoiler log is for seed BBB; your run is seed AAA.");
    expect(
      refusalWords(
        {
          detail: "crystalsGanon: 7 / 3",
          error: "settings-differ",
          ok: false,
        },
        "x",
      ),
    ).toBe(
      "This spoiler log is not your run's: its crystals for Ganon is 3, your run's is 7.",
    );
  });

  it("names the game a file belongs to when it is another's", () => {
    expect(
      refusalWords({ detail: "sm", error: "other-game", ok: false }, "A Link"),
    ).toContain("Map Rando");
  });
});

/** A worker that answers a message with what the test says, or never. */
const fakeWorker = (
  answer: ((message: unknown) => unknown) | null,
): { worker: ReviewWorker; terminate: ReturnType<typeof vi.fn> } => {
  const terminate = vi.fn();
  const worker: ReviewWorker = {
    onerror: null,
    onmessage: null,
    postMessage: (message) => {
      if (answer === null) return;
      const data = answer(message);
      queueMicrotask(() => worker.onmessage?.({ data } as MessageEvent<never>));
    },
    terminate,
  };
  return { terminate, worker };
};

describe("readSpoiler", () => {
  it("refuses a file over the bound before reading a byte", async () => {
    const text = vi.fn();
    const huge = {
      name: "x.txt",
      size: 2 * 1024 * 1024,
      text,
    } as unknown as File;
    const result = await readSpoiler(huge, "alttpr", { worker: null });
    expect(result).toMatchObject({ error: "too-large", ok: false });
    expect(text).not.toHaveBeenCalled();
  });

  it("parses in place where there is no Worker", async () => {
    const result = await readSpoiler(spoilerFile("9MQ9gO1wMD"), "alttpr", {
      worker: null,
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.placements).toHaveLength(
      spoilerLog("9MQ9gO1wMD").placements.length,
    );
  });

  it("hands the file to the worker and ends it with the answer", async () => {
    const posted: unknown[] = [];
    const sent = { ok: true, value: { marker: "from the worker" } };
    const { terminate, worker } = fakeWorker((message) => {
      posted.push(message);
      return sent;
    });
    const file = spoilerFile("9MQ9gO1wMD");
    const result = await readSpoiler(file, "alttpr", { worker: () => worker });
    expect(result).toBe(sent);
    expect(posted).toEqual([{ file, game: "alttpr" }]);
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it("refuses a read that never answers, and ends the worker", async () => {
    vi.useFakeTimers();
    try {
      const { terminate, worker } = fakeWorker(null);
      const pending = readSpoiler(spoilerFile("9MQ9gO1wMD"), "alttpr", {
        timeoutMs: 1000,
        worker: () => worker,
      });
      await vi.advanceTimersByTimeAsync(1000);
      await expect(pending).resolves.toMatchObject({
        detail: "timed out",
        error: "not-a-spoiler",
      });
      expect(terminate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses a worker that fails", async () => {
    const { terminate, worker } = fakeWorker(null);
    const pending = readSpoiler(spoilerFile("9MQ9gO1wMD"), "alttpr", {
      worker: () => worker,
    });
    worker.onerror?.(new Event("error") as ErrorEvent);
    await expect(pending).resolves.toMatchObject({ error: "not-a-spoiler" });
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it("refuses a game it has no parser for", async () => {
    // What the worker is handed crosses a message: never trust its game
    const result = await parseFile(
      spoilerFile("9MQ9gO1wMD"),
      "toString" as SpoilerGame,
    );
    expect(result).toMatchObject({ error: "unsupported", ok: false });
  });

  it("says another randomizer's file is another game's", async () => {
    const mapRando = new File(
      ['{"summary":[],"all_items":[],"start_location":{}}'],
      "spoiler.json",
    );
    const result = await readSpoiler(mapRando, "alttpr", { worker: null });
    expect(result).toMatchObject({ error: "other-game", ok: false });
  });

  it("never throws on a file's content", async () => {
    for (const body of ["", "{", "null", "\u0000\u0000", "[1,2]", "{}"]) {
      const result = await readSpoiler(new File([body], "x.txt"), "alttpr", {
        worker: null,
      });
      expect(result.ok).toBe(false);
    }
  });
});
