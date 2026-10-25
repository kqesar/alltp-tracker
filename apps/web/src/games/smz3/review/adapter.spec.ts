import { HYRULE_MARKERS, parseSpoiler, ZEBES_MARKERS } from "@alltp/pack-smz3";
import { describe, expect, it } from "vitest";
import { bindRun, compareReview } from "@/games/smz3/review/adapter";
import { apiFile, GUID, spoilerLog } from "@/games/smz3/review/fixtures";
import { labelsOfLog, placesText } from "@/games/smz3/review/labels";
import { freshProgress, type Smz3Progress } from "@/games/smz3/store";

const log = spoilerLog();

/** A run on the log's own settings and medallions, which the log's seed fixes. */
const runOf = (change: Partial<Smz3Progress> = {}): Smz3Progress => ({
  ...freshProgress(log.extra.settings),
  pads: { mire: "unknown", turtleRock: "unknown" },
  ...change,
});

describe("binding a log to a run", () => {
  it("is verified when the guids are equal", () => {
    expect(bindRun(log, runOf({ seed: GUID }))).toMatchObject({
      verdict: "verified",
    });
  });

  it("is not verified, counting what agrees, when the run knows no guid", () => {
    expect(bindRun(log, runOf())).toEqual({
      facts: 5,
      verdict: "not-verified",
    });
  });

  it("counts the medallions the board knows among what agrees", () => {
    expect(
      bindRun(
        log,
        runOf({
          pads: { mire: log.extra.medallions.mire, turtleRock: "unknown" },
        }),
      ),
    ).toEqual({ facts: 6, verdict: "not-verified" });
  });

  it("refuses another seed, naming both", () => {
    expect(bindRun(log, runOf({ seed: "f".repeat(32) }))).toMatchObject({
      refusal: { detail: `${"f".repeat(32)} / ${GUID}`, error: "seed-differs" },
      verdict: "refused",
    });
  });

  it.each([
    ["smLogic", { smLogic: "hard" as const }, "smLogic: hard / normal"],
    ["keysanity", { keysanity: true }, "keysanity: on / off"],
    ["towerCrystals", { towerCrystals: 3 }, "towerCrystals: 3 / 7"],
    ["ganonCrystals", { ganonCrystals: 4 }, "ganonCrystals: 4 / 7"],
    ["tourianBosses", { tourianBosses: 2 }, "tourianBosses: 2 / 4"],
  ])("refuses a run whose %s differs", (_, settings, detail) => {
    expect(
      bindRun(log, runOf({ settings: { ...log.extra.settings, ...settings } })),
    ).toMatchObject({
      refusal: { detail, error: "settings-differ" },
      verdict: "refused",
    });
  });

  it("refuses a medallion the board knows to be another", () => {
    const wrong = log.extra.medallions.mire === "bombos" ? "quake" : "bombos";
    expect(
      bindRun(log, runOf({ pads: { mire: wrong, turtleRock: "unknown" } })),
    ).toMatchObject({
      refusal: {
        detail: `medallion:mire: ${wrong} / ${log.extra.medallions.mire}`,
        error: "settings-differ",
      },
    });
  });

  it("lets a contradiction win over equal guids", () => {
    expect(
      bindRun(
        log,
        runOf({
          seed: GUID,
          settings: { ...log.extra.settings, smLogic: "hard" },
        }),
      ),
    ).toMatchObject({ verdict: "refused" });
  });
});

