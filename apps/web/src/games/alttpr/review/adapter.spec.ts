import { MAP_LOCATIONS } from "@alltp/pack-alttpr";
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runZones } from "@/games/alttpr/logic/checks";
import {
  bindRun,
  compareReview,
  type ReviewedRun,
  reviewFinds,
} from "@/games/alttpr/review/adapter";
import { spoilerLog } from "@/games/alttpr/review/fixtures";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const T0 = Date.UTC(2026, 9, 25, 12, 0, 0);
const store = () => useGameStore.getState();
const log = spoilerLog("9MQ9gO1wMD");

/** The run as the adapter reads it. */
const run = (): ReviewedRun => store();

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
});

afterEach(() => {
  vi.useRealTimers();
});

/** Required placements on a location outside any dungeon, by sphere. */
const outdoors = () => {
  const dungeons = new Set(
    runZones(store())
      .filter((zone) => zone.dungeon !== undefined)
      .flatMap((zone) => zone.checks.map((check) => check.id)),
  );
  return log.placements
    .filter(
      (p) =>
        p.sphere !== null &&
        p.item !== null &&
        MAP_LOCATIONS.has(p.location) &&
        !dungeons.has(p.location),
    )
    .sort((a, b) => (a.sphere ?? 0) - (b.sphere ?? 0));
};

/** Check a location `seconds` into the run. */
const checkAt = (seconds: number, location: string) => {
  vi.setSystemTime(T0 + seconds * 1000);
  act(() => store().toggleChecks([location]));
};

describe("bindRun", () => {
  it("verifies a log whose seed is the run's, with the settings agreeing", () => {
    useGameStore.setState({ seed: "9MQ9gO1wMD" });
    const binding = bindRun(log, run());
    expect(binding).toMatchObject({ verdict: "verified" });
    expect(binding.verdict === "verified" && binding.facts).toBeGreaterThan(5);
  });

  it("is not verified for a run that does not know its seed", () => {
    expect(bindRun(log, run())).toMatchObject({ verdict: "not-verified" });
  });

  it("is not verified for a log that names no seed", () => {
    const unnamed = { ...log, seed: { from: null, id: null } };
    useGameStore.setState({ seed: "9MQ9gO1wMD" });
    expect(bindRun(unnamed, run())).toMatchObject({ verdict: "not-verified" });
  });

  it("refuses another seed's log, saying both", () => {
    useGameStore.setState({ seed: "eM43RgZ4Gj" });
    expect(bindRun(log, run())).toEqual({
      refusal: {
        detail: "eM43RgZ4Gj / 9MQ9gO1wMD",
        error: "seed-differs",
        ok: false,
      },
      verdict: "refused",
    });
  });

  it("refuses a log whose settings the run contradicts, with no seed to tell", () => {
    useGameStore.setState({
      settings: { ...store().settings, crystalsGanon: 3 },
    });
    expect(bindRun(log, run())).toMatchObject({
      refusal: { error: "settings-differ" },
      verdict: "refused",
    });
  });

  it("refuses a medallion the board holds otherwise", () => {
    const { mire } = log.extra.medallions;
    const other = mire === "bombos" ? 2 : 1;
    const medallions = [...store().medallions];
    medallions[8] = other;
    useGameStore.setState({ medallions });
    const binding = bindRun(log, run());
    expect(binding).toMatchObject({
      refusal: { error: "settings-differ" },
      verdict: "refused",
    });
    expect(binding.verdict === "refused" && binding.refusal.detail).toMatch(
      /^medallion:mire:/,
    );
  });

  it("accepts the medallion the board holds", () => {
    const medallions = [...store().medallions];
    medallions[8] =
      ["bombos", "ether", "quake"].indexOf(log.extra.medallions.mire ?? "") + 1;
    useGameStore.setState({ medallions });
    expect(bindRun(log, run()).verdict).not.toBe("refused");
  });
});

describe("reviewFinds", () => {
  it("makes one find of a check and the item it gave, in one instant", () => {
    const [first] = outdoors();
    if (!first) throw new Error("no outdoor placement");
    // Autotracking lays a reading's news at one instant
    vi.setSystemTime(T0 + 5000);
    act(() => {
      store().applyGameNews((current) => ({
        checked: { ...current.checked, [first.location]: true },
      }));
    });
    const finds = reviewFinds(run(), log);
    expect(finds.filter((f) => f.location === first.location)).toHaveLength(1);
    expect(finds.filter((f) => f.item === first.item)).toHaveLength(0);
  });
});

describe("compareReview", () => {
  it("tells in order, late and missed apart", () => {
    const places = outdoors();
    const early = places.find((p) => p.sphere === places[0]?.sphere);
    const later = places.find((p) => (p.sphere ?? 0) > (early?.sphere ?? 0));
    const never = places.find((p) => p !== early && p !== later);
    if (!early || !later || !never) throw new Error("fixture too small");
    act(() => store().startTimer());
    // The later sphere's place first, then the earlier one
    checkAt(10, later.location);
    checkAt(20, early.location);
    const { rows, summary } = compareReview(log, run());
    const row = (location: string) =>
      rows.find((r) => r.entry.placement.location === location);
    expect(row(later.location)).toMatchObject({
      ms: 10_000,
      state: "in-order",
    });
    expect(row(early.location)).toMatchObject({ ms: 20_000, state: "late" });
    expect(row(early.location)?.entry.behind).toBeGreaterThanOrEqual(1);
    expect(row(never.location)?.state).toBe("missed");
    expect(summary.late).toBe(1);
    expect(summary.missed).toBeGreaterThan(0);
    expect(
      summary.inOrder +
        summary.late +
        summary.missed +
        summary.unknown +
        summary.untimed,
    ).toBe(summary.required);
  });

  it("does not call a counted dungeon's checks missed", () => {
    const { counted, rows } = compareReview(log, run());
    expect(counted.length).toBeGreaterThan(0);
    const dungeonRow = rows.find(
      (r) => r.entry.placement.location === "eastern-palace/compass-chest",
    );
    expect(dungeonRow?.state).toBe("unknown");
  });

  it("calls a finished dungeon's checks done, with no time", () => {
    act(() => {
      store().setItem("chest0", 0);
    });
    const { rows } = compareReview(log, run());
    const dungeonRow = rows.find(
      (r) => r.entry.placement.location === "eastern-palace/compass-chest",
    );
    expect(dungeonRow).toMatchObject({ ms: null, state: "untimed" });
  });

  it("matches a boss beaten to its boss and prize locations", () => {
    vi.setSystemTime(T0 + 90_000);
    act(() => store().setItem("boss0", 2));
    const { rows } = compareReview(log, run());
    const prize = rows.find(
      (r) => r.entry.placement.location === "eastern-palace/prize",
    );
    expect(prize).toMatchObject({ ms: null });
    expect(prize?.entry.state).toBe("found");
  });

  it("leaves the locations the board does not track unknown", () => {
    const { rows } = compareReview(log, run());
    for (const location of ["pyramid-bottle", "turtle-rock-medallion"]) {
      expect(
        rows.find((r) => r.entry.placement.location === location)?.state,
      ).toBe("unknown");
    }
  });
});
