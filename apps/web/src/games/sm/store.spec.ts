import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportSave,
  freshProgress,
  parseSave,
  SM_STORAGE_KEY,
  useSmStore,
} from "@/games/sm/store";

const store = () => useSmStore.getState();

beforeEach(() => {
  localStorage.clear();
  useSmStore.setState(useSmStore.getInitialState(), true);
});

describe("the Super Metroid run", () => {
  it("steps an item within its pool, wrapping both ways", () => {
    store().step("morph", 1);
    expect(store().items.morph).toBe(1);
    store().step("morph", 1);
    expect(store().items.morph).toBe(0);
    store().step("reserveTank", -1);
    expect(store().items.reserveTank).toBe(4);
  });

  it("marks only the seed's objectives done, and forgets those it drops", () => {
    store().toggleDone("kraid");
    store().toggleDone("botwoon");
    expect(store().done).toEqual(["kraid"]);
    store().setObjectives(["kraid", "botwoon", "nope"]);
    expect(store().objectives).toEqual(["kraid", "botwoon"]);
    store().setObjectives(["botwoon"]);
    expect(store().done).toEqual([]);
  });

  it("undoes and redoes the player's changes", () => {
    store().step("bombs", 1);
    store().setOption("wallJump", true);
    store().undo();
    expect(store().wallJump).toBe(false);
    expect(store().items.bombs).toBe(1);
    store().redo();
    expect(store().wallJump).toBe(true);
    expect(store().future).toEqual([]);
  });

  it("starts a new game with the seed's objectives and settings kept", () => {
    store().setObjectives(["metroidRoom1"]);
    store().setOption("splitSpeed", true);
    store().step("missile", 1);
    store().toggleDone("metroidRoom1");
    store().reset();
    expect(store()).toMatchObject({
      done: [],
      objectives: ["metroidRoom1"],
      splitSpeed: true,
    });
    expect(store().items.missile).toBe(0);
  });

  it("lays the game's news on the run and its history, as no step", () => {
    store().step("varia", 1);
    const steps = store().past.length;
    store().applyGameNews((run) => ({ items: { ...run.items, gravity: 1 } }));
    expect(store().items.gravity).toBe(1);
    expect(store().past).toHaveLength(steps);
    expect(store().past.every((run) => run.items.gravity === 1)).toBe(true);
    // Undoing the player's change keeps the game's
    store().undo();
    expect(store().items).toMatchObject({ gravity: 1, varia: 0 });
  });

  it("restores a saved run, and drops one that is not one", async () => {
    localStorage.setItem(
      SM_STORAGE_KEY,
      JSON.stringify({
        state: { ...freshProgress(), done: ["kraid"] },
        version: 1,
      }),
    );
    await useSmStore.persist.rehydrate();
    expect(store().done).toEqual(["kraid"]);
    localStorage.setItem(
      SM_STORAGE_KEY,
      JSON.stringify({ state: { items: "nope" }, version: 1 }),
    );
    useSmStore.setState(useSmStore.getInitialState(), true);
    await useSmStore.persist.rehydrate();
    expect(store().done).toEqual([]);
  });

  it("drops a saved run holding more than an item's pool", async () => {
    const run = freshProgress();
    run.items.missile = 47;
    localStorage.setItem(
      SM_STORAGE_KEY,
      JSON.stringify({ state: { ...run, done: ["kraid"] }, version: 1 }),
    );
    await useSmStore.persist.rehydrate();
    expect(store().items.missile).toBe(0);
    expect(store().done).toEqual([]);
  });
});

describe("Super Metroid saves", () => {
  it("export and import a run", () => {
    const run = { ...freshProgress(), done: ["kraid"] };
    run.items.missile = 12;
    expect(parseSave(exportSave(run))).toEqual({ ok: true, progress: run });
  });

  it("export the run, never the undo history held beside it", () => {
    store().step("morph", 1);
    store().step("bombs", 1);
    expect(store().past).toHaveLength(2);

    const { progress } = JSON.parse(exportSave(store()));

    expect(Object.keys(progress).sort()).toEqual(
      Object.keys(freshProgress()).sort(),
    );
  });

  it("refuse what is not a Super Metroid run, saying why", () => {
    expect(parseSave("{")).toEqual({ error: "not-json", ok: false });
    expect(parseSave("{}")).toEqual({ error: "not-a-save", ok: false });
    const save = (game: string, version: number, progress: unknown) =>
      JSON.stringify({ format: "alltp-tracker-save", game, progress, version });
    expect(parseSave(save("alttpr", 11, {}))).toEqual({
      error: "other-game",
      ok: false,
    });
    expect(parseSave(save("sm", 2, freshProgress()))).toEqual({
      error: "newer-version",
      ok: false,
    });
    const tooMany = freshProgress();
    tooMany.items.energyTank = 15;
    expect(parseSave(save("sm", 1, tooMany))).toEqual({
      error: "invalid",
      ok: false,
    });
    expect(
      parseSave(save("sm", 1, { ...freshProgress(), done: ["zelda"] })),
    ).toEqual({ error: "invalid", ok: false });
  });

  it("hold an item a save left out at none", () => {
    const { items, ...rest } = freshProgress();
    const { wallJump: _, ...older } = items;
    const parsed = parseSave(
      JSON.stringify({
        format: "alltp-tracker-save",
        game: "sm",
        progress: { ...rest, items: older },
        version: 1,
      }),
    );
    expect(parsed.ok && parsed.progress.items.wallJump).toBe(0);
  });
});

