import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DOOR_OPTIONS,
  type DoorSetting,
  DOOR_LOCATION_IDS as DR_IDS,
} from "@/games/alttpr/data/doorRando";
import {
  bindRun,
  compareReview,
  type ReviewedRun,
} from "@/games/alttpr/review/adapter";
import {
  doorRunOf,
  doorSpoilerLog,
  playedRun,
  spoilerLog,
} from "@/games/alttpr/review/fixtures";
import { drain, hiddenReason, sweepRun } from "@/games/alttpr/review/sweep";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const T0 = Date.UTC(2026, 9, 25, 12, 0, 0);
const store = () => useGameStore.getState();
const run = (): ReviewedRun => store();

// Two real spoiler races' logs (packs/alttpr/test/dr-spoilers/)
const vanilla = doorSpoilerLog("660701088");
const drops = doorSpoilerLog("278438665");

/** The run a DR log's seed makes: its run type, settings and seed. */
const play = (log: typeof vanilla) => {
  const { presetId, seed, settings } = doorRunOf(log);
  useGameStore.setState({ presetId, seed, settings });
};

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("binding a Door Randomizer log", () => {
  it("verifies the log of a run whose ROM title names the seed", () => {
    play(vanilla);
    expect(store().seed).toBe("1_1_660701088");
    const binding = bindRun(vanilla, run());
    expect(binding).toMatchObject({ verdict: "verified" });
    expect(binding.verdict === "verified" && binding.facts).toBeGreaterThan(10);
  });

  it("refuses another seed's log, saying both seeds", () => {
    play(vanilla);
    useGameStore.setState({ seed: "1_1_278438665" });
    expect(bindRun(vanilla, run())).toMatchObject({
      refusal: {
        detail: "1_1_278438665 / 1_1_660701088",
        error: "seed-differs",
      },
      verdict: "refused",
    });
  });

  it("is not verified for a run that does not know its seed", () => {
    play(vanilla);
    useGameStore.setState({ seed: null });
    expect(bindRun(vanilla, run())).toMatchObject({ verdict: "not-verified" });
  });

  it("proves nothing from avianart's hash when the log does not state it", () => {
    play(vanilla);
    useGameStore.setState({ seed: "Ab3dEf9hIj" });
    expect(vanilla.extra.door?.avianart).toBeNull();
    expect(bindRun(vanilla, run())).toMatchObject({ verdict: "not-verified" });
  });

  it("compares the avianart hash of a run started from an avianart link", () => {
    const linked = {
      ...vanilla,
      extra: {
        ...vanilla.extra,
        door: { ...vanilla.extra.door, avianart: "Ab3dEf9hIj" },
      },
    } as typeof vanilla;
    play(vanilla);
    useGameStore.setState({ seed: "Ab3dEf9hIj" });
    expect(bindRun(linked, run())).toMatchObject({ verdict: "verified" });
    useGameStore.setState({ seed: "Zz3dEf9hIj" });
    expect(bindRun(linked, run())).toMatchObject({
      refusal: { error: "seed-differs" },
    });
  });

  it("refuses a DR log on an alttpr.com run of the same world", () => {
    play(vanilla);
    const settings = { ...store().settings };
    for (const key of Object.keys(DOOR_OPTIONS) as DoorSetting[]) {
      delete settings[key];
    }
    useGameStore.setState({ seed: null, settings });
    expect(bindRun(vanilla, run())).toMatchObject({
      refusal: {
        detail: "door:randomizer: alttpr.com's / the Door Randomizer's",
        error: "settings-differ",
      },
      verdict: "refused",
    });
  });

  it("refuses an alttpr.com log on a Door Randomizer run", () => {
    const other = spoilerLog("9MQ9gO1wMD");
    useGameStore.setState({
      presetId: "door-randomizer",
      seed: null,
      settings: { ...store().settings, randomizer: "dr" },
    });
    const binding = bindRun(other, run());
    expect(binding.verdict).toBe("refused");
  });

  it("refuses a log whose pottery the run does not shuffle", () => {
    play(drops);
    expect(bindRun(drops, run())).toMatchObject({ verdict: "verified" });
    useGameStore.setState({
      seed: null,
      settings: { ...store().settings, pottery: "none" },
    });
    expect(bindRun(drops, run())).toMatchObject({
      refusal: {
        detail: "door:pottery: off / on",
        error: "settings-differ",
      },
    });
  });
});

