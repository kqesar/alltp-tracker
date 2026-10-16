// The region modules against upstream: each region file has its module,
// each world lists its modules in upstream's order, a ported module holds
// exactly its file's locations, and a ported test file needs only ported
// regions. The checks a region port is held to, besides the contract.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { foldSettings, parse, walk } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { UPSTREAM_ITEMS } from "../src/items";
import { type LocationDef, locationId, locationKind } from "../src/location";
import { compile, STATE_NAMES } from "../src/pack";
import { RULES } from "../src/rules";
import {
  type AlttprSettings,
  OPEN,
  STANDARD,
  settingsFromUpstream,
  UPSTREAM_TEST,
} from "../src/settings";
import {
  type RegionDef,
  type RegionModule,
  regionId,
  START,
} from "../src/world";
import { OPEN_REGIONS } from "../src/worlds/open";
import { STANDARD_REGIONS } from "../src/worlds/standard";
import { loadFixtures, loadLocationIndex } from "./fixtures";
import { loadManifest, PACK_DIR, rulesOfTest } from "./manifest";

const manifest = loadManifest();
const index = loadLocationIndex();
const fixtures = loadFixtures();

const entries = manifest.rules.filter((entry) =>
  entry.file.startsWith("app/Region/"),
);

/** Each region file's module, loaded from the path upstream.json gives. */
const modules = new Map<string, RegionModule>(
  await Promise.all(
    entries.map(async (entry) => {
      const url = pathToFileURL(join(PACK_DIR, entry.module ?? "")).href;
      const exported = Object.values(
        (await import(url)) as Record<string, RegionModule>,
      );
      if (exported.length !== 1) {
        throw new Error(`${entry.module} must export its module only`);
      }
      return [entry.file, exported[0] as RegionModule] as const;
    }),
  ),
);

const isPending = (module: RegionModule) =>
  module.regions.every(
    (region) => region.entrances.length === 0 && region.locations.length === 0,
  );

const WORLDS = { open: OPEN_REGIONS, standard: STANDARD_REGIONS } as const;

/** The file whose constructor builds a region file's locations. */
const builder = new Map(
  index.regions.map((r) => [r.file, r.extends ?? r.file] as const),
);

const inFile = (source: string, file: string) =>
  source.startsWith(`${file}:`) && /:\d+$/.test(source);

/** Where each part of a location's fill rules was read. */
function fillSources({ fill }: LocationDef): string[] {
  if (fill === undefined) return [];
  return [
    ...(fill.always ? [fill.always.source] : []),
    ...(fill.holding ? [fill.holding.source] : []),
    ...(fill.requires ? [fill.requires.source] : []),
    ...(fill.refuse ?? []).map((r) => r.source),
  ];
}

/**
 * What a location's fill rules get wrong: an upstream item that does not
 * exist, or a requirement that reads a name the pack does not have.
 */
function fillErrors({ fill, name }: LocationDef): string[] {
  if (fill === undefined) return [];
  const errors: string[] = [];
  const items = [
    ...(fill.always?.items ?? []),
    ...Object.keys(fill.holding?.items ?? {}),
    ...(fill.refuse ?? []).flatMap(({ refuse }) =>
      "classes" in refuse
        ? []
        : "items" in refuse
          ? refuse.items
          : refuse.allBut,
    ),
  ];
  for (const item of items) {
    if (!UPSTREAM_ITEMS.has(item)) errors.push(`${name}: no item ${item}`);
  }
  const reqs = [
    ...(fill.always ? [fill.always.req] : []),
    ...(fill.requires ? [fill.requires.req] : []),
    ...Object.values(fill.holding?.items ?? {}),
    ...(fill.holding?.otherwise ? [fill.holding.otherwise] : []),
    ...(fill.refuse ?? []).flatMap((r) => (r.when ? [r.when] : [])),
  ];
  const names = new Set(STATE_NAMES);
  for (const req of reqs) {
    for (const settings of [OPEN, STANDARD, UPSTREAM_TEST]) {
      try {
        walk(foldSettings(parse(req), settings, name), (node) => {
          if (node.type === "item" && !names.has(node.name)) {
            errors.push(`${name}: ${req} reads ${node.name}`);
          }
          if (node.type === "helper" && !RULES.helpers?.[node.name]) {
            errors.push(`${name}: ${req} calls @${node.name}`);
          }
        });
      } catch (error) {
        errors.push(`${name}: ${(error as Error).message}`);
      }
    }
  }
  return [...new Set(errors)];
}

