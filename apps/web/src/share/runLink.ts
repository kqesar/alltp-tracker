// A run shared through an address: the export's JSON, compressed and put in
// the URL's fragment (`#run=…`). A fragment is read by the browser and never
// sent to any server, which is what lets a run travel with no backend. What
// comes back from a link is data from outside the page: it is bounded here,
// and checked by each game's own import before it touches a run.

import * as z from "zod/mini";
import { GAME_IDS, type GameId } from "@/games/registry";
import { BASE64URL, fromBase64Url, toBase64Url } from "@/share/bytes";
import { LINK_FORMAT, SAVE_FORMAT } from "@/share/packed";

/** The fragment's key: `#run=<base64url of the deflated export>`. */
const FRAGMENT_KEY = "run";

/** The longest payload read from an address; a real run is a tenth of it. */
export const MAX_PAYLOAD_CHARS = 64 * 1024;

/** The most a payload may inflate to; a deflate bomb stops here. */
export const MAX_RUN_BYTES = 1024 * 1024;

/** Why a link could not be made or read. */
export type RunLinkFailure = "unsupported" | "too-large" | "malformed";

/** A link that cannot be made or read; its message is for the player. */
export class RunLinkError extends Error {
  override readonly name = "RunLinkError";
  constructor(readonly failure: RunLinkFailure) {
    super(MESSAGES[failure]);
  }
}

const MESSAGES: Readonly<Record<RunLinkFailure, string>> = {
  malformed: "This link does not hold a tracker run.",
  "too-large": "This link holds more than a run can.",
  unsupported: "This browser cannot turn a run into a link.",
};

/** The browser's deflate, or why not (a browser from before 2023). */
const streamOf = (kind: "compress" | "decompress") => {
  if (typeof CompressionStream === "undefined") {
    throw new RunLinkError("unsupported");
  }
  return kind === "compress"
    ? new CompressionStream("deflate-raw")
    : new DecompressionStream("deflate-raw");
};

/** Push bytes through a stream and gather what comes out, up to `limit`. */
const pipe = async (
  input: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
  limit: number,
): Promise<Uint8Array<ArrayBuffer>> => {
  const writer = stream.writable.getWriter();
  // A write that fails (data that is not deflate) surfaces on the reader
  void writer
    .write(input)
    .then(() => writer.close())
    .catch(() => undefined);
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      void reader.cancel().catch(() => undefined);
      throw new RunLinkError("too-large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
};

/**
 * A run's export, as a link's payload: minified, deflated, base64url.
 * @param save - What the game's export writes (JSON)
 */
export const encodeRun = async (save: string): Promise<string> => {
  const minified = JSON.stringify(JSON.parse(save));
  const bytes = new TextEncoder().encode(minified);
  return toBase64Url(await pipe(bytes, streamOf("compress"), MAX_RUN_BYTES));
};

/**
 * The export a payload holds. Bounded twice, on the payload and on what it
 * inflates to, so a hostile fragment costs neither more than a moment of
 * CPU nor more than a megabyte; anything that is not deflated text is
 * refused as not a run's.
 * @param payload - What follows `#run=`
 */
export const decodeRun = async (payload: string): Promise<string> => {
  if (payload.length > MAX_PAYLOAD_CHARS) throw new RunLinkError("too-large");
  if (!BASE64URL.test(payload)) throw new RunLinkError("malformed");
  let inflated: Uint8Array<ArrayBuffer>;
  try {
    inflated = await pipe(
      fromBase64Url(payload),
      streamOf("decompress"),
      MAX_RUN_BYTES,
    );
  } catch (error) {
    throw error instanceof RunLinkError ? error : new RunLinkError("malformed");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(inflated);
  } catch {
    throw new RunLinkError("malformed");
  }
};

const envelope = z.object({
  format: z.literal([SAVE_FORMAT, LINK_FORMAT]),
  game: z.enum(GAME_IDS),
});

/**
 * The game a shared export is of, read from its envelope alone: the game's
 * own import then checks the rest. Null for anything that is not a tracker
 * save naming one of the games.
 */
export const gameOfSave = (save: string): GameId | null => {
  try {
    const parsed = envelope.safeParse(JSON.parse(save));
    return parsed.success ? parsed.data.game : null;
  } catch {
    return null;
  }
};

/**
 * The payload of a `#run=…` fragment, or null when the address holds none.
 * @param hash - The address's fragment, `window.location.hash` by default
 */
export const sharedPayload = (
  hash: string = window.location.hash,
): string | null => new URLSearchParams(hash.slice(1)).get(FRAGMENT_KEY);

/** A page's address with a payload as its fragment. */
export const runLinkUrl = (page: string, payload: string): string => {
  const url = new URL(page);
  url.hash = `${FRAGMENT_KEY}=${payload}`;
  return url.href;
};

/** Take the shared run out of the address bar, the page and its query kept. */
export const clearSharedRun = (): void => {
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", pathname + search);
};
