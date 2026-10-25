import type { SpoilerGame } from "./model";
import { type Refusal, refuse } from "./result";

const MIB = 1024 * 1024;

/**
 * The largest file read, per game, checked on `file.size` before anything is
 * read. ALttPR's log is 20-80 KB and SMZ3's 20-70 KB; Map Rando's is about
 * 21 MB (its `game_data` is the whole of sm-json-data), so it gets room.
 */
export const MAX_SPOILER_BYTES: Readonly<Record<SpoilerGame, number>> = {
  alttpr: MIB,
  sm: 64 * MIB,
  smz3: MIB,
};

/** How much of a file `sniffSpoiler` needs: the head tells the randomizer. */
export const SNIFF_HEAD_LENGTH = 4096;

/** The deepest nesting `sliceTopLevel` follows; real logs stay under 20. */
export const MAX_SLICE_DEPTH = 256;

/** A refusal when `bytes` is over the game's bound, else null. */
export function checkSize(game: SpoilerGame, bytes: number): Refusal | null {
  const max = MAX_SPOILER_BYTES[game];
  if (bytes <= max) return null;
  return refuse("too-large", `${Math.round(max / MIB)} MiB`);
}
