import { describe, expect, it } from "vitest";
import { getPreset } from "@/games/alttpr/data/presets";
import { locationName } from "@/games/alttpr/logic/solution";
import { compareReview, type ReviewedRun } from "@/games/alttpr/review/adapter";
import {
  type Played,
  playedRun,
  spoilerLog,
} from "@/games/alttpr/review/fixtures";
import {
  BREAK_MS,
  chainOf,
  drain,
  hiddenReason,
  type Sweep,
  sweepRun,
} from "@/games/alttpr/review/sweep";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const HASH = "9MQ9gO1wMD";
const log = spoilerLog(HASH);
const HOOKSHOT = "eastern-palace/map-chest";

/** The board as a new game leaves it, on the seed's run type. */
const fresh = (): ReviewedRun => {
  const state = useGameStore.getInitialState();
  return {
    checked: {},
    items: state.items,
    medallions: state.medallions,
    presetId: "open",
    seed: HASH,
    settings: getPreset("open").settings,
    smallKeys: state.smallKeys,
    timeline: {},
  };
};

/**
 * The playthrough taken step by step, two minutes apart, but for the
 * Hookshot: left in Eastern Palace and taken last, after a break of 40
 * minutes. Whatever needs it is then taken before the logic expected.
 */
const PLAN: readonly Played[] = (() => {
  const order = log.placements
    .filter((p) => p.sphere !== null && p.location !== HOOKSHOT)
    .sort(
      (a, b) =>
        (a.sphere ?? 0) - (b.sphere ?? 0) ||
        a.locationName.localeCompare(b.locationName),
    );
  const plan = order.map((p, index) => ({
    location: p.location,
    minute: 2 * (index + 1),
  }));
  const last = plan.at(-1)?.minute ?? 0;
  return [...plan, { location: HOOKSHOT, minute: last + 40 }];
})();

const run = playedRun(log, PLAN, fresh());
const comparison = compareReview(log, run);
const endMs = ((PLAN.at(-1)?.minute ?? 0) + 3) * 60_000;
const sweep: Sweep = drain(sweepRun(log, run, comparison, endMs));
const waitAt = (location: string) =>
  sweep.waits.find((wait) => wait.location === location);

describe("when the waits are shown", () => {
  it("for an autotracked run of a modelled seed", () => {
    expect(hiddenReason(log, run, comparison)).toBeNull();
  });

  it.each([
    ["keysanity", { dungeonItems: "full" }],
    ["keysanity", { dungeonItems: "mcs" }],
    ["entrances", { entranceShuffle: "simple" }],
    ["not-modelled", { hidden: ["goal"] }],
  ] as const)("not with %s", (reason, change) => {
    const changed = { ...run, settings: { ...run.settings, ...change } };
    expect(hiddenReason(log, changed, comparison)).toBe(reason);
  });

  it("not for a run with no times", () => {
    const untimed = { ...run, timeline: {} };
    expect(hiddenReason(log, untimed, compareReview(log, untimed))).toBe(
      "no-times",
    );
  });

  it("not for a run tracked by hand: its items clicked, no place checked", () => {
    const byHand = {
      ...run,
      timeline: Object.fromEntries(
        Object.entries(run.timeline).filter(([key]) => key.startsWith("item:")),
      ),
    };
    expect(hiddenReason(log, byHand, compareReview(log, byHand))).toBe(
      "by-hand",
    );
  });

  it("not for a log with no playthrough", () => {
    const race = { ...log, spheres: 0 };
    expect(hiddenReason(race, run, comparison)).toBe("no-playthrough");
  });
});

describe("the sweep", () => {
  it("leaves a stretch of 30 minutes or more with nothing found out of play time", () => {
    expect(sweep.breaks).toEqual([
      { at: (PLAN.at(-2)?.minute ?? 0) * 60_000, length: 40 * 60_000 },
    ]);
    expect(BREAK_MS).toBe(30 * 60_000);
    expect(sweep.timerEnd).toBe(endMs);
    expect(sweep.end).toBe(endMs - 40 * 60_000);
  });

  it("finds the Hookshot in logic from the start, waiting the whole run", () => {
    const hookshot = waitAt(HOOKSHOT);
    expect(hookshot).toMatchObject({
      after: null,
      icon: "hookshot",
      kind: "major",
      name: "Hookshot",
      reach: 0,
      // The break before it left out: taken as the step before it, in play time
      taken: (PLAN.at(-2)?.minute ?? 0) * 60_000,
      where: locationName(HOOKSHOT),
    });
    expect(sweep.waits[0]).toBe(hookshot);
    // Held earlier, it opens Hookshot Cave once the way there was held
    expect(hookshot?.tradeOff?.at).toBeGreaterThan(0);
    expect(hookshot?.tradeOff?.at).toBeLessThan(hookshot?.taken ?? 0);
    expect(hookshot?.tradeOff?.after).not.toBeNull();
    expect(hookshot?.tradeOff?.opened).toContain("hookshot-cave/top-right");
  });

  it("says what was taken before the items held put it in logic", () => {
    const fireRod = log.placements.find((p) => p.item === "fireRod");
    const wait = waitAt(fireRod?.location ?? "");
    expect(wait?.waited).toBeLessThan(0);
    expect(wait?.reach).toBe(waitAt(HOOKSHOT)?.taken);
    expect(wait?.after?.name).toBe("the Hookshot");
  });

  it("dates each item that waited by the item that put it in logic", () => {
    const timed = sweep.waits.filter(
      (wait) =>
        wait.reach !== null && wait.reach > 0 && (wait.waited ?? 0) >= 0,
    );
    expect(timed.length).toBeGreaterThan(5);
    for (const wait of timed) expect(wait.after).not.toBeNull();
  });

  it("times every dungeon: part and all in logic, entered, beaten", () => {
    const eastern = sweep.dungeons.find(({ id }) => id === "eastern-palace");
    expect(eastern).toMatchObject({ name: "Eastern Palace", partial: 0 });
    expect(eastern?.atPartial.length).toBeGreaterThan(0);
    expect(eastern?.atPartial.length).toBeLessThan(eastern?.total ?? 0);
    expect(eastern?.entered).not.toBeNull();
    expect(eastern?.finished).not.toBeNull();
    // The Hookshot's chest is in it, so the dungeon was entered before it was taken
    expect(eastern?.entered).toBeLessThan(waitAt(HOOKSHOT)?.taken ?? 0);
    expect(sweep.dungeons.map(({ id }) => id)).toContain("ganons-tower");
  });

  it("solves once per instant, then for what the items that waited would have opened", () => {
    const instants = new Set(Object.values(run.timeline).map(({ at }) => at));
    expect(sweep.solves).toBeGreaterThan(instants.size + 1);
  });

  it("yields between solves, so the page can run it in slices", () => {
    const work = sweepRun(log, run, comparison, endMs);
    let slices = 0;
    while (work.next().done !== true) slices++;
    expect(slices).toBe(sweep.solves);
  });
});

describe("the chain behind the run", () => {
  it("follows each item to the one held when it came into logic", () => {
    const chain = chainOf(sweep.waits);
    expect(chain.length).toBeGreaterThanOrEqual(3);
    for (const [index, wait] of chain.entries()) {
      if (index === 0) continue;
      expect(wait.after?.key).toBe(chain[index - 1]?.takenKey);
    }
  });
});
