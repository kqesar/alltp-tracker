import { describe, expect, it } from "vitest";
import { getPreset } from "@/games/alttpr/data/presets";
import {
  bindRun,
  compareReview,
  type ReviewedRun,
} from "@/games/alttpr/review/adapter";
import { playedRun, spoilerLog } from "@/games/alttpr/review/fixtures";
import { drain, hiddenReason, sweepRun } from "@/games/alttpr/review/sweep";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

// A Standard seed's playthrough starts with a sphere 0, the uncle's sword (the
// pack's spoiler specs); the review must run on it end to end.
const HASH = "6v1ab7qmv7";
const log = spoilerLog(HASH);

const fresh = (): ReviewedRun => {
  const state = useGameStore.getInitialState();
  return {
    checked: {},
    items: state.items,
    medallions: state.medallions,
    presetId: "standard",
    seed: HASH,
    settings: getPreset("standard").settings,
    smallKeys: state.smallKeys,
    timeline: {},
  };
};

const plan = log.placements
  .filter((p) => p.sphere !== null)
  .sort(
    (a, b) =>
      (a.sphere ?? 0) - (b.sphere ?? 0) ||
      a.locationName.localeCompare(b.locationName),
  )
  .map((p, index) => ({ location: p.location, minute: 2 * (index + 1) }));

describe("a Standard run", () => {
  const run = playedRun(log, plan, fresh());
  const comparison = compareReview(log, run);

  it("is the seed's own: the log binds to the run", () => {
    expect(plan.length).toBeGreaterThan(10);
    expect(bindRun(log, run).verdict).toBe("verified");
  });

  it("is swept: its waits are shown, none at a sphere 0", () => {
    expect(hiddenReason(log, run, comparison)).toBeNull();
    const sweep = drain(
      sweepRun(log, run, comparison, (plan.length + 3) * 120_000),
    );
    expect(sweep.waits.length).toBeGreaterThan(0);
    expect(sweep.waits.every((wait) => wait.sphere >= 1)).toBe(true);
  });
});
