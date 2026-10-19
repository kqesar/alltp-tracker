import { describe, expect, it } from "vitest";
import { REGION_MODULES } from "../src/regions";
import { locationId, regionId } from "../src/world";
import { loadRegions } from "./fixtures";

const upstream = loadRegions();

describe("the region modules", () => {
  it("port every upstream region file", () => {
    expect(REGION_MODULES.map((m) => m.file).sort()).toEqual(
      upstream.map((r) => r.file).sort(),
    );
  });

  it.each(upstream.map((r) => [r.name, r] as const))(
    "%s: its name, CanEnter and locations, each at its upstream line",
    (_, region) => {
      const module = REGION_MODULES.find((m) => m.file === region.file);
      expect(module?.region.name).toBe(region.name);
      expect(module?.region.id).toBe(regionId(region.name));
      const enter = region.canEnter
        ? `${region.file}:${region.canEnter}`
        : "Randomizer.SMZ3/Region.cs:90";
      expect(new Set(module?.region.entrances.map((e) => e.source))).toEqual(
        new Set([enter]),
      );
      expect(
        module?.region.locations.map(({ name, source }) => [name, source]),
      ).toEqual(
        region.locations.map(({ line, name }) => [
          name,
          `${region.file}:${line}`,
        ]),
      );
    },
  );

  it("give every location and region an id of its own", () => {
    const locations = REGION_MODULES.flatMap((m) => m.region.locations);
    expect(locations).toHaveLength(316);
    expect(new Set(locations.map((l) => l.id)).size).toBe(316);
    for (const l of locations) expect(l.id).toBe(locationId(l.name));
    expect(new Set(REGION_MODULES.map((m) => m.region.id)).size).toBe(40);
  });
});

describe("upstream.json", () => {
  it("lists every region file, for the weekly drift watch", async () => {
    const { default: manifest } = await import("../upstream.json");
    const listed = new Set(manifest.rules.map((r: { file: string }) => r.file));
    for (const module of REGION_MODULES) expect(listed).toContain(module.file);
    expect(manifest.tests).toHaveLength(7);
  });
});
