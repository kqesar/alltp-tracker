import { describe, expect, it } from "vitest";
import {
  checkRomSeed,
  isSeedId,
  recordSeed,
  romSeedText,
} from "@/games/seedId";

describe("isSeedId", () => {
  it("takes what the three generators write", () => {
    for (const id of [
      "9MQ9gO1wMD",
      "dsjF6gGsH",
      "8506bbef2c2b4432af378b571c6c9133",
      "x".repeat(64),
    ]) {
      expect(isSeedId(id), id).toBe(true);
    }
  });

  it("refuses anything else", () => {
    for (const bad of ["", "x".repeat(65), "a\nb", "é", 3, null, undefined]) {
      expect(isSeedId(bad), String(bad)).toBe(false);
    }
  });
});

describe("recordSeed", () => {
  type Run = { seed: string | null; label: string };
  /** A store of a run and its history, laying news on both as the games' do. */
  const storeOf = (current: Run, history: Run[]) => {
    const state = {
      applyGameNews: (change: (run: Run) => Partial<Run> | null) => {
        Object.assign(state, { ...state, ...change(state) });
        history.forEach((run, at) => {
          history[at] = { ...run, ...change(run) };
        });
      },
      ...current,
    };
    return { getState: () => state };
  };

  it("lays a new seed on the run and the history that shares its seed", () => {
    const history: Run[] = [
      { label: "before the seed was known", seed: null },
      { label: "another seed's", seed: "OLD" },
    ];
    const store = storeOf({ label: "now", seed: null }, history);

    recordSeed(store, "9MQ9gO1wMD");

    expect(store.getState().seed).toBe("9MQ9gO1wMD");
    expect(history.map((run) => run.seed)).toEqual(["9MQ9gO1wMD", "OLD"]);
  });

  it("does nothing for no seed or the run's own", () => {
    const history: Run[] = [{ label: "then", seed: "A" }];
    const store = storeOf({ label: "now", seed: "A" }, history);
    const before = store.getState().applyGameNews;
    let calls = 0;
    store.getState().applyGameNews = (change) => {
      calls++;
      before(change);
    };

    recordSeed(store, null);
    recordSeed(store, "A");

    expect(calls).toBe(0);
  });
});

describe("checkRomSeed", () => {
  it("says nothing while either seed is unknown, or for the same seed", () => {
    expect(checkRomSeed(null, "9MQ9gO1wMD", false)).toBeNull();
    expect(checkRomSeed("9MQ9gO1wMD", null, false)).toBeNull();
    expect(checkRomSeed("9MQ9gO1wMD", "9MQ9gO1wMD", false)).toBeNull();
    expect(checkRomSeed(null, "9MQ9gO1wMD", true)).toBeNull();
  });

  it("names both seeds when they differ", () => {
    expect(checkRomSeed("9MQ9gO1wMD", "0yAObedRMV", false)).toEqual({
      kind: "differs",
      rom: "0yAObedRMV",
      run: "9MQ9gO1wMD",
    });
  });

  it("checks nothing in Race Mode, and says so for a run that knows its seed", () => {
    expect(checkRomSeed("9MQ9gO1wMD", "0yAObedRMV", true)).toEqual({
      kind: "race",
    });
    expect(checkRomSeed("9MQ9gO1wMD", null, true)).toEqual({ kind: "race" });
  });

  it("takes the game's own sameness", () => {
    const anyCase = (a: string, b: string) =>
      a.toLowerCase() === b.toLowerCase();
    expect(checkRomSeed("ABC", "abc", false, anyCase)).toBeNull();
    expect(checkRomSeed("ABC", "abd", false, anyCase)?.kind).toBe("differs");
  });
});

describe("romSeedText", () => {
  it("names the ROM's seed, then the run's, and the answers", () => {
    expect(
      romSeedText({ kind: "differs", rom: "0yAObedRMV", run: "9MQ9gO1wMD" }),
    ).toBe(
      "The game runs seed 0yAObedRMV, not this run's seed 9MQ9gO1wMD: the board does not follow it. Start a new run from this ROM, or ignore this to follow it on this run.",
    );
  });

  it("says the check is off in Race Mode", () => {
    expect(romSeedText({ kind: "race" })).toBe(
      "Race Mode: the tracker does not check that the game is this run's seed.",
    );
  });
});
