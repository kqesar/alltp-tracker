import { beforeEach, describe, expect, it } from "vitest";
import {
  overlayReadingOf,
  overlaySource,
  type SmRun,
} from "@/games/sm/overlay";
import { freshProgress, useSmStore } from "@/games/sm/store";
import { IDLE_TIMER } from "@/utils/runTimer";

const idle = { timer: IDLE_TIMER };

/** Pinned: what Super Metroid's items may say is a decision, not a side effect. */
const ITEM_IDS = [
  "energyTank",
  "missile",
  "superMissile",
  "powerBomb",
  "bombs",
  "charge",
  "ice",
  "hiJump",
  "speedBooster",
  "wave",
  "spazer",
  "springBall",
  "varia",
  "gravity",
  "xRay",
  "plasma",
  "grapple",
  "spaceJump",
  "screwAttack",
  "morph",
  "reserveTank",
  "wallJump",
  "sparkBooster",
  "blueBooster",
];

describe("Super Metroid's overlay reading", () => {
  it("names exactly the items the API may show, whatever the options", () => {
    for (const options of [
      { splitSpeed: false, wallJump: false },
      { splitSpeed: true, wallJump: true },
    ]) {
      const { state } = overlayReadingOf({
        ...freshProgress(),
        ...idle,
        ...options,
      });
      expect(state.items.map(({ id }) => id)).toEqual(ITEM_IDS);
    }
  });

  it("reads the counts with the pool's range", () => {
    const run = freshProgress();
    run.items.missile = 12;
    run.items.charge = 1;
    const { state } = overlayReadingOf({ ...run, ...idle });

    expect(state.items.find((i) => i.id === "missile")).toEqual({
      id: "missile",
      level: 12,
      max: 46,
      name: "Missile",
    });
    expect(state.items.find((i) => i.id === "charge")?.level).toBe(1);
    expect(state.items.find((i) => i.id === "ice")?.level).toBe(0);
  });

  it("reads the seed's objectives, named, done or not, with no time", () => {
    const run = {
      ...freshProgress(),
      done: ["phantoon"],
      objectives: ["kraid", "phantoon", "botwoon"],
    };
    expect(overlayReadingOf({ ...run, ...idle }).state.objectives).toEqual([
      { done: false, id: "kraid", ms: null, name: "Kraid" },
      { done: true, id: "phantoon", ms: null, name: "Phantoon" },
      { done: false, id: "botwoon", ms: null, name: "Botwoon" },
    ]);
  });

  it("has the run timer as data, and no go mode", () => {
    const run = { ...freshProgress(), ...idle };
    const { state } = overlayReadingOf(run);
    expect(state.game).toBe("sm");
    expect(state.goMode).toBeNull();
    expect(state.timer).toEqual({
      elapsedMs: 0,
      startedAt: null,
      state: "idle",
    });
    const running = { elapsedMs: 5_000, finished: false, startedAt: 1_000 };
    expect(overlayReadingOf({ ...run, timer: running }).state.timer).toEqual({
      elapsedMs: 5_000,
      startedAt: 1_000,
      state: "running",
    });
    expect(
      overlayReadingOf({
        ...run,
        timer: { elapsedMs: 9_000, finished: true, startedAt: null },
      }).state.timer?.state,
    ).toBe("finished");
  });

  it("reads nothing of the clock the timer is set on", () => {
    const { state } = overlayReadingOf({
      ...useSmStore.getState(),
      clockBase: 123_456,
      timerClock: "game",
    } as SmRun);
    expect(Object.keys(state.timer ?? {}).sort()).toEqual([
      "elapsedMs",
      "startedAt",
      "state",
    ]);
    expect(JSON.stringify(state)).not.toContain("123456");
  });

  it("is fresh until something is held or done, or the timer has begun", () => {
    const fresh = { ...freshProgress(), ...idle };
    expect(overlayReadingOf(fresh).fresh).toBe(true);
    const held = freshProgress();
    held.items.morph = 1;
    expect(overlayReadingOf({ ...held, ...idle }).fresh).toBe(false);
    expect(overlayReadingOf({ ...fresh, done: ["kraid"] }).fresh).toBe(false);
    expect(
      overlayReadingOf({
        ...fresh,
        timer: { elapsedMs: 0, finished: false, startedAt: 1 },
      }).fresh,
    ).toBe(false);
  });

  describe("the store", () => {
    beforeEach(() => {
      localStorage.clear();
      useSmStore.setState(useSmStore.getInitialState(), true);
    });

    it("reads the run the store holds, and tells of a change", () => {
      let changes = 0;
      const stop = overlaySource.subscribe(() => {
        changes++;
      });

      useSmStore.getState().step("morph", 1);

      expect(changes).toBeGreaterThan(0);
      expect(
        overlaySource.read().state.items.find((i) => i.id === "morph")?.level,
      ).toBe(1);
      stop();
    });
  });
});
