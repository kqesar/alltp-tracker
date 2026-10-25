import { describe, expect, it } from "vitest";
import { isSeedId, recordSeed } from "@/games/seedId";

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