describe("comparing a Door Randomizer run", () => {
  const pot = "Thieves' Town - Hallway Pot Key";
  const potId = drops.placements.find((p) => p.locationName === pot)?.location;

  it("knows the pots and drops a run tracks, and dates none of them", () => {
    play(drops);
    expect(potId).toBeDefined();
    // A chest of the dungeon stamped: autotracking checks them one by one
    act(() => store().toggleChecks(["thieves-town/map-chest"]));
    const before = compareReview(drops, run());
    const row = before.rows.find((r) => r.entry.placement.location === potId);
    expect(row).toMatchObject({ state: "missed" });
    act(() => store().toggleChecks([potId ?? ""]));
    const after = compareReview(drops, run());
    expect(
      after.rows.find((r) => r.entry.placement.location === potId),
    ).toMatchObject({ ms: null, state: "untimed" });
    // The timeline never holds a DR place: the share link's width stays
    expect(Object.keys(store().timeline).join()).not.toContain("Pot");
  });

  it("calls unknown the places the run's settings leave out", () => {
    play(drops);
    act(() => store().toggleChecks(["thieves-town/map-chest"]));
    const tracked = compareReview(drops, run()).rows.find(
      (r) => r.entry.placement.location === potId,
    );
    expect(tracked?.state).toBe("missed");
    useGameStore.setState({
      settings: { ...store().settings, dropShuffle: "none", pottery: "none" },
    });
    const rows = compareReview(drops, run()).rows;
    const dropsRows = rows.filter((r) => r.entry.placement.location === potId);
    expect(dropsRows.map((r) => r.state)).toEqual(["unknown"]);
  });

  it("says a DR log's waits are not shown once nothing else explains it", () => {
    play(drops);
    // The log wants every dungeon item wild, the first thing said
    expect(hiddenReason(drops, run(), compareReview(drops, run()))).toBe(
      "keysanity",
    );
    useGameStore.setState({
      settings: { ...store().settings, dungeonItems: "standard" },
    });
    expect(hiddenReason(drops, run(), compareReview(drops, run()))).toBe(
      "door-logic",
    );
    // Doors shuffled: the run does not time where each led
    useGameStore.setState({
      settings: { ...store().settings, doorShuffle: "basic" },
    });
    expect(hiddenReason(drops, run(), compareReview(drops, run()))).toBe(
      "doors",
    );
    // An OWR seed's whirlpools or flute spots shuffled: the sweep has no
    // time for where each led (it would read them vanilla)
    for (const change of [
      { owWhirlpool: true },
      { owFluteShuffle: "random" },
      { owCrossed: "grouped" },
    ] as const) {
      useGameStore.setState({
        settings: {
          ...store().settings,
          doorShuffle: "vanilla",
          owFluteShuffle: "vanilla",
          owWhirlpool: false,
          randomizer: "owr",
          ...change,
        },
      });
      expect(
        hiddenReason(drops, run(), compareReview(drops, run())),
        JSON.stringify(change),
      ).toBe("overworld");
    }
  });
});

describe("the waits of a run in DR's own world", () => {
  // DR 1.5.7-u, Open, every dungeon item in its dungeon, nothing of DR's
  // places shuffled: solved in DR's world, its waits shown
  const inDungeon = doorSpoilerLog("239088210");
  const plan = inDungeon.placements
    .filter((p) => p.sphere !== null)
    .sort(
      (a, b) =>
        (a.sphere ?? 0) - (b.sphere ?? 0) ||
        a.locationName.localeCompare(b.locationName),
    )
    .map((p, index) => ({ location: p.location, minute: 2 * (index + 1) }));

  it("is swept through DR's rules once its solver is handed in", async () => {
    play(inDungeon);
    // Agahnim's defeat is an event of the log's, no placement the plan
    // takes: held from the start, as the board's cell would say
    useGameStore.setState({ items: { ...store().items, agahnim: 1 } });
    const played = playedRun(inDungeon, plan, run());
    const comparison = compareReview(inDungeon, played);
    expect(hiddenReason(inDungeon, played, comparison)).toBeNull();
    const { solver } = await import("@/games/alttpr/logic/drSolver");
    const endMs = (plan.length + 3) * 120_000;
    const sweep = drain(sweepRun(inDungeon, played, comparison, endMs, solver));
    expect(sweep.waits.length).toBeGreaterThan(0);
    // Taken in the playthrough's order: each needed item in DR's logic by
    // the time it was taken (the pack's playthrough contract, replayed)
    const late = sweep.waits.filter(
      (wait) => wait.reach === null || (wait.waited ?? -1) < 0,
    );
    expect(late.map((wait) => wait.location)).toEqual([]);
  });

  it("sweeps a seed with its own key holding, never keysanity's", async () => {
    // Strict key logic reads its own rule only with wild keys (Rules.py:
    // 2345-2347): this seed's keys stay in their dungeons, so its doors ask
    // partial's number, and a strict run of it waits as a partial one
    const { solver } = await import("@/games/alttpr/logic/drSolver");
    const endMs = (plan.length + 3) * 120_000;
    const waitsOf = (keyLogic: "partial" | "strict") => {
      play(inDungeon);
      useGameStore.setState({
        items: { ...store().items, agahnim: 1 },
        settings: { ...store().settings, keyLogic },
      });
      const played = playedRun(inDungeon, plan, run());
      const comparison = compareReview(inDungeon, played);
      expect(hiddenReason(inDungeon, played, comparison)).toBeNull();
      return drain(sweepRun(inDungeon, played, comparison, endMs, solver))
        .waits;
    };
    const partial = waitsOf("partial");
    expect(partial.length).toBeGreaterThan(0);
    expect(waitsOf("strict")).toEqual(partial);
  });

  it("hides them where an item it needed lay at one of DR's places", () => {
    play(drops);
    useGameStore.setState({
      settings: { ...store().settings, dungeonItems: "standard" },
    });
    const comparison = compareReview(drops, run());
    expect(
      comparison.rows.some(
        ({ entry }) =>
          entry.placement.sphere !== null &&
          DR_IDS.has(entry.placement.location),
      ),
    ).toBe(true);
    expect(hiddenReason(drops, run(), comparison)).toBe("door-logic");
  });
});
