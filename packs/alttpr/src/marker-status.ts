// What a map marker shows for the locations it stands for: the one rule
// every game's map follows, kept apart from ALttPR's markers so another
// pack's map takes it without ALttPR's world.
import type { Tri } from "@alltp/engine";

/** What a marker shows. */
export type MarkerStatus = "available" | "possible" | "unavailable";

/**
 * What a marker shows for the tris of the locations it still stands for
 * (those not checked yet): available when all are `yes`, possible when
 * some are `yes` or `maybe`, unavailable when none is. With none left the
 * marker is done, which the app shows on its own: unavailable here.
 */
export function markerStatus(tris: readonly Tri[]): MarkerStatus {
  if (tris.length > 0 && tris.every((t) => t === "yes")) return "available";
  return tris.some((t) => t !== "no") ? "possible" : "unavailable";
}