describe("the store as the page creates it", () => {
  it("restores the run saved before it was created", async () => {
    vi.resetModules();
    localStorage.setItem(
      SM_STORAGE_KEY,
      JSON.stringify({
        state: { ...freshProgress(), done: ["draygon"] },
        version: 1,
      }),
    );
    const fresh = await import("@/games/sm/store");
    expect(fresh.useSmStore.getState().done).toEqual(["draygon"]);
  });
});

describe("the run timer", () => {
  const T0 = 1_000_000;

  it("starts, pauses, finishes and resets, apart from the history", () => {
    store().startTimer(T0);
    expect(store().timer).toEqual({
      elapsedMs: 0,
      finished: false,
      startedAt: T0,
    });
    store().pauseTimer(T0 + 5_000);
    expect(store().timer).toEqual({
      elapsedMs: 5_000,
      finished: false,
      startedAt: null,
    });
    store().startTimer(T0 + 6_000);
    store().finishTimer(T0 + 10_000);
    expect(store().timer).toEqual({
      elapsedMs: 9_000,
      finished: true,
      startedAt: null,
    });
    // No step of the history, and undoing a find leaves the clock alone
    expect(store().past).toEqual([]);
    store().step("morph", 1);
    store().undo();
    expect(store().timer.finished).toBe(true);
    store().resetTimer();
    expect(store().timer).toEqual({
      elapsedMs: 0,
      finished: false,
      startedAt: null,
    });
  });

  it("is cleared by a new game and by an import, with the clock's base", () => {
    store().startTimer(T0);
    store().setClockBase(1_000);
    store().reset();
    expect(store()).toMatchObject({
      clockBase: null,
      timer: { elapsedMs: 0, startedAt: null },
    });

    store().startTimer(T0);
    store().setClockBase(1_000);
    store().load(freshProgress());
    expect(store()).toMatchObject({
      clockBase: null,
      timer: { elapsedMs: 0, startedAt: null },
    });
  });

  it.each([
    ["untimed", 0],
    ["timed", 477_000],
  ])(
    "is cleared by a new game and an import after a run that ended %s",
    (_, elapsedMs) => {
      const ended = { elapsedMs, finished: true, startedAt: null };
      useSmStore.setState({ timer: ended });
      store().reset();
      expect(store().timer.finished).toBe(false);
      expect(store().timer.elapsedMs).toBe(0);

      useSmStore.setState({ timer: ended });
      store().load(freshProgress());
      expect(store().timer.finished).toBe(false);
      expect(store().timer.elapsedMs).toBe(0);
    },
  );

  it("sets the timer on the game's clock outside the undo history", () => {
    store().startTimer(T0);
    store().alignTimer({ ms: 5_000, status: "running" }, T0 + 1_000);
    const timer = store().timer;
    expect(timer).toEqual({
      elapsedMs: 5_000,
      finished: false,
      startedAt: T0 + 1_000,
    });
    expect(store().past).toEqual([]);
    // Already there: the same object, so nothing redraws
    store().alignTimer({ ms: 5_100, status: "running" }, T0 + 1_100);
    expect(store().timer).toBe(timer);
  });

  it("is saved with the run, with the auto setting, the clock choice and its base", async () => {
    store().startTimer(T0);
    store().setAutoTimer(false);
    store().setTimerClock("game");
    store().setClockBase(123_456);
    const saved = localStorage.getItem(SM_STORAGE_KEY) ?? "{}";
    expect(JSON.parse(saved).state).toMatchObject({
      autoTimer: false,
      clockBase: 123_456,
      timer: { elapsedMs: 0, finished: false, startedAt: T0 },
      timerClock: "game",
    });

    useSmStore.setState(useSmStore.getInitialState(), true);
    expect(store().timer.startedAt).toBeNull();
    localStorage.setItem(SM_STORAGE_KEY, saved);
    await useSmStore.persist.rehydrate();
    expect(store()).toMatchObject({
      autoTimer: false,
      clockBase: 123_456,
      timer: { startedAt: T0 },
      timerClock: "game",
    });
  });

  it("restores a run saved before the timer, and refuses a damaged timer", async () => {
    const save = (state: object) =>
      localStorage.setItem(
        SM_STORAGE_KEY,
        JSON.stringify({ state: { ...freshProgress(), ...state }, version: 1 }),
      );
    save({ done: ["kraid"] });
    await useSmStore.persist.rehydrate();
    expect(store()).toMatchObject({
      autoTimer: true,
      clockBase: null,
      done: ["kraid"],
      timer: { elapsedMs: 0, startedAt: null },
      timerClock: "real",
    });

    save({
      autoTimer: "yes",
      clockBase: -4,
      timer: { elapsedMs: "soon" },
      timerClock: "ingame",
    });
    await useSmStore.persist.rehydrate();
    expect(store()).toMatchObject({
      autoTimer: true,
      clockBase: null,
      timer: { elapsedMs: 0, startedAt: null },
      timerClock: "real",
    });
  });

  it("is not in an export", () => {
    store().startTimer(T0);
    const { progress } = JSON.parse(exportSave(store()));
    expect(progress).not.toHaveProperty("timer");
    expect(progress).not.toHaveProperty("clockBase");
  });
});

