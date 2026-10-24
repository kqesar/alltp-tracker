import { parseUserAgent } from "@alltp/autotrack";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeVisibility, GRANTED, ManualClock } from "@/autotrack/fixtures";
import { smz3Autotrack } from "@/games/smz3/autotrack/store";
import { useSmz3Store } from "@/games/smz3/store";
import { MemoryTransport } from "../../../../../../packages/autotrack/test/memory-transport";
import {
  type Smz3Game,
  writeSmz3,
} from "../../../../../../packs/smz3/test/smz3-rom";

const state = () => smz3Autotrack.useStore.getState();
const run = () => useSmz3Store.getState();

/** A console playing an SMZ3 seed, behind an in-memory bridge. */
const harness = (game: Smz3Game = {}) => {
  const memory = writeSmz3(new Uint8Array(0x100_0000), game);
  const clock = new ManualClock();
  smz3Autotrack.setOptions({
    clock,
    permission: GRANTED,
    random: () => 0,
    transport: () => new MemoryTransport(memory),
    visibility: new FakeVisibility(),
  });
  return {
    advance: (ms: number) => clock.advance(ms),
    memory,
    /** The game moves on: memory now holds `next`. */
    play: (next: Smz3Game) => writeSmz3(memory, { ...game, ...next }),
  };
};

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  useSmz3Store.setState(useSmz3Store.getInitialState(), true);
  smz3Autotrack.useStore.setState(
    smz3Autotrack.useStore.getInitialState(),
    true,
  );
  smz3Autotrack.useStore.setState({
    environment: parseUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
    ),
  });
});

afterEach(() => {
  smz3Autotrack.stop();
  smz3Autotrack.setOptions({});
});

/** The moon pearl, Link's House's chest, a Super Metroid missile pack. */
const PLAYED: Smz3Game = {
  sm: { 38: 5 },
  zelda: { 520: 0x10, 855: 1 },
};

describe("SMZ3's autotracking", () => {
  it("follows both games through a portal, and the seed's settings", async () => {
    const h = harness({
      ...PLAYED,
      keysanity: true,
      mire: "bombos",
      smLogic: "hard",
      towerCrystals: 6,
    });
    await smz3Autotrack.connect();
    // The first ticks: the mode, then Zelda's homes
    await h.advance(0);
    await h.advance(1000);

    expect(state().status.code).toBe("connected");
    expect(state().reading?.mode).toBe("zelda");
    expect(run().items).toMatchObject({ missile: 1, moonPearl: 1 });
    expect(run().checked).toEqual(["links-house"]);
    expect(run().settings).toMatchObject({
      keysanity: true,
      smLogic: "hard",
      towerCrystals: 6,
    });
    expect(run().pads.mire).toBe("bombos");
    // The game's news is no step of the player's history
    expect(run().past).toEqual([]);

    // Through a portal: Super Metroid runs, Morph found there, and a
    // Zelda item found in Zebes sits in its buffer
    h.play({
      mode: "sm",
      sm: { ...PLAYED.sm, 2: 0x04, 179: 0x04 },
      zelda: { ...PLAYED.zelda, 837: 1 },
    });
    await h.advance(1000);
    await h.advance(1000);

    expect(state().reading?.mode).toBe("sm");
    expect(run().items).toMatchObject({ firerod: 1, moonPearl: 1, morph: 1 });
    expect(run().checked).toEqual(["links-house", "morphing-ball"]);
  });

  it("keeps a race seed's requirements and medallions unread, and the player's marks", async () => {
    const h = harness({
      ...PLAYED,
      mire: "quake",
      race: true,
      towerCrystals: 3,
    });
    useSmz3Store.getState().step("missile", 1);
    useSmz3Store.getState().step("missile", 1);
    await smz3Autotrack.connect();
    await h.advance(0);
    await h.advance(1000);

    expect(state().reading?.race).toBe(true);
    expect(state().reading?.requirements).toBe("race-mode");
    expect(run().settings.towerCrystals).toBe(7);
    expect(run().pads.mire).toBe("unknown");
    expect(run().items).toMatchObject({ missile: 2, moonPearl: 1 });
  });

  it("holds Race Mode always on when the player sets it, whatever the seed", async () => {
    const h = harness({ ...PLAYED, mire: "quake", towerCrystals: 3 });
    smz3Autotrack.setRaceChoice("on");
    await smz3Autotrack.connect();
    await h.advance(0);
    await h.advance(1000);

    const { status } = state();
    expect(status.code === "connected" && status.race).toMatchObject({
      active: true,
      flag: "open",
      setting: "on",
    });
    expect(state().reading?.race).toBe(true);
    expect(state().reading?.requirements).toBe("race-mode");
    expect(run().settings.towerCrystals).toBe(7);
    expect(run().pads.mire).toBe("unknown");
    // Saved with the wish to connect on start
    expect(
      JSON.parse(localStorage.getItem("alltp-tracker-smz3-autotrack") ?? "{}")
        .state,
    ).toEqual({ connectOnStart: true, raceChoice: "on" });

    // Back to the ROM's flag, the session running: it reads them at once
    smz3Autotrack.setRaceChoice("auto");
    for (let tick = 0; tick < 12; tick++) await h.advance(1000);
    expect(state().reading?.race).toBe(false);
    expect(run().settings.towerCrystals).toBe(3);
  });

  it("reads a Race Mode saved by another version as the ROM's flag", async () => {
    localStorage.setItem(
      "alltp-tracker-smz3-autotrack",
      JSON.stringify({ state: { raceChoice: "off" }, version: 0 }),
    );
    await smz3Autotrack.useStore.persist.rehydrate();
    expect(state().raceChoice).toBe("auto");
    localStorage.setItem(
      "alltp-tracker-smz3-autotrack",
      JSON.stringify({ state: { raceChoice: "on" }, version: 0 }),
    );
    await smz3Autotrack.useStore.persist.rehydrate();
    expect(state().raceChoice).toBe("on");
  });

  it("lays nothing while the running game is not in play", async () => {
    const h = harness({ ...PLAYED, inPlay: false });
    await smz3Autotrack.connect();
    await h.advance(0);
    await h.advance(1000);

    expect(state().reading?.inPlay).toBe(false);
    expect(run().items.moonPearl).toBe(0);
  });

  it("refuses a ROM that is not an SMZ3 seed", async () => {
    const h = harness(PLAYED);
    h.memory.set(new TextEncoder().encode("ALTTP+SM RANDOMIZER  "), 0xffc0);
    await smz3Autotrack.connect();
    await h.advance(0);

    expect(state().status.code).toBe("game-mismatch");
    expect(run().items.moonPearl).toBe(0);
  });
});
