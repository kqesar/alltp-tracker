// How an SMZ3 run is packed into a shared link (share/packed.ts): its
// checked locations, each a distinct string deflate cannot predict and most
// of a late link, as a bitset over the pack's ordered locations. The link
// carries the table's size and a digest of its order, and a link made before
// the pack gained a location still reads.

import { LOCATION_IDS } from "@/games/smz3/store";
import {
  bitsetField,
  type PackCodec,
  packRun,
  type Tables,
  unpackRun,
} from "@/share/packed";

const CODEC: PackCodec = {
  at: ([locations]: Tables) => ({
    digested: [locations],
    fields: { checked: bitsetField(locations, "list") },
  }),
  game: "smz3",
  // What the table held when links carried no sizes
  legacySizes: [316],
  tables: [LOCATION_IDS],
};

/** An export as a packed link's text, for the Share action. */
export const packLink = (save: string): string => packRun(save, CODEC);

/** What an import is given: a packed link's save, or the text as it is. */
export const unpackLink = (text: string) => unpackRun(text, CODEC);
