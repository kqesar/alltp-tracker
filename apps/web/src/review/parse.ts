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

/** The parser of a game's spoiler log, or null for a game with no review yet. */
const loadParser = (game: SpoilerGame): Promise<Parse> | null => {
  if (game === "alttpr") {
    return import("@alltp/pack-alttpr").then(
      ({ parseSpoiler }) => parseSpoiler,
    );
  }
  if (game === "sm") {
    // Map Rando's file is read by its slicer: a 21 MB text, 39 KB kept
    return import("@alltp/pack-sm").then(({ parseSpoiler }) => parseSpoiler);
  }
  return null;
};

/**
 * Reads a file as the game's spoiler log. Never throws on the file's
 * content: a reason not to show it is a refusal.
 */
export const parseFile = async (
  file: File,
  game: SpoilerGame,
): Promise<SpoilerResult<SpoilerLog>> => {
  const parser = loadParser(game);
  if (parser === null) return refuse("unsupported", game);
  let text: string;
  try {
    text = await file.text();
  } catch {
    return refuse("not-a-spoiler", "unreadable");
  }
  return (await parser)(text, file.name);
};
