// The id of the seed a run was played on, as its game's ROM states it: the
// seed's hash (ALttPR, alttpr.com's), its name (Super Metroid, Map Rando's)
// or its guid (SMZ3, samus.link's). Kept on the run (`seed`, null when
// unknown) so a later look at the run knows which seed it belongs to, and
// so autotracking can tell a ROM of another seed from the run's (`checkRomSeed`).
// Text from outside the page, a save or a shared link, is held to this shape.

/** Printable ASCII, 1 to 64 characters: every id the three generators write. */
export const SEED_ID = /^[\x20-\x7e]{1,64}$/;

/** Whether a value is a seed id. */
export const isSeedId = (value: unknown): value is string =>
  typeof value === "string" && SEED_ID.test(value);

/** A run's store, as far as recording its seed goes. */
type SeedStore<Run extends { seed: string | null }> = {
  getState: () => Run & {
    applyGameNews: (change: (run: Run) => Partial<Run> | null) => void;
  };
};

/**
 * Record the seed the game says it is on as the run's, when that differs from
 * the run's: news of the game's, so no undo step. The history gets it too, but
 * for the snapshots of another seed (a run before a seed switch, which undoing
 * gives back as it was).
 * @param store - The game's run store
 * @param seed - The seed the ROM names, or null when it names none
 */
export const recordSeed = <Run extends { seed: string | null }>(
  store: SeedStore<Run>,
  seed: string | null,
): void => {
  const before = store.getState().seed;
  if (seed === null || seed === before) return;
  store
    .getState()
    .applyGameNews((run) =>
      run.seed === before ? ({ seed } as Partial<Run>) : null,
    );
};

/**
 * What autotracking says of the ROM it reads against the run's seed, when
 * there is something to say: the ROM names another seed than the run's, or
 * Race Mode keeps the check off.
 */
export type RomSeedCheck =
  /** Both are known and differ: the board does not follow this ROM. */
  | { readonly kind: "differs"; readonly run: string; readonly rom: string }
  /**
   * Race Mode is on and the run knows its seed: the check is off. Super
   * Metroid's and SMZ3's Race Mode never read the seed's name or guid, and
   * ALttPR's, which reads the header to know the game, shows no seed (the
   * race rules v2.0 let a tracker show only what they list).
   */
  | { readonly kind: "race" };

/** Two ids name the same seed when equal, unless the game knows better. */
const equalIds = (a: string, b: string) => a === b;

/**
 * Hold the seed the ROM names against the run's. Nothing is said while either
 * is unknown (a run tracked by hand, a ROM that names none), nor when they
 * are the same seed.
 * @param run - The run's seed, null while unknown
 * @param rom - The seed the ROM names, null when it names none or was not read
 * @param race - Whether the reading was in Race Mode: the check is then off
 * @param same - Whether two ids name the same seed, for a game whose ids
 * take more than one form (a Door Randomizer seed's)
 */
export const checkRomSeed = (
  run: string | null,
  rom: string | null,
  race: boolean,
  same: (run: string, rom: string) => boolean = equalIds,
): RomSeedCheck | null => {
  if (run === null) return null;
  if (race) return { kind: "race" };
  if (rom === null || same(run, rom)) return null;
  return { kind: "differs", rom, run };
};

/** What the board and the autotracking dialog say of a check. */
export const romSeedText = (check: RomSeedCheck): string =>
  check.kind === "race"
    ? "Race Mode: the tracker does not check that the game is this run's seed."
    : `The game runs seed ${check.rom}, not this run's seed ${check.run}: the board does not follow it. Start a new run from this ROM, or ignore this to follow it on this run.`;
