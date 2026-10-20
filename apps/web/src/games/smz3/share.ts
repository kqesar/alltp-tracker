// How an SMZ3 run is packed into a shared link (share/packed.ts): its
// checked locations, each a distinct string deflate cannot predict and most
// of a late link, as a bitset over the pack's ordered locations. The link
// carries a digest of that order.

import { LOCATION_IDS } from "@/games/smz3/store";
import {
  bitsetField,
  type PackCodec,
  packRun,
  unpackRun,
} from "@/share/packed";

const CODEC: PackCodec = {
  fields: { checked: bitsetField(LOCATION_IDS, "list") },
  game: "smz3",
  tables: [LOCATION_IDS],
};

/** An export as a packed link's text, for the Share action. */
export const packLink = (save: string): string => packRun(save, CODEC);

/** What an import is given: a packed link's save, or the text as it is. */
export const unpackLink = (text: string) => unpackRun(text, CODEC);
