// upstream.json: the upstream commit the pack follows, the rule files it
// ports (each with the module it maps to and its status) and the test files
// whose cases the contract runner checks once they are ported.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { locationsOf } from "../scripts/import-upstream-tests.mjs";
import type { Fixture, LocationIndex } from "./fixtures";

export const PACK_DIR = fileURLToPath(new URL("..", import.meta.url));

export type Status = "pending" | "ported";

export interface ManifestEntry {
  readonly file: string;
  /** For a test file: its fixture, relative to the pack. */
  readonly fixture?: string;
  /** The pack module the file maps to, relative to the pack. */
  readonly module?: string;
  /** Why a support file is listed: which of its code the rules call. */
  readonly role?: string;
  readonly status: Status;
}

export interface Manifest {
  readonly commit: string;
  /**
   * The Door Randomizer release the DR locations are read from
   * (scripts/import-dr.mjs), its base patch (the memory it keeps) and the
   * Overworld Randomizer release built on it.
   */
  readonly doorRandomizer: {
    readonly basePatch: {
      readonly branch: string;
      readonly commit: string;
      readonly repo: string;
    };
    readonly commit: string;
    readonly data: string;
    readonly importer: string;
    readonly license: string;
    readonly overworld: {
      readonly commit: string;
      readonly repo: string;
      readonly version: string;
    };
    readonly repo: string;
    /** Its item names joined to vt's classes (scripts/import-item-names.mjs). */
    readonly spoilerItems: string;
    readonly version: string;
  };
  /** The entrance randomizer vt hands shuffled entrances to, pinned too. */
  readonly entranceRandomizer: {
    readonly commit: string;
    readonly data: string;
    readonly license: string;
    readonly pinnedBy: string;
    readonly repo: string;
    /** Its rules, translated (scripts/er-rules.mjs). */
    readonly rules: string;
    /** Its items joined to vt's by ROM code (scripts/import-item-names.mjs). */
    readonly spoilerItems: string;
    /** Its own tests' cases, imported (scripts/er-tests.mjs). */
    readonly tests: string;
  };
  readonly license: string;
  readonly logic: number;
  readonly repo: string;
  readonly rules: readonly ManifestEntry[];
  readonly tests: readonly ManifestEntry[];
}

export function loadManifest(): Manifest {
  return JSON.parse(
    readFileSync(new URL("../upstream.json", import.meta.url), "utf8"),
  ) as Manifest;
}

/**
 * The module an upstream region file maps to: its path under app/Region/,
 * in kebab case, under src/regions/ (Standard/LightWorld/NorthEast.php is
 * src/regions/standard/light-world/north-east.ts). One module per file, so
 * an upstream diff maps 1:1 onto the pack.
 */
export function regionModule(file: string): string | undefined {
  const match = /^app\/Region\/(.+)\.php$/.exec(file);
  if (match?.[1] === undefined) return undefined;
  const path = match[1]
    .split("/")
    .map((segment) => segment.replace(/(?<!^)(?=[A-Z])/g, "-").toLowerCase())
    .join("/");
  return `src/regions/${path}.ts`;
}

/**
 * The region files a test class's cases reach, in its world's mode: the
 * region holding each location it checks (or places a medallion at) and
 * each region it enters. A region is its file and every region class it
 * extends: Open's escape sets the rules of locations Standard's builds, and
 * Inverted's classes keep their parent's rules but those they set. A
 * location is the one its world holds: Inverted moves some. Throws on a
 * name the index lacks.
 */
export function rulesOfTest(
  fixture: Fixture,
  index: LocationIndex,
): Set<string> {
  const mode = fixture.worlds.world?.mode;
  // The retro world is Open's, its regions and all (app/World/Retro.php:5)
  const world = mode === "retro" ? "open" : mode;
  const regions = index.regions.filter((r) => r.mode === world);
  const byName = new Map(regions.map((r) => [r.name, r]));
  const parents = new Map<string, string>();
  for (const r of index.regions) {
    if (r.extends !== undefined) parents.set(r.file, r.extends);
  }
  const holder = new Map<string, (typeof regions)[number]>();
  for (const region of regions) {
    for (const name of locationsOf(
      region.file,
      parents,
      index.locations,
      index.removals,
    )) {
      holder.set(name, region);
    }
  }
  const files = new Set<string>();
  const add = (region: (typeof regions)[number]) => {
    for (
      let file: string | undefined = region.file;
      file !== undefined;
      file = parents.get(file)
    ) {
      files.add(file);
    }
  };
  const location = (name: string) => {
    const owner = holder.get(name);
    if (owner === undefined) {
      throw new RangeError(`${fixture.file}: no location "${name}" in ${mode}`);
    }
    add(owner);
  };
  const region = (name: string) => {
    const found = byName.get(name);
    if (found === undefined) {
      throw new RangeError(`${fixture.file}: no region "${name}" in ${mode}`);
    }
    add(found);
  };
  for (const name of Object.keys(fixture.setUp.locationItems)) location(name);
  for (const c of fixture.cases) {
    if ("location" in c) location(c.location);
    if ("region" in c) region(c.region);
    if ("locationItems" in c) {
      for (const name of Object.keys(c.locationItems ?? {})) location(name);
    }
  }
  return files;
}

/**
 * Ported test files whose cases name a region file still pending: their
 * cases cannot pass yet, so marking them ported is a mistake. It is a lower
 * bound: the regions on the way and the support files are not named.
 */
export function portedTooEarly(
  manifest: Manifest,
  fixtures: readonly Fixture[],
  index: LocationIndex,
): string[] {
  const status = new Map(manifest.rules.map((r) => [r.file, r.status]));
  const byFile = new Map(fixtures.map((f) => [f.file, f]));
  return manifest.tests
    .filter((test) => test.status === "ported" && test.fixture !== undefined)
    .flatMap((test) => {
      const fixture = byFile.get(test.file);
      if (fixture === undefined) return [`${test.file}: no fixture`];
      return [...rulesOfTest(fixture, index)]
        .filter((file) => status.get(file) !== "ported")
        .map((file) => `${test.file}: ${file} is not ported`);
    });
}