describe("what a review lays on the board", () => {
  const labels = labelsOfLog(log);

  it("holds every placement of the log, by location", () => {
    expect(labels.byLocation.size).toBe(316);
    expect([...labels.byLocation.keys()].sort()).toEqual(
      log.placements.map((p) => p.location).sort(),
    );
  });

  it("draws the items the board has art for, the keys with the dungeon keys' art", () => {
    const iconOf = (item: string) =>
      [...labels.byLocation.values()].find((h) => h.item === item)?.icon;
    expect(iconOf("hookshot")).toEqual({ file: "hookshot.png", kind: "asset" });
    expect(iconOf("sword")).toEqual({ file: "sword1.png", kind: "asset" });
    expect(iconOf("charge")).toMatchObject({ kind: "sheet" });
    expect(iconOf("bigKeyEP")).toEqual({ file: "bigkey.png", kind: "asset" });
    expect(iconOf("keyDP")).toEqual({ file: "smallkey.png", kind: "asset" });
    // Rupees, maps and the like have none
    const rupees = [...labels.byLocation.values()].find(
      (h) => h.name === "Twenty Rupees",
    );
    expect(rupees?.icon).toBeNull();
    expect(rupees?.rank).toBe(3);
  });

  it("names a marker by its most notable items first", () => {
    for (const marker of [
      ...HYRULE_MARKERS.light,
      ...HYRULE_MARKERS.dark,
      ...ZEBES_MARKERS,
    ]) {
      const held = labels.byMarker.get(marker.id);
      const placed = marker.locations.filter((id) => labels.byLocation.has(id));
      expect(held?.held.length ?? 0, marker.id).toBe(placed.length);
      if (held !== undefined) {
        expect(held.held.map((h) => h.rank)).toEqual(
          [...held.held.map((h) => h.rank)].sort((a, b) => a - b),
        );
        expect(held.top).toBe(held.held[0]);
      }
    }
    // Every location the log placed sits on a marker of one of the maps
    const onMarkers = new Set(
      [
        ...HYRULE_MARKERS.light,
        ...HYRULE_MARKERS.dark,
        ...ZEBES_MARKERS,
      ].flatMap((m) => m.locations),
    );
    const orphans = [...labels.byLocation.keys()].filter(
      (id) => !onMarkers.has(id),
    );
    expect(orphans).toEqual([]);
  });

  it("says where an item was, one place or several", () => {
    const hookshot = labels.byItem.get("hookshot") ?? [];
    expect(hookshot).toHaveLength(1);
    expect(placesText(hookshot)).toBe(`at ${hookshot[0]?.where}`);
    const swords = labels.byItem.get("sword") ?? [];
    expect(swords).toHaveLength(4);
    expect(placesText(swords)).toMatch(/^4 places: .+, .+, .+ and 1 more$/);
    expect(placesText([])).toBe("");
  });
});

describe("comparing the run with the log", () => {
  const labels = labelsOfLog(log);

  it("counts nothing checked as every required place not checked", () => {
    const comparison = compareReview(labels, { checked: [] });
    expect(comparison.total).toBe(316);
    expect(comparison.checked).toBe(0);
    expect(comparison.required).toBeGreaterThan(10);
    expect(comparison.requiredChecked).toBe(0);
    expect(comparison.spheres).toHaveLength(log.spheres);
    expect(comparison.spheres.map((s) => s.sphere)).toEqual(
      Array.from({ length: log.spheres }, (_, i) => i + 1),
    );
    expect(
      comparison.spheres.flatMap((s) => s.rows).every((r) => !r.checked),
    ).toBe(true);
    // Every place is left, grouped by the file's regions
    expect(comparison.missed.flatMap((m) => m.places)).toHaveLength(316);
  });

  it("marks what the run checked, in the playthrough and out of it", () => {
    const sphere1 = labels.byLocation.get(
      log.placements.find((p) => p.sphere === 1)?.location ?? "",
    );
    const aside = log.placements.find((p) => p.sphere === null);
    expect(sphere1).toBeDefined();
    expect(aside).toBeDefined();
    const checked = [sphere1?.location ?? "", aside?.location ?? ""];
    const comparison = compareReview(labels, { checked });
    expect(comparison.checked).toBe(2);
    expect(comparison.requiredChecked).toBe(1);
    const rows = comparison.spheres.flatMap((s) => s.rows);
    expect(rows.filter((r) => r.checked).map((r) => r.held.location)).toEqual([
      sphere1?.location,
    ]);
    const left = comparison.missed.flatMap((m) => m.places);
    expect(left).toHaveLength(314);
    expect(left.some((h) => h.location === aside?.location)).toBe(false);
  });

  it("lists a region's unchecked places required first, and regions with a notable item first", () => {
    const comparison = compareReview(labels, { checked: [] });
    for (const { places } of comparison.missed) {
      expect(places.map((h) => h.rank)).toEqual(
        [...places.map((h) => h.rank)].sort((a, b) => a - b),
      );
    }
    const ranks = comparison.missed.map((m) => m.places[0]?.rank ?? 3);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("has nothing left once every place is checked", () => {
    const comparison = compareReview(labels, {
      checked: log.placements.map((p) => p.location),
    });
    expect(comparison.missed).toEqual([]);
    expect(comparison.requiredChecked).toBe(comparison.required);
  });

  it("reads the same from the API's JSON as from the Download", async () => {
    const parsed = parseSpoiler(await apiFile().text(), "api.json");
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value.format).toBe("smz3-api");
    expect(log.format).toBe("smz3-yaml");
    const fromApi = compareReview(labelsOfLog(parsed.value), { checked: [] });
    const fromText = compareReview(labels, { checked: [] });
    expect(fromApi.required).toBe(fromText.required);
    expect(
      fromApi.spheres.map((s) => s.rows.map((r) => r.held.location)),
    ).toEqual(fromText.spheres.map((s) => s.rows.map((r) => r.held.location)));
  });
});
