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
