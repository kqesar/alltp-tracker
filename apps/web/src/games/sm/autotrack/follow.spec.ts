import { beforeEach, describe, expect, it } from "vitest";
import { createSmFollower } from "@/games/sm/autotrack/follow";
import { readSm } from "@/games/sm/autotrack/reading";
import { useSmStore } from "@/games/sm/store";
import {
  type MapRandoGame,
  viewOf,
  writeMapRando,
} from "../../../../../../packs/sm/test/sm-rom";

const run = () => useSmStore.getState();

/** What the tracker reads of a Map Rando game. */
const reading = (game: MapRandoGame = {}) =>
  readSm(viewOf(writeMapRando(new Uint8Array(0x100_0000), game)), 0);

const MORPH = 0x0004;
const BOMBS = 0x1000;
const WAVE = 0x0001;

beforeEach(() => {
  localStorage.clear();
  useSmStore.setState(useSmStore.getInitialState(), true);
});

describe("the Super Metroid run following the game", () => {
  it("lays the game's items, objectives and settings, as no undo step", () => {
    run().step("varia", 1);
    const follower = createSmFollower();

    follower.read(
      reading({
        beams: WAVE,
        done: ["kraid"],
        items: MORPH | BOMBS,
        maxEnergy: 299,
        maxMissiles: 15,
        objectives: ["kraid", "botwoon"],
      }),
    );

    expect(run().items).toMatchObject({
      bombs: 1,
      energyTank: 2,
      missile: 3,
      morph: 1,
      varia: 1,
      wave: 1,
    });
    expect(run().objectives).toEqual(["kraid", "botwoon"]);
    expect(run().done).toEqual(["kraid"]);
    // Undoing the player's change leaves the game's
    run().undo();
    expect(run().items).toMatchObject({ morph: 1, varia: 0 });
    expect(run().future).toHaveLength(1);
  });

  it("follows the seed's Wall Jump Boots and split Speed Booster", () => {
    const follower = createSmFollower();
    follower.read(reading({ wallJump: true }));
    expect(run()).toMatchObject({ splitSpeed: false, wallJump: true });

    follower.read(reading({ splitSpeed: true, wallJump: true }));
    expect(run()).toMatchObject({ splitSpeed: true, wallJump: true });

    // The player's own setting stands while the seed's does not change
    run().setOption("wallJump", false);
    follower.read(reading({ splitSpeed: true, wallJump: true }));
    expect(run().wallJump).toBe(false);
  });

  it("lays nothing while no game is in play", () => {
    const follower = createSmFollower();

    // The title screen ($0998 = $01) still holds the last file's items
    follower.read(reading({ items: MORPH, state: 0x01 }));

    expect(run()).toMatchObject({ items: useSmStore.getInitialState().items });
  });

  it("lays news only: a mark the player changed stays until the game moves", () => {
    const follower = createSmFollower();
    follower.read(reading({ items: MORPH, maxMissiles: 10 }));
    expect(run().items).toMatchObject({ missile: 2, morph: 1 });

    // The player takes the Morph Ball back and marks a third missile pack
    run().step("morph", -1);
    run().step("missile", 1);
    follower.read(reading({ items: MORPH, maxMissiles: 10 }));
    expect(run().items).toMatchObject({ missile: 3, morph: 0 });

    // The game finds another pack: the player's count stands, higher
    follower.read(reading({ items: MORPH, maxMissiles: 15 }));
    expect(run().items).toMatchObject({ missile: 3, morph: 0 });
    follower.read(reading({ items: MORPH, maxMissiles: 20 }));
    expect(run().items.missile).toBe(4);
  });

  it("keeps an objective the player marked done, and drops one the seed lacks", () => {
    run().setObjectives(["kraid", "ridley", "phantoon"]);
    run().toggleDone("ridley");
    run().toggleDone("phantoon");
    const follower = createSmFollower();

    follower.read(
      reading({ done: ["kraid"], objectives: ["kraid", "ridley", "draygon"] }),
    );

    expect(run().objectives).toEqual(["kraid", "ridley", "draygon"]);
    expect([...run().done].sort()).toEqual(["kraid", "ridley"]);
  });

  it("writes nothing for a reading with no news", () => {
    const follower = createSmFollower();
    follower.read(reading({ items: MORPH }));
    const before = run();

    follower.read(reading({ items: MORPH }));

    expect(run()).toBe(before);
  });
});
