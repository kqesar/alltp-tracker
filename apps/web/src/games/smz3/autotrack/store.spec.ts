import { parseUserAgent } from "@alltp/autotrack";
import { smz3Ms } from "@alltp/pack-smz3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeVisibility, GRANTED, ManualClock } from "@/autotrack/fixtures";
import { smz3Autotrack } from "@/games/smz3/autotrack/store";
import { useSmz3Store } from "@/games/smz3/store";
import { MemoryTransport } from "../../../../../../packages/autotrack/test/memory-transport";
import { MEMORY_RANGE } from "../../../../../../packs/smz3/src/autotrack/memory";
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
  const transports: MemoryTransport[] = [];
  /** Runs before each request is served: a console that moves in a tick. */
  const hooks: { before: ((pieces: [number, number][]) => void) | null } = {
    before: null,
  };
  smz3Autotrack.setOptions({
    clock,
    permission: GRANTED,
    random: () => 0,
    transport: () => {
      const transport = new MemoryTransport(memory);
      const read = transport.read.bind(transport);
      transport.read = (request, into, offset) => {
        const pieces: [number, number][] = [];
        for (let i = 0; i < request.pieces.length; i += 2) {
          pieces.push([request.pieces[i], request.pieces[i + 1]]);
        }
        hooks.before?.(pieces);
        return read(request, into, offset);
      };
      transports.push(transport);
      return transport;
    },
    visibility: new FakeVisibility(),
  });
  return {
    advance: (ms: number) => clock.advance(ms),
    hooks,
    memory,
    /** The game moves on: memory now holds `next`. */
    play: (next: Smz3Game) => writeSmz3(memory, { ...game, ...next }),
    transports,
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

  it("keeps the ROM's flag by default, a save from before included", async () => {
    // SMZ3's ROMs carry a race flag: only Super Metroid's default moved
    localStorage.setItem(
      "alltp-tracker-smz3-autotrack",
      JSON.stringify({ state: { raceChoice: "auto" }, version: 0 }),
    );
    await smz3Autotrack.useStore.persist.rehydrate();
    expect(state().raceChoice).toBe("auto");
    expect(smz3Autotrack.useStore.getInitialState().raceChoice).toBe("auto");
    expect(smz3Autotrack.raceFlag).toBe(true);
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

describe("SMZ3's autotracking and the run timer", () => {
  const SM_FILE_SELECT = 0x04;
  const SM_PLAY = 0x08;
  const ZELDA_PLAY = 0x09;

  /** The pieces asked of the consoles that touch one of the game-time ranges. */
  const readOf = (
    transports: MemoryTransport[],
    ids: readonly (keyof typeof MEMORY_RANGE)[],
  ) =>
    transports
      .flatMap((transport) => transport.pieces)
      .filter(([address, size]) =>
        ids.some((id) => {
          const range = MEMORY_RANGE[id];
          return (
            range.address < address + size &&
            address < range.address + range.size
          );
        }),
      );

  it("starts at the first reading in play, follows the games' time and stops at the credits", async () => {
    run().setTimerClock("game");
    const h = harness({
      clock: { sm: 5_000, zelda: 1_000 },
      mode: "sm",
      state: SM_FILE_SELECT,
    });
    await smz3Autotrack.connect();
    await h.advance(0);
    await h.advance(1000);
    expect(run().timer.startedAt).toBeNull();
    expect(state().reading?.clock).toEqual({ final: false, frames: 6_000 });

    // The file loads: Super Metroid in play, a hundred frames later
    h.play({ clock: { sm: 5_100, zelda: 1_000 }, mode: "sm", state: SM_PLAY });
    await h.advance(1000);
    expect(run().timer.startedAt).not.toBeNull();
    expect(run().timer.elapsedMs).toBe(smz3Ms(6_100));

    // A portal to Zelda, which runs 12 000 frames (200 s) in a real second
    h.play({
      clock: { sm: 5_100, zelda: 13_000 },
      mode: "zelda",
      state: ZELDA_PLAY,
    });
    await h.advance(1000);
    await h.advance(1000);
    expect(state().reading?.mode).toBe("zelda");
    expect(run().timer.elapsedMs).toBe(smz3Ms(18_100));

    // The credits: both counters saved, the final time
    h.play({ clock: { sm: 60_000, zelda: 40_000 }, mode: "credits" });
    await h.advance(1000);
    await h.advance(1000);
    expect(run().timer).toEqual({
      elapsedMs: smz3Ms(100_000),
      finished: true,
      startedAt: null,
    });
  });

  it("stops the timer on the game's time while the emulator is paused, and goes on when it runs", async () => {
    run().setTimerClock("game");
    const h = harness({
      clock: { sm: 0, zelda: 1_000 },
      state: 0x01,
    });
    await smz3Autotrack.connect();
    await h.advance(0);
    await h.advance(1000);
    h.play({ clock: { sm: 0, zelda: 1_200 }, state: ZELDA_PLAY });
    await h.advance(1000);
    h.play({ clock: { sm: 0, zelda: 13_200 }, state: ZELDA_PLAY });
    await h.advance(1000);
    expect(run().timer.startedAt).not.toBeNull();

    // A paused emulator serves the same bytes: no reading, only steady polls
    await h.advance(3000);
    expect(run().timer).toEqual({
      elapsedMs: smz3Ms(13_200),
      finished: false,
      startedAt: null,
    });

    h.play({ clock: { sm: 0, zelda: 14_200 }, state: ZELDA_PLAY });
    await h.advance(1000);
    expect(run().timer.startedAt).not.toBeNull();
    expect(run().timer.elapsedMs).toBe(smz3Ms(14_200));
  });

  it("goes back with the game when a death sets the counters to the last save", async () => {
    run().setTimerClock("game");
    run().startTimer();
    const h = harness({ clock: { sm: 0, zelda: 30_000 }, state: ZELDA_PLAY });
    await smz3Autotrack.connect();
    await h.advance(0);
    await h.advance(1000);
    expect(run().timer.elapsedMs).toBe(smz3Ms(30_000));

    h.play({ clock: { sm: 0, zelda: 21_000 }, state: ZELDA_PLAY });
    await h.advance(1000);
    expect(run().timer.elapsedMs).toBe(smz3Ms(21_000));
  });

  it("reads the game time outside Race Mode, with the game", async () => {
    const h = harness();
    await smz3Autotrack.connect();
    await h.advance(0);
    await h.advance(1000);
    expect(
      readOf(h.transports, ["clock-sm-saved", "clock-zelda-live"]),
    ).not.toHaveLength(0);
  });

  it("reads none of Super Metroid's counter in Race Mode, yet starts and stops the timer", async () => {
    smz3Autotrack.setRaceChoice("on");
    run().setTimerClock("game");
    const h = harness({
      clock: { sm: 5_000, zelda: 1_000 },
      mode: "sm",
      state: SM_FILE_SELECT,
    });
    await smz3Autotrack.connect();
    await h.advance(0);
    await h.advance(1000);
    h.play({ clock: { sm: 5_100, zelda: 1_000 }, mode: "sm", state: SM_PLAY });
    await h.advance(1000);
    expect(run().timer.startedAt).not.toBeNull();
    expect(state().reading?.clock).toBe("race-mode");
    h.play({ clock: { sm: 9_000, zelda: 1_000 }, mode: "credits" });
    await h.advance(1000);
    await h.advance(1000);

    expect(run().timer.finished).toBe(true);
    // Nothing of Super Metroid's counter was asked of the console
    expect(readOf(h.transports, ["clock-sm-live", "clock-sm-saved"])).toEqual(
      [],
    );
  });

  it("does not take a counter read across a portal for a time", async () => {
    run().setTimerClock("game");
    run().startTimer();
    const h = harness({
      clock: { sm: 6_000, zelda: 1_500 },
      mode: "sm",
      state: SM_PLAY,
    });
    await smz3Autotrack.connect();
    await h.advance(0);
    await h.advance(1000);
    expect(run().timer.elapsedMs).toBe(smz3Ms(7_500));

    // The portal fires after the tick read the mode and before it reads Super
    // Metroid's counter: WRAM holds Zelda's memory there, 0x7fff0000 as it
    // reads. Super Metroid saved its 6 600 before the switch
    h.hooks.before = (pieces) => {
      const live = MEMORY_RANGE["clock-sm-live"];
      if (!pieces.some(([address]) => address === live.address)) return;
      h.hooks.before = null;
      writeSmz3(h.memory, {
        clock: { sm: 6_600, zelda: 1_500 },
        mode: "zelda",
        state: ZELDA_PLAY,
      });
      h.memory.set([0x00, 0x00, 0xff, 0x7f], live.address);
    };
    await h.advance(1000);
    // That tick is a switch: no time from it
    expect(state().reading?.mode).toBe("zelda");
    expect(state().reading?.clock).toBe("not-read");
    expect(run().timer.elapsedMs).toBe(smz3Ms(7_500));

    // The next reads Zelda's memory: its live counter and Super Metroid's save
    await h.advance(1000);
    expect(state().reading?.clock).toEqual({ final: false, frames: 8_100 });
    expect(run().timer.elapsedMs).toBe(smz3Ms(8_100));
  });
});
