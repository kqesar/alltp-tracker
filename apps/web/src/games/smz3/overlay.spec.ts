import { beforeEach, describe, expect, it } from "vitest";
import { OVERLAY_ITEMS } from "@/games/alttpr/overlay";
import { overlayReadingOf, overlaySource } from "@/games/smz3/overlay";
import { freshProgress, useSmz3Store } from "@/games/smz3/store";

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
    const { state } = overlayReadingOf(freshProgress());
    expect(state.items.map(({ id }) => id)).toEqual([...ZELDA_IDS, ...SM_IDS]);
    expect(state.objectives.map(({ id }) => id)).toEqual([
      "tokenKraid",
      "tokenPhantoon",
      "tokenDraygon",
      "tokenRidley",
    ]);
  });

  it("shares its Zelda ids with A Link to the Past's wherever the item is shared", () => {
    const smz3 = new Set(ZELDA_IDS);
    const shared = OVERLAY_ITEMS.map(([id]) => id).filter((id) => smz3.has(id));
    // Everything but the boomerang, the net and the tunic is the same item
    expect(shared).toHaveLength(OVERLAY_ITEMS.length - 3);
  });

  it("reads each item's level with the pool's range", () => {
    const run = freshProgress();
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

  it("reads the boss tokens as objectives, named by their boss", () => {
    const run = freshProgress();
    run.items.tokenDraygon = 1;
    expect(overlayReadingOf(run).state.objectives).toEqual([
      { done: false, id: "tokenKraid", ms: null, name: "Kraid" },
      { done: false, id: "tokenPhantoon", ms: null, name: "Phantoon" },
      { done: true, id: "tokenDraygon", ms: null, name: "Draygon" },
      { done: false, id: "tokenRidley", ms: null, name: "Ridley" },
    ]);
  });

  it("has no timer nor go mode, and is fresh until something is held", () => {
    const { fresh, state } = overlayReadingOf(freshProgress());
    expect(state.game).toBe("smz3");
    expect(state.timer).toBeNull();
    expect(state.goMode).toBeNull();
    expect(fresh).toBe(true);
    const held = freshProgress();
    held.items.tokenKraid = 1;
    expect(overlayReadingOf(held).fresh).toBe(false);
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
