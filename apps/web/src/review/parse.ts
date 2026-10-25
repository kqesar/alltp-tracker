// Turns a file the player picked into a spoiler log: decode it, hand it to the
// game's pack. It runs in the review worker (`spoiler.worker.ts`) or, where
// there is no Worker, in place (`read.ts`). Each game's parser is a chunk of
// its own, loaded only when a file of that game is read.

import {
  refuse,
  type SpoilerGame,
  type SpoilerLog,
  type SpoilerResult,
} from "@alltp/spoiler";

type Parse = (text: string, fileName: string) => SpoilerResult<SpoilerLog>;

/** Each game's parser, loaded on first use. */
const PARSERS: Record<SpoilerGame, () => Promise<Parse>> = {
  alttpr: () =>
    import("@alltp/pack-alttpr").then(({ parseSpoiler }) => parseSpoiler),
  // Map Rando's file is read by its slicer: a 21 MB text, 39 KB kept
  sm: () => import("@alltp/pack-sm").then(({ parseSpoiler }) => parseSpoiler),
  // The parser's own entry, not the pack's: js-yaml travels with this chunk
  // and no other, where the pack's index would pull it into the board's
  smz3: () =>
    import("@alltp/pack-smz3/spoiler").then(({ parseSpoiler }) => parseSpoiler),
};

/**
 * Reads a file as the game's spoiler log. Never throws on the file's
 * content: a reason not to show it is a refusal.
 */
export const parseFile = async (
  file: File,
  game: SpoilerGame,
): Promise<SpoilerResult<SpoilerLog>> => {
  // The game crosses the worker's message: a name off the table is refused
  if (!Object.hasOwn(PARSERS, game)) return refuse("unsupported", game);
  const parser = PARSERS[game]();
  let text: string;
  try {
    text = await file.text();
  } catch {
    return refuse("not-a-spoiler", "unreadable");
  }
  return (await parser)(text, file.name);
};
