import { describe, expect, it } from "vitest";
import { getPreset } from "@/games/alttpr/data/presets";
import {
  bindRun,
  compareReview,
  type ReviewedRun,
} from "@/games/alttpr/review/adapter";
import { playedRun, spoilerLog } from "@/games/alttpr/review/fixtures";
import { hiddenReason } from "@/games/alttpr/review/sweep";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

// A Retro seed's log writes every small key as a bare `Key` (the pack's
// spoiler specs); the review must take it as the seed's own.
const HASH = "VMR3zKaKv5";
const log = spoilerLog(HASH);

const fresh = (): ReviewedRun => {
  const state = useGameStore.getInitialState();
  return {
    checked: {},
    items: state.items,
    medallions: state.medallions,
    presetId: "retro",
    seed: HASH,
    settings: getPreset("retro").settings,
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

describe("a Retro run, whose small keys are generic", () => {
  const run = playedRun(log, plan, fresh());

  it("is the seed's own: the log binds to the run", () => {
    expect(plan.length).toBeGreaterThan(10);
    expect(bindRun(log, run).verdict).toBe("verified");
  });

  it("shows the playthrough with the run timer's readings, not the waits", () => {
    expect(hiddenReason(log, run, compareReview(log, run))).toBe(
      "generic-keys",
    );
  });

  it("does not take a run of another mode for it", () => {
    const open = {
      ...run,
      presetId: "open",
      settings: getPreset("open").settings,
    };
    expect(bindRun(log, open).verdict).not.toBe("verified");
  });
});
