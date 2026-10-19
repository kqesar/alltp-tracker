import { MARKERS } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { HYRULE_MARKERS, ZEBES_MARKERS, ZELDA_ALIASES } from "./markers";
import { REGION_MODULES } from "./regions";

const locationsOf = (game: string) =>
  REGION_MODULES.filter((m) => m.file.includes(`/${game}/`)).flatMap((m) =>
    m.region.locations.map((l) => l.id),
  );

describe("the markers", () => {
  it("place every Super Metroid location once, inside the Zebes map", () => {
    const placed = ZEBES_MARKERS.flatMap((m) => m.locations);
    expect([...placed].sort()).toEqual([...locationsOf("SuperMetroid")].sort());
    for (const { x, y } of ZEBES_MARKERS) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(100);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(100);
    }
  });

  it("draw Hyrule as the ALttPR pack does, every Zelda location placed once (-u writes them)", async () => {
    const fromAlttpr = new Map(
      Object.entries(ZELDA_ALIASES).map(([smz3, alttpr]) => [alttpr, smz3]),
    );
    const round = (value: number) => Math.round(value * 1000) / 1000;
    // A world's markers, x a percent of its half of ALttPR's map
    const world = (dark: boolean) =>
      MARKERS.filter(({ x }) => x > 50 === dark).map(
        ({ id, locations, name, x, y }) => ({
          id,
          locations: locations.map((l) => fromAlttpr.get(l) ?? l),
          name,
          x: round((dark ? x - 50 : x) * 2),
          y,
        }),
      );
    const hyrule = { dark: world(true), light: world(false) };
    await expect(`${JSON.stringify(hyrule, null, 1)}\n`).toMatchFileSnapshot(
      "./markers-hyrule.json",
    );
    expect(HYRULE_MARKERS).toEqual(hyrule);
    const placed = [...hyrule.light, ...hyrule.dark].flatMap(
      (m) => m.locations,
    );
    expect([...placed].sort()).toEqual([...locationsOf("Zelda")].sort());
  });

  it("alias only Zelda locations SMZ3 has", () => {
    const zelda = new Set(locationsOf("Zelda"));
    for (const id of Object.keys(ZELDA_ALIASES)) expect(zelda).toContain(id);
  });
});