describe("the run's seed", () => {
  const file = (progress: object) =>
    JSON.stringify({
      format: "alltp-tracker-save",
      game: "sm",
      progress,
      version: 1,
    });

  it("is null in a fresh run, written by an export and read back", () => {
    expect(store().seed).toBeNull();
    useSmStore.setState({ seed: "dsjF6gGsH" });
    const parsed = parseSave(exportSave(store()));
    expect(parsed.ok && parsed.progress.seed).toBe("dsjF6gGsH");
  });

  it("is null in a save from before it was kept, which still opens", () => {
    const { seed: _, ...older } = freshProgress();
    const parsed = parseSave(file(older));
    expect(parsed.ok && parsed.progress.seed).toBeNull();
  });

  it("refuses a seed that is not an id", () => {
    for (const bad of [4, "", "x".repeat(65)]) {
      expect(parseSave(file({ ...freshProgress(), seed: bad }))).toEqual({
        error: "invalid",
        ok: false,
      });
    }
  });

  it("is restored with the saved run, and cleared by New game", async () => {
    vi.resetModules();
    localStorage.setItem(
      SM_STORAGE_KEY,
      JSON.stringify({
        state: { ...freshProgress(), seed: "dsjF6gGsH" },
        version: 1,
      }),
    );
    const fresh = await import("@/games/sm/store");
    expect(fresh.useSmStore.getState().seed).toBe("dsjF6gGsH");
    fresh.useSmStore.getState().reset();
    expect(fresh.useSmStore.getState().seed).toBeNull();
  });
});

describe("the locations found", () => {
  const file = (progress: object) =>
    JSON.stringify({
      format: "alltp-tracker-save",
      game: "sm",
      progress,
      version: 1,
    });
  const FOUND = { "46:3": { at: 1_800_000_000_000, ms: 754_000 } };

  it("is empty in a fresh run, written by an export and read back", () => {
    expect(store().found).toEqual({});
    useSmStore.setState({ found: FOUND });
    const { progress } = JSON.parse(exportSave(store()));
    expect(progress.found).toEqual(FOUND);
    const parsed = parseSave(exportSave(store()));
    expect(parsed.ok && parsed.progress.found).toEqual(FOUND);
  });

  it("is empty in a save from before it was kept, which still opens", () => {
    const { found: _, ...older } = freshProgress();
    const parsed = parseSave(file(older));
    expect(parsed.ok && parsed.progress.found).toEqual({});
  });

  it("refuses a location the pack does not know, and a value that is no time", () => {
    for (const bad of [
      { "1:1": { at: 1, ms: null } },
      { "46:3": { at: -1, ms: null } },
      { "46:3": { at: 1 } },
      { "46:3": 12 },
      [],
    ]) {
      expect(parseSave(file({ ...freshProgress(), found: bad }))).toEqual({
        error: "invalid",
        ok: false,
      });
    }
  });

  it("is laid on the history too: undoing a step never takes back a find", () => {
    store().step("morph", 1);
    store().applyGameNews(() => ({ found: FOUND }));
    store().undo();
    expect(store().items.morph).toBe(0);
    expect(store().found).toEqual(FOUND);
    store().redo();
    expect(store().found).toEqual(FOUND);
  });

  it("is restored with the saved run, and cleared by New game", async () => {
    vi.resetModules();
    localStorage.setItem(
      SM_STORAGE_KEY,
      JSON.stringify({
        state: { ...freshProgress(), found: FOUND },
        version: 1,
      }),
    );
    const fresh = await import("@/games/sm/store");
    expect(fresh.useSmStore.getState().found).toEqual(FOUND);
    fresh.useSmStore.getState().reset();
    expect(fresh.useSmStore.getState().found).toEqual({});
  });
});
