// Reads a spoiler log the player picked, on the device: no request is made.
// The size is checked on `file.size` before a byte is read, the parse runs in
// a Web Worker that is terminated after the one file (the page never holds
// the text), and where there is no Worker (jsdom) the same parse runs in
// place. A read that never answers ends after `TIMEOUT_MS`.

import {
  checkSize,
  refuse,
  type SpoilerGame,
  type SpoilerLog,
  type SpoilerResult,
} from "@alltp/spoiler";
import { parseFile } from "@/review/parse";

/** How long a worker may take before the read is given up. */
export const TIMEOUT_MS = 30_000;

/** The minimum of a worker the page drives: a seam for tests. */
export type ReviewWorker = {
  postMessage: (message: { file: File; game: SpoilerGame }) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent<SpoilerResult>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

/** A review worker. Written inline: Vite bundles a worker from this exact form. */
const createWorker = (): ReviewWorker =>
  new Worker(new URL("./spoiler.worker.ts", import.meta.url), {
    type: "module",
  });

/** What a read may be handed instead of the defaults, for specs. */
export type ReadOptions = {
  /** Makes the worker; `null` reads in place. Defaults to a real one where `Worker` exists. */
  worker?: (() => ReviewWorker) | null;
  timeoutMs?: number;
};

/**
 * @param file - The file the player picked: untrusted
 * @param game - The game whose spoiler log it should be
 */
export const readSpoiler = async (
  file: File,
  game: SpoilerGame,
  options: ReadOptions = {},
): Promise<SpoilerResult<SpoilerLog>> => {
  const tooLarge = checkSize(game, file.size);
  if (tooLarge !== null) return tooLarge;
  const make =
    options.worker === undefined
      ? typeof Worker === "undefined"
        ? null
        : createWorker
      : options.worker;
  if (make === null) return parseFile(file, game);

  const worker = make();
  return new Promise((resolve) => {
    const done = (result: SpoilerResult<SpoilerLog>) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(result);
    };
    const timer = setTimeout(
      () => done(refuse("not-a-spoiler", "timed out")),
      options.timeoutMs ?? TIMEOUT_MS,
    );
    worker.onmessage = (event) => done(event.data);
    worker.onerror = () => done(refuse("not-a-spoiler", "unreadable"));
    worker.postMessage({ file, game });
  });
};
