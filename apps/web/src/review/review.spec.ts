import type { SpoilerError, SpoilerGame } from "@alltp/spoiler";
import { describe, expect, it, vi } from "vitest";
import { isRaceModeOn, type RaceModeState } from "@/autotrack/raceMode";
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
    raceChoice: "auto",
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