/** What a ported module gets wrong against upstream's location index. */
function portErrors(module: RegionModule): string[] {
  const errors: string[] = [];
  const upstream = index.locations.filter(
    (l) => l.file === builder.get(module.file),
  );
  const ours = module.regions.flatMap((region) => region.locations);
  const names = new Set(ours.map((l) => l.name));
  const missing = upstream.filter((l) => !names.has(l.name));
  if (missing.length > 0) {
    errors.push(
      `missing ${missing
        .map((l) => l.name)
        .sort()
        .join(", ")}`,
    );
  }
  for (const location of ours) {
    const where = location.name;
    const kind = upstream.find((l) => l.name === location.name)?.kind;
    if (kind === undefined) errors.push(`${where}: not in ${module.file}`);
    if (location.id !== locationId(location.name)) {
      errors.push(`${where}: id ${location.id}, not ${locationId(where)}`);
    }
    if (kind !== undefined && location.kind !== locationKind(kind)) {
      errors.push(`${where}: kind ${location.kind}, not ${locationKind(kind)}`);
    }
    if (!inFile(location.source, module.file)) {
      errors.push(`${where}: source ${location.source}`);
    }
    const seen = location.visible?.source;
    if (seen !== undefined && seen !== "game" && !inFile(seen, module.file)) {
      errors.push(`${where}: visible source ${seen}`);
    }
    for (const source of fillSources(location)) {
      if (!inFile(source, module.file)) {
        errors.push(`${where}: fill source ${source}`);
      }
    }
  }
  for (const region of module.regions) {
    for (const { source } of region.entrances) {
      if (!inFile(source, module.file)) {
        errors.push(`${region.id}: entrance source ${source}`);
      }
    }
    if (region.prize !== undefined) {
      const prize = region.locations.find((l) => l.id === region.prize);
      if (prize?.kind !== "prize") {
        errors.push(`${region.id}: prize ${region.prize} is no prize`);
      }
    }
  }
  return errors;
}

describe("the region modules", () => {
  it("are one per region file, at the path upstream.json gives", () => {
    expect(modules.size).toBe(27);
    for (const [file, module] of modules) {
      expect(module.file, file).toBe(file);
    }
  });

  it("are listed by each world in upstream's order, under upstream's names", () => {
    for (const [mode, list] of Object.entries(WORLDS)) {
      const upstream = index.regions
        .filter((r) => r.mode === mode)
        .sort((a, b) => a.line - b.line);
      expect(list.map((m) => m.file)).toEqual(upstream.map((r) => r.file));
      // Each module's first region is the one upstream names
      expect(list.map((m) => m.regions[0]?.name)).toEqual(
        upstream.map((r) => r.name),
      );
      for (const module of list) {
        expect(module).toBe(modules.get(module.file));
      }
    }
    // Open differs from Standard by its escape only
    expect(
      OPEN_REGIONS.filter((m, i) => m !== STANDARD_REGIONS[i]).map(
        (m) => m.file,
      ),
    ).toEqual(["app/Region/Open/HyruleCastleEscape.php"]);
  });

  it("give a region upstream names the id other modules know it by", () => {
    for (const module of modules.values()) {
      for (const region of module.regions) {
        if (region.name !== undefined) {
          expect(region.id).toBe(regionId(region.name));
        }
      }
    }
    expect(regionId("North East Light World")).toBe("northEastLightWorld");
    expect(regionId("Ganons Tower")).toBe("ganonsTower");
    expect(regionId("Tower of Hera")).toBe("towerOfHera");
  });

  it("are stubs exactly while upstream.json says pending", () => {
    for (const entry of entries) {
      const module = modules.get(entry.file);
      expect(module && isPending(module), entry.file).toBe(
        entry.status === "pending",
      );
    }
  });

  it("hold, once ported, exactly the locations of their file, with their ids and kinds", () => {
    for (const module of modules.values()) {
      if (!isPending(module))
        expect(portErrors(module), module.file).toEqual([]);
    }
  });

  it("are told what a port gets wrong", () => {
    const stub = modules.get("app/Region/Standard/EasternPalace.php");
    const region = stub?.regions[0];
    if (stub === undefined || region === undefined) {
      throw new Error("No Eastern Palace module");
    }
    const half: RegionModule = {
      ...stub,
      regions: [
        {
          ...region,
          entrances: [
            {
              from: START,
              req: "true",
              source: "app/Region/Standard/Nowhere.php:1",
            },
          ],
          locations: [
            {
              fill: {
                refuse: [
                  {
                    refuse: { items: ["KeyP1"] },
                    source: "app/Region/Standard/Elsewhere.php:3",
                  },
                ],
              },
              id: "eastern-palace/compass",
              kind: "bigChest",
              name: "Eastern Palace - Compass Chest",
              req: "true",
              source: "app/Region/Standard/EasternPalace.php:51",
              visible: { source: "app/Region/Standard/Elsewhere.php:2" },
            },
          ],
          prize: "eastern-palace/compass",
        },
      ],
    };
    expect(portErrors(half)).toEqual([
      "missing Eastern Palace - Big Chest, Eastern Palace - Big Key Chest, Eastern Palace - Boss, Eastern Palace - Cannonball Chest, Eastern Palace - Map Chest, Eastern Palace - Prize",
      "Eastern Palace - Compass Chest: id eastern-palace/compass, not eastern-palace/compass-chest",
      "Eastern Palace - Compass Chest: kind bigChest, not chest",
      "Eastern Palace - Compass Chest: visible source app/Region/Standard/Elsewhere.php:2",
      "Eastern Palace - Compass Chest: fill source app/Region/Standard/Elsewhere.php:3",
      "easternPalace: entrance source app/Region/Standard/Nowhere.php:1",
      "easternPalace: prize eastern-palace/compass is no prize",
    ]);
  });

  it("write their fill rules over upstream's items and the pack's names", () => {
    const errors = [...modules.values()].flatMap((module) =>
      module.regions.flatMap((r) => r.locations.flatMap(fillErrors)),
    );
    expect(errors).toEqual([]);
    const broken: LocationDef = {
      ...chest("x", "true"),
      fill: {
        always: { items: ["KeyZ9"], req: "keyZ9", source: "game" as never },
        refuse: [
          {
            refuse: { items: ["Hammer"] },
            source: "game" as never,
            when: "setting(nowhere)",
          },
        ],
      },
    };
    expect(fillErrors(broken)).toEqual([
      "x: no item KeyZ9",
      "x: keyZ9 reads keyZ9",
      expect.stringMatching(/^x: .*nowhere/),
    ]);
  });

  it("are plain data, which a JSON round trip keeps", () => {
    for (const module of modules.values()) {
      expect(JSON.parse(JSON.stringify(module))).toEqual(module);
    }
  });

  it("compile into a world for every preset", () => {
    for (const settings of [OPEN, STANDARD, UPSTREAM_TEST]) {
      const world = compile(settings);
      expect(world.regionIds[0]).toBe(START);
      expect(world.regionIds).toHaveLength(
        1 +
          (settings.standardMode ? STANDARD_REGIONS : OPEN_REGIONS).flatMap(
            (m) => m.regions,
          ).length,
      );
    }
  });
});

