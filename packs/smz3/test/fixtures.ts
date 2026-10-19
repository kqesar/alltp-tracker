// Loads the fixtures scripts/import-upstream-tests.mjs writes under
// test/upstream/: the four logic test fixtures, and the regions and
// locations of upstream's region files.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const FIXTURES_DIR = fileURLToPath(new URL("upstream", import.meta.url));

/** What one skip of a case changes: item counts, or a placement removed. */
export interface Skip {
  readonly items?: Readonly<Record<string, number>>;
  readonly unplace?: string;
}

/**
 * A case: a region (World.CanEnter) or a location (Location.CanAccess),
 * what it arranges, which must reach it, and each skip, which must not.
 */
export interface UpstreamCase {
  readonly region?: string;
  readonly location?: string;
  /** Upstream item type to count. */
  readonly items: Readonly<Record<string, number>>;
  /** Upstream location name to the item type placed there. */
  readonly placed?: Readonly<Record<string, string>>;
  readonly without: readonly Skip[];
}

export interface FixtureHeader {
  readonly commit: string;
  readonly file: string;
  readonly keysanity: boolean;
  readonly logic: "normal" | "hard";
  /** Items every case holds besides its own: the keycards, without keysanity. */
  readonly always?: readonly string[];
}

export interface Fixture {
  readonly header: FixtureHeader;
  readonly cases: readonly UpstreamCase[];
}

export const FIXTURE_NAMES = [
  "SMNormal",
  "SMHard",
  "SMNormalKeysanity",
  "SMHardKeysanity",
] as const;

export type FixtureName = (typeof FIXTURE_NAMES)[number];

const read = <T>(file: string): T =>
  JSON.parse(readFileSync(`${FIXTURES_DIR}/${file}`, "utf8")) as T;

export const loadFixture = (name: FixtureName): Fixture =>
  read<Fixture>(`${name}.json`);

/** A region file as upstream writes it: its region, CanEnter and locations. */
export interface UpstreamRegion {
  readonly file: string;
  readonly name: string;
  /** The line of its CanEnter; none when it keeps Region's. */
  readonly canEnter?: number;
  readonly locations: readonly {
    /** Upstream's id: a Super Metroid item's bit, Zelda's 256 and up. */
    readonly id: number;
    readonly line: number;
    readonly name: string;
  }[];
}

export const loadRegions = (): readonly UpstreamRegion[] =>
  read<{ regions: UpstreamRegion[] }>("regions.json").regions;
