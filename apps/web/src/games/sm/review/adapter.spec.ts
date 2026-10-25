import type { MapRandoLog, SmItemId } from "@alltp/pack-sm";
import { describe, expect, it } from "vitest";
import {
  bindRun,
  byArea,
  cellWords,
  compareItems,
  placesByItem,
  runStatements,
  seedFacts,
  whereWords,
} from "@/games/sm/review/adapter";
import { spoilerLog } from "@/games/sm/review/fixtures";
import { freshProgress } from "@/games/sm/store";

const log = spoilerLog();
const NO_ITEMS = freshProgress().items;
const held = (counts: Partial<Record<SmItemId, number>>) => ({
  ...NO_ITEMS,
  ...counts,
});

/** The log as if the seed had also placed the Wall Jump Boots. */
const withWallJump: MapRandoLog = {
  ...log,
  extra: { ...log.extra, placed: { ...log.extra.placed, wallJump: 1 } },
};

describe("the run's statements", () => {
  it("count a default the player never set as nothing said", () => {
    expect(runStatements(freshProgress())).toEqual({
      objectives: null,
      splitSpeed: null,
      wallJump: null,
    });
  });

  it("count what the ROM stated (the run knows its seed), default or not", () => {
    expect(runStatements({ ...freshProgress(), seed: "Zebes42" })).toEqual({
      objectives: ["kraid", "phantoon", "draygon", "ridley"],
      splitSpeed: false,
      wallJump: false,
    });
  });

  it("count what the player moved off the default", () => {
    expect(
      runStatements({
        ...freshProgress(),
        objectives: ["pitRoom"],
        wallJump: true,
      }),
    ).toEqual({ objectives: ["pitRoom"], splitSpeed: null, wallJump: true });
  });
});

describe("binding a log to a run", () => {
  it("is never verified: the file names no seed", () => {
    const run = { ...freshProgress(), seed: "Zebes42" };
    expect(bindRun(log, run)).toEqual({ facts: 1, verdict: "not-verified" });
  });

  it("opens, not verified, for a run tracked by hand", () => {
    expect(bindRun(log, freshProgress())).toEqual({
      facts: 0,
      verdict: "not-verified",
    });
  });

  it("refuses other objectives, the ROM's own, naming the fact", () => {
    const run = {
      ...freshProgress(),
      objectives: ["pitRoom", "babyKraidRoom"],
      seed: "Zebes42",
    };
    expect(bindRun(log, run)).toMatchObject({
      refusal: { detail: expect.stringMatching(/^objectives: /) },
      verdict: "refused",
    });
  });

  it("refuses objectives the player set by hand that the seed does not have", () => {
    const run = { ...freshProgress(), objectives: ["pitRoom"] };
    expect(bindRun(log, run)).toMatchObject({
      refusal: { error: "settings-differ" },
      verdict: "refused",
    });
  });

  it("refuses a seed that places the Wall Jump Boots on a ROM without them", () => {
    const run = { ...freshProgress(), seed: "Zebes42" };
    expect(bindRun(withWallJump, run)).toMatchObject({
      refusal: { detail: "Wall Jump Boots: false / true" },
      verdict: "refused",
    });
  });

  it("does not refuse for an option the player never declared", () => {
    expect(bindRun(withWallJump, freshProgress()).verdict).toBe("not-verified");
    expect(
      bindRun(withWallJump, { ...freshProgress(), wallJump: true }),
    ).toEqual({ facts: 1, verdict: "not-verified" });
  });
});

describe("the board's items against the seed's", () => {
  it("lists the 16 single items and the five packs and tanks the seed placed", () => {
    const { counted, majors } = compareItems(log, NO_ITEMS);
    expect(majors).toHaveLength(16);
    expect(counted.map(({ id, placed }) => [id, placed])).toEqual([
      ["energyTank", 14],
      ["missile", 46],
      ["superMissile", 10],
      ["powerBomb", 10],
      ["reserveTank", 4],
    ]);
  });

  it("puts what the run never got first, then in the playthrough's order", () => {
    const { majors, summary } = compareItems(
      log,
      held({ ice: 1, morph: 1, varia: 1 }),
    );
    expect(summary).toMatchObject({ majors: 16, neverFound: 13 });
    expect(majors.map(({ held: h }) => h)).toEqual([
      ...Array(13).fill(false),
      true,
      true,
      true,
    ]);
    const steps = majors.map(({ placement }) => placement.sphere ?? 99);
    for (const part of [steps.slice(0, 13), steps.slice(13)]) {
      expect(part).toEqual([...part].sort((a, b) => a - b));
    }
    expect(majors[0]?.placement).toMatchObject({
      item: "speedBooster",
      sphere: 3,
    });
  });

  it("counts the packs held against those placed, and what was never found", () => {
    const { counted, summary } = compareItems(
      log,
      held({ energyTank: 14, missile: 30, powerBomb: 8 }),
    );
    const row = (id: string) => counted.find((r) => r.id === id);
    expect(row("missile")).toMatchObject({ held: 30, placed: 46 });
    expect(row("energyTank")).toMatchObject({ held: 14, placed: 14 });
    // 16 missiles + 2 power bombs + 10 supers + 4 reserve tanks
    expect(summary.packsLeft).toBe(32);
  });

  it("never counts a start's extra item as a find that was missed", () => {
    expect(compareItems(log, held({ missile: 50 })).summary.packsLeft).toBe(
      10 + 10 + 4 + 14,
    );
  });

  it("lists a row's places in the playthrough's order", () => {
    const missile = compareItems(log, NO_ITEMS).counted.find(
      (row) => row.id === "missile",
    );
    const steps = missile?.places.map((p) => p.sphere ?? 99) ?? [];
    expect(steps).toHaveLength(46);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });
});

describe("where the seed put things", () => {
  it("words a place with its room, node and area", () => {
    const morph = placesByItem(log).get("morph")?.[0];
    expect(morph && whereWords(morph)).toBe(
      "Brinstar Reserve Tank Room: Chozo Item (Crateria)",
    );
  });

  it("says a grid cell's place, or how many places there are", () => {
    const places = placesByItem(log);
    expect(cellWords(places.get("morph"))).toBe(
      "In the seed: Brinstar Reserve Tank Room: Chozo Item (Crateria).",
    );
    expect(cellWords(places.get("missile"))).toBe("In the seed: 46 places.");
    expect(cellWords(places.get("wallJump"))).toBeNull();
    expect(cellWords(undefined)).toBeNull();
  });

  it("builds each log's places once", () => {
    expect(placesByItem(log)).toBe(placesByItem(log));
  });

  it("groups by area in the game's order, each group in step order", () => {
    const groups = byArea(log.placements);
    expect(groups.map(([area]) => area)).toEqual([
      ...new Set(groups.map(([area]) => area)),
    ]);
    const names = groups.map(([area]) => area);
    const order = [
      "Crateria",
      "Brinstar",
      "Norfair",
      "Wrecked Ship",
      "Maridia",
      "Tourian",
    ];
    expect(names).toEqual(
      [...names].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    );
    expect(groups.reduce((sum, [, placed]) => sum + placed.length, 0)).toBe(
      100,
    );
  });

  it("states the seed's start, objectives and pack size", () => {
    expect(seedFacts(log)).toEqual([
      ["Start", "Ship"],
      ["Objectives", "Kraid, Phantoon, Draygon, Ridley"],
      ["A pack gives", "5 missiles, 5 super missiles, 5 power bombs"],
    ]);
  });
});