/**
 * The regions a requirement can lead to with these settings: its reach()
 * targets, helpers included, once the settings are folded in. A branch the
 * settings switch off (a glitch, another placement) leads nowhere.
 */
function reached(req: string, settings: AlttprSettings): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const visit = (text: string) =>
    walk(foldSettings(parse(text), settings, "dependencies"), (node) => {
      if (node.type === "reach") found.push(node.region);
      if (node.type === "helper" && !seen.has(node.name)) {
        seen.add(node.name);
        visit(RULES.helpers?.[node.name] ?? "false");
      }
    });
  visit(req);
  return found;
}

/** Whether an entrance can be taken at all with these settings. */
const open = (req: string, settings: AlttprSettings) => {
  const folded = foldSettings(parse(req), settings, "dependencies");
  return !(folded.type === "const" && folded.value === "no");
};

/**
 * The region files a test file's cases depend on, in its world. A region's
 * level depends on its entrances, so on the regions they come from, again
 * and again; a location's value on its region's level and on the regions
 * its requirement reaches. So: the files the cases name (rulesOfTest), then
 * every region on a way in to the regions they enter and the locations they
 * check, and every region those locations (and a completed region's prize)
 * reach. A way-in region's own locations do not count, nor entrances and
 * reach() in branches the world's settings fold away.
 */
function dependencies(
  file: string,
  worlds: Readonly<Record<string, readonly RegionModule[]>> = WORLDS,
): Set<string> {
  const fixture = fixtures.find((f) => f.file === file);
  const world = fixture?.worlds.world;
  if (fixture === undefined || world === undefined) {
    throw new RangeError(`No fixture for ${file}`);
  }
  const settings = settingsFromUpstream(world.mode, world.config);
  const list = worlds[world.mode] ?? [];
  const regions = new Map(
    list.flatMap((module) =>
      module.regions.map((region) => [region.id, { module, region }] as const),
    ),
  );
  const locations = new Map(
    list.flatMap((module) =>
      module.regions.flatMap((region) =>
        region.locations.map((l) => [l.id, { location: l, region }] as const),
      ),
    ),
  );
  const files = new Set(rulesOfTest(fixture, index));
  const entered = new Set<string>();
  const enter = (id: string): void => {
    const found = regions.get(id);
    if (found === undefined || entered.has(id)) return;
    entered.add(id);
    files.add(found.module.file);
    for (const entrance of found.region.entrances) {
      if (open(entrance.req, settings)) enter(entrance.from);
    }
  };
  const check = (id: string): void => {
    const found = locations.get(id);
    if (found === undefined) return;
    const { location, region } = found;
    enter(region.id);
    for (const target of [
      ...reached(location.req, settings),
      ...reached(location.visible?.req ?? "true", settings),
      ...(location.visible?.from === undefined ? [] : [location.visible.from]),
    ]) {
      enter(target);
    }
  };
  for (const c of fixture.cases) {
    if ("location" in c) check(locationId(c.location));
    if ("region" in c && c.kind !== "regionFill") {
      const id = regionId(c.region);
      enter(id);
      const prize = regions.get(id)?.region.prize;
      if (c.kind === "regionComplete" && prize !== undefined) check(prize);
    }
  }
  return files;
}

