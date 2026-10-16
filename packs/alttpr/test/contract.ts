// The contract between the pack and the upstream tests: for every case of a
// ported test file, upstream `true` must be our `yes`, and upstream `false`
// must not be: `maybe` or `no` (a sequence break or a dark room is not in
// logic, and the logic is what upstream tests).
import type { State, Tri } from "@alltp/engine";
import type { CaseKind, Fixture, UpstreamCase } from "./fixtures";
import type { Manifest } from "./manifest";
import { collectionState } from "./upstream-state";

/** The world a case runs in, as its test class set it up. */
export interface CaseWorld {
  /** `World::factory`'s config, with the case's overrides on top. */
  readonly config: Readonly<Record<string, unknown>>;
  /** Items placed at locations: the medallions of Misery Mire and Turtle Rock. */
  readonly locationItems: Readonly<Record<string, string>>;
  /** `standard` or `open`. */
  readonly mode: string;
}

/**
 * What the pack answers for each kind of case. Names are upstream's (the
 * pack finds its own ids from them). Only `location` is required: a case
 * of a kind the subject does not answer is counted as skipped.
 */
export interface ContractSubject {
  location(name: string, state: State, world: CaseWorld): Tri;
  fill?(location: string, item: string, state: State, world: CaseWorld): Tri;
  regionComplete?(region: string, state: State, world: CaseWorld): Tri;
  regionEnter?(region: string, state: State, world: CaseWorld): Tri;
  regionFill?(region: string, item: string, world: CaseWorld): Tri;
}

export interface ContractFailure {
  readonly expected: boolean;
  readonly file: string;
  readonly got: Tri;
  readonly kind: CaseKind;
  readonly line: number;
  /** The location or region, and the item for a fill. */
  readonly subject: string;
}

export interface ContractReport {
  readonly failures: readonly ContractFailure[];
  /** Cases checked, per kind. */
  readonly ran: Readonly<Record<CaseKind, number>>;
  /** Cases of ported files whose kind the subject does not answer. */
  readonly skipped: Readonly<Record<CaseKind, number>>;
  /** The test files whose cases ran: those upstream.json marks ported. */
  readonly files: readonly string[];
}

/** Upstream `true` needs `yes`; upstream `false` allows anything else. */
export function contractHolds(expected: boolean, got: Tri): boolean {
  return expected ? got === "yes" : got !== "yes";
}

const KINDS: readonly CaseKind[] = [
  "fill",
  "location",
  "regionComplete",
  "regionEnter",
  "regionFill",
];

const tally = (): Record<CaseKind, number> =>
  Object.fromEntries(KINDS.map((kind) => [kind, 0])) as Record<
    CaseKind,
    number
  >;

/** The subject's answer to a case, or undefined if it lacks that kind. */
function answer(
  subject: ContractSubject,
  c: UpstreamCase,
  fixture: Fixture,
  base: CaseWorld,
): Tri | undefined {
  if (c.kind === "regionFill") {
    const world = { ...base, config: { ...base.config, ...c.config } };
    return subject.regionFill?.(c.region, c.item, world);
  }
  const state = collectionState(c.items, fixture.setUp.collected);
  switch (c.kind) {
    case "location": {
      const world = {
        ...base,
        locationItems: { ...base.locationItems, ...c.locationItems },
      };
      return subject.location(c.location, state, world);
    }
    case "fill":
      return subject.fill?.(c.location, c.item, state, base);
    case "regionEnter":
      return subject.regionEnter?.(c.region, state, base);
    case "regionComplete":
      return subject.regionComplete?.(c.region, state, base);
  }
}

/**
 * Checks `subject` against every case of the test files `manifest` marks
 * ported, and only those: a file stays pending until the regions its cases
 * need are ported, so its cases cannot be expected to pass before.
 */
export function runUpstreamCases(
  fixtures: readonly Fixture[],
  manifest: Manifest,
  subject: ContractSubject,
): ContractReport {
  const ported = new Set(
    manifest.tests
      .filter((test) => test.status === "ported")
      .map((test) => test.file),
  );
  const ran = tally();
  const skipped = tally();
  const failures: ContractFailure[] = [];
  const files: string[] = [];
  for (const fixture of fixtures) {
    if (!ported.has(fixture.file)) continue;
    files.push(fixture.file);
    const world = fixture.worlds.world;
    if (world === undefined) {
      throw new Error(`${fixture.file}: no $this->world to run the cases in`);
    }
    const base: CaseWorld = {
      config: world.config,
      locationItems: fixture.setUp.locationItems,
      mode: world.mode,
    };
    for (const c of fixture.cases) {
      const got = answer(subject, c, fixture, base);
      if (got === undefined) {
        skipped[c.kind]++;
        continue;
      }
      ran[c.kind]++;
      if (!contractHolds(c.expected, got)) {
        const where = "location" in c ? c.location : c.region;
        failures.push({
          expected: c.expected,
          file: c.file,
          got,
          kind: c.kind,
          line: c.line,
          subject: "item" in c ? `${where} <- ${c.item}` : where,
        });
      }
    }
  }
  return { failures, files, ran, skipped };
}
