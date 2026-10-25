import type { SpoilerLog } from "./model";

/**
 * Why a spoiler log was not read or not shown. The app words each code
 * (`review/words.ts`); the package only names them.
 */
export type SpoilerError =
  /** The gate: the run is not over. */
  | "not-over"
  /** The gate: Race Mode is on. */
  | "race-mode"
  /** The file is over the game's size bound. */
  | "too-large"
  /** Binary, a ROM, or not the document a spoiler log is. */
  | "not-a-spoiler"
  /** Another randomizer's file (a game the tracker has). */
  | "other-game"
  /** A randomizer or a mode the tracker does not read (Archipelago, multiworld). */
  | "unsupported"
  /** The site withheld the spoiler (race seed, mystery). */
  | "stripped"
  /** Names or items the pack does not know: a newer randomizer. */
  | "newer-version"
  /** The file is another seed's than the run's. */
  | "seed-differs"
  /** The file's settings contradict the run's. */
  | "settings-differ";

/** The longest quoted text a refusal carries. */
export const MAX_DETAIL_LENGTH = 80;

export type Refusal = {
  readonly ok: false;
  readonly error: SpoilerError;
  /** What the code alone does not say (a key, a setting): short, never the file's text at length. */
  readonly detail?: string;
};

/** A read that worked, or the refusal. Input data never throws. */
export type SpoilerResult<T = SpoilerLog> =
  | { readonly ok: true; readonly value: T }
  | Refusal;

export function accept<T>(value: T): SpoilerResult<T> {
  return { ok: true, value };
}

/** A refusal; a quoted `detail` is cut to `MAX_DETAIL_LENGTH`. */
export function refuse(error: SpoilerError, detail?: string): Refusal {
  if (detail === undefined) return { error, ok: false };
  const cut =
    detail.length > MAX_DETAIL_LENGTH
      ? `${detail.slice(0, MAX_DETAIL_LENGTH - 1)}…`
      : detail;
  return { detail: cut, error, ok: false };
}