/** A copy of a world where one module's first region is changed. */
function changed(
  file: string,
  change: (region: RegionDef) => RegionDef,
  modules: readonly RegionModule[] = STANDARD_REGIONS,
): readonly RegionModule[] {
  return modules.map((module) =>
    module.file === file
      ? {
          ...module,
          regions: module.regions.map((region, i) =>
            i === 0 ? change(region) : region,
          ),
        }
      : module,
  );
}

/** A location with nothing but an id and a rule, for the checks above. */
const chest = (id: string, req: string): LocationDef => ({
  id,
  kind: "chest",
  name: id,
  req,
  source: "game",
});

describe("a ported test file", () => {
  it("depends only on ported regions, on the ways in and through reach()", () => {
    const status = new Map(manifest.rules.map((r) => [r.file, r.status]));
    const early = manifest.tests
      .filter((test) => test.status === "ported" && test.fixture !== undefined)
      .flatMap((test) =>
        [...dependencies(test.file)]
          .filter((file) => status.get(file) !== "ported")
          .map((file) => `${test.file}: ${file} is pending`),
      );
    expect(early).toEqual([]);
  });

  it("finds the regions on the way in and those the checked locations reach", () => {
    const eastern = "tests/NoGlitches/EasternPalaceTest.php";
    expect([...dependencies(eastern)]).toEqual([
      "app/Region/Standard/EasternPalace.php",
    ]);
    // Were Eastern Palace entered from East Death Mountain, itself entered
    // from West Death Mountain, and its map chest to reach Tower of Hera, its
    // cases would depend on all four, but not on what East Death Mountain's
    // own locations reach
    const linked = changed(
      "app/Region/Standard/LightWorld/DeathMountain/East.php",
      (region) => ({
        ...region,
        entrances: [
          {
            from: "westDeathMountain",
            req: "hookshot",
            source: "app/Region/Standard/LightWorld/DeathMountain/East.php:1",
          },
        ],
        locations: [chest("x", "reach(turtleRock)")],
      }),
      changed("app/Region/Standard/EasternPalace.php", (region) => ({
        ...region,
        entrances: [
          {
            from: "eastDeathMountain",
            req: "true",
            source: "app/Region/Standard/EasternPalace.php:1",
          },
        ],
        locations: [
          chest("eastern-palace/map-chest", "reach(towerOfHera)"),
          chest("eastern-palace/cannonball-chest", "true"),
        ],
      })),
    );
    expect([...dependencies(eastern, { standard: linked })].sort()).toEqual([
      "app/Region/Standard/EasternPalace.php",
      "app/Region/Standard/LightWorld/DeathMountain/East.php",
      "app/Region/Standard/LightWorld/DeathMountain/West.php",
      "app/Region/Standard/TowerOfHera.php",
    ]);
  });

  it("leaves out the branches NoGlitches and the tests' world fold away", () => {
    const eastern = "tests/NoGlitches/EasternPalaceTest.php";
    const glitched = changed(
      "app/Region/Standard/EasternPalace.php",
      (region) => ({
        ...region,
        entrances: [
          {
            from: START,
            req: "rescueZelda",
            source: "app/Region/Standard/EasternPalace.php:1",
          },
          {
            from: "westDeathMountain",
            req: "setting(canMirrorClip) & magicMirror",
            source: "app/Region/Standard/EasternPalace.php:1",
          },
        ],
        locations: [
          chest(
            "eastern-palace/map-chest",
            "setting(advancedPlacement) & reach(towerOfHera) | @canBeatEasternPalaceBoss",
          ),
        ],
      }),
    );
    expect([...dependencies(eastern, { standard: glitched })]).toEqual([
      "app/Region/Standard/EasternPalace.php",
    ]);
  });
});
