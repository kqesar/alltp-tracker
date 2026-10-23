import { beforeEach, describe, expect, it } from "vitest";
import { overlayReadingOf, overlaySource } from "@/games/sm/overlay";
import { freshProgress, useSmStore } from "@/games/sm/store";

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
      const { state } = overlayReadingOf({ ...freshProgress(), ...options });
      expect(state.items.map(({ id }) => id)).toEqual(ITEM_IDS);
    }
  });

  it("reads the counts with the pool's range", () => {
    const run = freshProgress();
    run.items.missile = 12;
    run.items.charge = 1;
    const { state } = overlayReadingOf(run);

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
    expect(overlayReadingOf(run).state.objectives).toEqual([
      { done: false, id: "kraid", ms: null, name: "Kraid" },
      { done: true, id: "phantoon", ms: null, name: "Phantoon" },
      { done: false, id: "botwoon", ms: null, name: "Botwoon" },
    ]);
  });

  it("has no timer nor go mode", () => {
    const { state } = overlayReadingOf(freshProgress());
    expect(state.game).toBe("sm");
    expect(state.timer).toBeNull();
    expect(state.goMode).toBeNull();
  });

  it("is fresh until something is held or done", () => {
    expect(overlayReadingOf(freshProgress()).fresh).toBe(true);
    const held = freshProgress();
    held.items.morph = 1;
    expect(overlayReadingOf(held).fresh).toBe(false);
    expect(
      overlayReadingOf({ ...freshProgress(), done: ["kraid"] }).fresh,
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
