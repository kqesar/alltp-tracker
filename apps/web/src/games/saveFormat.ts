// The file a game's Export writes and its Import reads, for the games whose
// run is a `zod/mini` schema (Super Metroid, SMZ3). The decision chain is the
// same; each game gives its schema and its pool check.

import * as z from "zod/mini";

const envelope = z.object({
  format: z.literal("alltp-tracker-save"),
  game: z.string(),
  progress: z.unknown(),
  version: z.number(),
});

/** Why a file cannot be imported, in words the player can act on. */
export type ImportError =
  | "not-json"
  | "not-a-save"
  | "other-game"
  | "newer-version"
  | "invalid";

/** What each reason says to the player. */
const IMPORT_ERRORS: Readonly<Record<ImportError, string>> = {
  invalid: "This save's run is not one the tracker can read.",
  "newer-version": "This save comes from a newer version of the tracker.",
  "not-a-save": "This file is not a tracker save.",
  "not-json": "This file is not a tracker save.",
  "other-game":
    "This save is for another game: switch game to import it there.",
};

/** A game's save file: what `createSaveFormat` makes. */
export type SaveFormat<P extends object> = ReturnType<
  typeof createSaveFormat<P>
>;

/**
 * Export and Import for a game's run.
 * @param game - The game's id, written in the file and checked on import
 * @param version - Bumped when the run changes shape
 * @param schema - The run's shape: a file is data from outside the page, so an
 * import is checked against it before it reaches the store
 * @param progressOf - Picks the run out of a store's state, never the undo
 * history beside it
 * @param complete - A run whose items the file left out, from an older pool,
 * held at 0
 * @param within - Whether every count is within its item's pool
 */
export const createSaveFormat = <P extends object>({
  complete,
  game,
  progressOf,
  schema,
  version,
  within,
}: {
  complete: (progress: P) => P;
  game: string;
  progressOf: (state: P) => P;
  schema: z.ZodMiniType<P>;
  version: number;
  within: (progress: P) => boolean;
}) => ({
  /**
   * The file an export writes: the run alone. It takes the store's state as
   * it is, so the run is picked out of it.
   */
  exportSave: (progress: P): string =>
    `${JSON.stringify(
      {
        format: "alltp-tracker-save",
        game,
        progress: progressOf(progress),
        version,
      },
      null,
      2,
    )}\n`,
  IMPORT_ERRORS,
  /**
   * A save file's run, or why not: not JSON, not a tracker save, another
   * game's, a version this one does not know, or a run that is not one.
   */
  parseSave: (
    text: string,
  ): { ok: true; progress: P } | { ok: false; error: ImportError } => {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { error: "not-json", ok: false };
    }
    const save = envelope.safeParse(json);
    if (!save.success) return { error: "not-a-save", ok: false };
    if (save.data.game !== game) return { error: "other-game", ok: false };
    if (save.data.version > version) {
      return { error: "newer-version", ok: false };
    }
    const progress = schema.safeParse(save.data.progress);
    if (!progress.success || !within(progress.data)) {
      return { error: "invalid", ok: false };
    }
    return { ok: true, progress: complete(progress.data) };
  },
});
