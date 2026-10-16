// A seeded synthetic game for benchmarks: deterministic, so every run times
// the same world. Its shape follows a randomizer world at scale: a spanning
// tree from the start (everything reachable with enough items) plus extra
// exits that close cycles, requirements mixing items, progressive levels,
// helpers that use helpers, softened (dark room) items and crystal counts.
import type { State } from "../src/evaluate";
import { loadRules, type Rules } from "../src/rules";
import type { Location, Region, World } from "../src/world";

export interface SyntheticGame {
  readonly world: World;
  readonly rules: Rules;
  readonly items: readonly string[];
  /** A state holding each item with the given probability. */
  readonly randomState: (share: number) => State;
}

export interface SyntheticOptions {
  readonly regions?: number;
  readonly locations?: number;
  readonly extraExitsPerRegion?: number;
  readonly plainItems?: number;
  readonly helpers?: number;
  readonly seed?: number;
}

/** mulberry32: a tiny, well-mixed 32-bit PRNG. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROGRESSIVE = ["sword", "glove", "armor", "shield"];
const CRYSTALS = Array.from({ length: 7 }, (_, i) => `crystal${i + 1}`);

export function syntheticGame(options: SyntheticOptions = {}): SyntheticGame {
  const {
    extraExitsPerRegion = 2,
    helpers: helperCount = 20,
    locations: locationCount = 1000,
    plainItems = 36,
    regions: regionCount = 300,
    seed = 1,
  } = options;
  const random = prng(seed);
  const below = (n: number) => Math.floor(random() * n);
  const pick = <T>(list: readonly T[]): T => list[below(list.length)] as T;

  const plain = Array.from({ length: plainItems }, (_, i) => `item${i}`);
  const items = [...plain, ...PROGRESSIVE, ...CRYSTALS];
  const helperNames = Array.from({ length: helperCount }, (_, i) => `h${i}`);

  // An operand; `helpersBelow` limits helper references (keeps them acyclic).
  const operand = (helpersBelow: number): string => {
    const roll = random();
    if (roll < 0.45) return pick(plain);
    if (roll < 0.6) return `${pick(PROGRESSIVE)} >= ${1 + below(3)}`;
    // Dark rooms and the like: a softened item, so "maybe" shows up at
    // every stage of the game, not only while one item is missing.
    if (roll < 0.7) return `?${pick(plain)}`;
    if (roll < 0.75) return `count(crystal) >= ${1 + below(7)}`;
    if (helpersBelow > 0) return `@${helperNames[below(helpersBelow)]}`;
    return pick(plain);
  };
  // Shapes like `a`, `a & b`, `a & (b | c & d)`, `(a | b) & ?c`.
  const requirement = (helpersBelow: number): string => {
    const op = () => operand(helpersBelow);
    switch (below(5)) {
      case 0:
        return op();
      case 1:
        return `${op()} & ${op()}`;
      case 2:
        return `${op()} | ${op()}`;
      case 3:
        return `${op()} & (${op()} | ${op()} & ${op()})`;
      default:
        return `(${op()} | ${op()}) & ${op()}`;
    }
  };
  // A third of exits and locations are free, as in real worlds.
  const maybeFree = (): string | undefined =>
    random() < 0.33 ? undefined : requirement(helperCount);

  const helpers = Object.fromEntries(
    helperNames.map((name, i) => [name, requirement(i)]),
  );

  const regionIds = Array.from({ length: regionCount }, (_, i) => `r${i}`);
  const exits: { to: string; req?: string }[][] = regionIds.map(() => []);
  for (let i = 1; i < regionCount; i++) {
    exits[below(i)]?.push({ req: maybeFree(), to: regionIds[i] as string });
  }
  for (const list of exits) {
    for (let k = 0; k < extraExitsPerRegion; k++) {
      list.push({ req: maybeFree(), to: pick(regionIds) });
    }
  }
  const locations: Location[][] = regionIds.map(() => []);
  for (let l = 0; l < locationCount; l++) {
    locations[below(regionCount)]?.push({ id: `l${l}`, req: maybeFree() });
  }

  const regions: Region[] = regionIds.map((id, i) => ({
    exits: exits[i] ?? [],
    id,
    locations: locations[i] ?? [],
  }));

  const randomState = (share: number): State =>
    Object.fromEntries(
      items.map((item) => [
        item,
        PROGRESSIVE.includes(item)
          ? random() < share
            ? 1 + below(3)
            : 0
          : random() < share,
      ]),
    );

  return {
    items,
    randomState,
    rules: loadRules({ groups: { crystal: CRYSTALS }, helpers }),
    world: { regions, start: "r0" },
  };
}
