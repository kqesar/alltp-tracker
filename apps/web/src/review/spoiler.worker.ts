// The Web Worker that reads a spoiler log, so that decoding a file and parsing
// it (21 MB for Map Rando's) never touches the page's heap or its frames. It
// answers one message with one result and is terminated by `read.ts`. The
// file arrives as a `File` handle: cloning it copies nothing.

import type { SpoilerGame, SpoilerResult } from "@alltp/spoiler";
import { parseFile } from "@/review/parse";

/** What the page posts. */
export type ReadRequest = { readonly file: File; readonly game: SpoilerGame };

/** The part of a worker's global scope this module uses. */
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ReadRequest>) => void) | null;
  postMessage: (message: SpoilerResult) => void;
};

scope.onmessage = (event) => {
  const { file, game } = event.data;
  void parseFile(file, game).then((result) => scope.postMessage(result));
};
