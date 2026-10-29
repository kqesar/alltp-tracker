// Loads the fixtures scripts/import-upstream-tests.mjs writes under
// test/upstream/: the upstream NoGlitches test cases and item table.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURES_DIR = fileURLToPath(new URL("upstream", import.meta.url));

/** Where every fixture comes from. */
export interface UpstreamHeader {
  readonly commit: string;
  readonly copyright: string;
  readonly license: string;
  readonly logic: number;
  readonly repo: string;
}

/**
 * The items a case holds, as the upstream test builds them: what setUp
 * collected, or with `allItems` everything but `except` (TestCase.php
 * allItemsExcept); then `add` on top.
 */
export interface Collection {
  readonly add: readonly string[];
  readonly base: "allItems" | "setUp";
  readonly except?: readonly string[];
}

interface CaseBase {
  /** PHPUnit's data set number, for a test with a data provider. */
  readonly dataSet?: number;
  readonly expected: boolean;
  /** The upstream test file and the line of the data row or test. */
  readonly file: string;
  readonly line: number;
  readonly method: string;
}

/** Location::canAccess. */
export interface LocationCase extends CaseBase {
  readonly items: Collection;
  readonly kind: "location";
  readonly location: string;
  /** Items placed at locations for this case only: a medallion. */
  readonly locationItems?: Readonly<Record<string, string>>;
}

/** Location::fill: may `item` be placed at `location`, holding `items`? */
export interface FillCase extends CaseBase {
  readonly item: string;
  readonly items: Collection;
  readonly kind: "fill";
  readonly location: string;
}

/** Region::canEnter and Region::canComplete. */
export interface RegionCase extends CaseBase {
  readonly items: Collection;
  readonly kind: "regionComplete" | "regionEnter";
  readonly region: string;
}

/** Region::canFill: may this dungeon item be placed in the region? */
export interface RegionFillCase extends CaseBase {
  readonly config: Readonly<Record<string, boolean>>;
  readonly item: string;
  readonly kind: "regionFill";
  readonly region: string;
}

export type UpstreamCase =
  | FillCase
  | LocationCase
  | RegionCase
  | RegionFillCase;

export type CaseKind = UpstreamCase["kind"];

export interface WorldSetup {
  readonly config: Readonly<Record<string, unknown>>;
  readonly line: number;
  readonly mode: string;
}

/** One upstream test class. */
export interface Fixture {
  readonly cases: readonly UpstreamCase[];
  readonly class: string;
  readonly file: string;
  readonly generated: string;
  /** The fixture's own path, relative to FIXTURES_DIR. */
  readonly path: string;
  readonly setUp: {
    /**
     * Bosses the test sets in a region by name: "Dummy Boss" has no rule,
     * so it is always beaten (Boss.php:142-146, 177-184).
     */
    readonly bosses?: Readonly<Record<string, string>>;
    readonly collected: readonly string[];
    readonly line: number;
    readonly locationItems: Readonly<Record<string, string>>;
  };
  readonly unsupported: readonly {
    readonly line: number;
    readonly method: string;
    readonly reason: string;
    readonly rows?: readonly unknown[];
  }[];
  readonly upstream: UpstreamHeader;
  readonly worlds: Readonly<Record<string, WorldSetup>>;
}

/** app/Item.php's items and aliases, with their English names. */
export interface ItemTable {
  readonly english: Readonly<Record<string, string>>;
  readonly files: readonly string[];
  readonly items: readonly {
    readonly alias?: string;
    readonly class: string;
    readonly line: number;
    readonly name: string;
  }[];
  readonly upstream: UpstreamHeader;
}

function walk(dir: string): string[] {
  if (!statSync(dir).isDirectory()) return [dir];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** Every test class fixture, sorted by path. */
/** The tests imported, as the importer's TEST_ROOTS mirror them. */
const FIXTURE_ROOTS = [
  "NoGlitches",
  "Inverted",
  "OverworldGlitches",
  "InvertedOverworldGlitches",
  "RetroBow.json",
];

export function loadFixtures(): Fixture[] {
  return FIXTURE_ROOTS.flatMap((root) => walk(join(FIXTURES_DIR, root)))
    .filter((path) => path.endsWith(".json"))
    .sort()
    .map((path) => ({
      ...(JSON.parse(readFileSync(path, "utf8")) as Omit<Fixture, "path">),
      path: relative(FIXTURES_DIR, path).split("\\").join("/"),
    }));
}

export function loadItemTable(): ItemTable {
  return JSON.parse(
    readFileSync(join(FIXTURES_DIR, "items.json"), "utf8"),
  ) as ItemTable;
}

/** The regions of the Standard, Open and Inverted worlds and their locations. */
export interface LocationIndex {
  readonly files: readonly string[];
  readonly locations: readonly {
    readonly file: string;
    /** The upstream Location class: Chest, BigChest, Prize\Crystal… */
    readonly kind: string;
    readonly line: number;
    readonly name: string;
  }[];
  /** A location a subclass drops of its parent's (`removeItem`). */
  readonly removals: readonly {
    readonly file: string;
    readonly line: number;
    readonly name: string;
  }[];
  readonly regions: readonly {
    /** The region class this one extends, whose file builds its locations. */
    readonly extends?: string;
    readonly file: string;
    readonly line: number;
    readonly mode: string;
    readonly name: string;
  }[];
  readonly upstream: UpstreamHeader;
}

export function loadLocationIndex(): LocationIndex {
  return JSON.parse(
    readFileSync(join(FIXTURES_DIR, "locations.json"), "utf8"),
  ) as LocationIndex;
}
