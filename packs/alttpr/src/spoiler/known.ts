// The locations of the pack, by id: what a spoiler log's names must resolve
// to. A seed's world is Standard's, Open's or Inverted's, and Inverted moves
// or adds some (the Bomb Merchant), so the three together.

import { INVERTED_REGIONS } from "../worlds/inverted";
import { OPEN_REGIONS } from "../worlds/open";
import { STANDARD_REGIONS } from "../worlds/standard";

let ids: ReadonlySet<string> | undefined;

/** Every location id of the three worlds, built on first use. */
export function knownLocationIds(): ReadonlySet<string> {
  ids ??= new Set(
    [STANDARD_REGIONS, OPEN_REGIONS, INVERTED_REGIONS].flatMap((modules) =>
      modules.flatMap((module) =>
        module.regions.flatMap((region) =>
          region.locations.map((location) => location.id),
        ),
      ),
    ),
  );
  return ids;
}
