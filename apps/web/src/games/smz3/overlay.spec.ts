import { beforeEach, describe, expect, it } from "vitest";
import { OVERLAY_ITEMS } from "@/games/alttpr/overlay";
import { overlayReadingOf, overlaySource } from "@/games/smz3/overlay";
import { freshProgress, useSmz3Store } from "@/games/smz3/store";
import { IDLE_TIMER } from "@/utils/runTimer";

/** A fresh run with its timer, as the reading takes it. */
const fresh = () => ({ ...freshProgress(), timer: IDLE_TIMER });

/** Pinned: what SMZ3's items may say is a decision, not a side effect. */
const ZELDA_IDS = [
  "sword",
  "shield",
  "glove",
  "bow",
  "hookshot",
  "mushroom",
  "powder",
  "firerod",
  "icerod",
  "bombos",
  "ether",
  "quake",
  "lamp",
  "hammer",
  "shovel",
  "flute",
  "book",
  "bottle",
  "somaria",
  "byrna",
  "cape",
  "mirror",
  "boots",
  "flippers",
  "moonPearl",
  "halfMagic",
];
const SM_IDS = [
  "charge",
  "ice",
  "wave",
  "plasma",
  "varia",
  "gravity",
  "grapple",
  "morph",
  "bombs",
  "springBall",
  "screwAttack",
  "hiJump",
  "spaceJump",
  "speedBooster",
  "missile",
  "super",
  "powerBomb",
  "eTank",
  "reserveTank",
];

describe("SMZ3's overlay reading", () => {
  it("names exactly the items the API may show: Hyrule's, then Zebes's", () => {
    const { state } = overlayReadingOf(fresh());
    expect(state.items.map(({ id }) => id)).toEqual([...ZELDA_IDS, ...SM_IDS]);
    // The boss tokens are rewards, found when picked up and no boss beaten:
    // not sent, and no other objective is recorded for this game
    expect(state.objectives).toEqual([]);
  });

  it("shares its Zelda ids with A Link to the Past's wherever the item is shared", () => {
    const smz3 = new Set(ZELDA_IDS);
    const shared = OVERLAY_ITEMS.map(([id]) => id).filter((id) => smz3.has(id));
    // Everything but the boomerang, the net and the tunic is the same item
    expect(shared).toHaveLength(OVERLAY_ITEMS.length - 3);
  });

  it("reads each item's level with the pool's range", () => {
    const run = fresh();
    run.items.sword = 3;
    run.items.missile = 5;
    const { state } = overlayReadingOf(run);
    const item = (id: string) => state.items.find((i) => i.id === id);

    expect(item("sword")).toEqual({
      id: "sword",
      level: 3,
      max: 4,
      name: "Sword",
    });
    expect(item("missile")?.level).toBe(5);
    expect(item("missile")?.max).toBeGreaterThan(5);
    expect(item("hookshot")).toMatchObject({ level: 0, max: 1 });
  });

  it("never reads the boss tokens, which a boss's reward is", () => {
    const run = fresh();
    run.items.tokenDraygon = 1;
    const { fresh: untouched, state } = overlayReadingOf(run);
    expect(state.objectives).toEqual([]);
    expect(JSON.stringify(state)).not.toMatch(/token/i);
    expect(untouched).toBe(true);
  });

  it("has the run timer as data and no go mode, and is fresh until something is held or timed", () => {
    const run = fresh();
    const reading = overlayReadingOf(run);
    expect(reading.state.game).toBe("smz3");
    expect(reading.state.goMode).toBeNull();
    expect(reading.state.timer).toEqual({
      elapsedMs: 0,
      startedAt: null,
      state: "idle",
    });
    expect(reading.fresh).toBe(true);
    const held = fresh();
    held.items.hookshot = 1;
    expect(overlayReadingOf(held).fresh).toBe(false);
    // The timer as the page shows it, whichever clock set it
    const running = {
      ...run,
      timer: { elapsedMs: 5_000, finished: false, startedAt: 1_000 },
    };
    expect(overlayReadingOf(running)).toMatchObject({
      fresh: false,
      state: {
        timer: { elapsedMs: 5_000, startedAt: 1_000, state: "running" },
      },
    });
    expect(
      overlayReadingOf({
        ...run,
        timer: { elapsedMs: 9_000, finished: true, startedAt: null },
      }).state.timer?.state,
    ).toBe("finished");
  });

  describe("the store", () => {
    beforeEach(() => {
      localStorage.clear();
      useSmz3Store.setState(useSmz3Store.getInitialState(), true);
    });

    it("reads the run the store holds, and tells of a change", () => {
      let changes = 0;
      const stop = overlaySource.subscribe(() => {
        changes++;
      });

      useSmz3Store.getState().step("hookshot", 1);

      expect(changes).toBeGreaterThan(0);
      expect(
        overlaySource.read().state.items.find((i) => i.id === "hookshot")
          ?.level,
      ).toBe(1);
      stop();
    });
  });
});
