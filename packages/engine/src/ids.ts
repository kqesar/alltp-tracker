/**
 * The id of a location: its official name in lowercase kebab case, with
 * " - " as "/" and apostrophes dropped. "Tower of Hera - Big Key Chest" is
 * tower-of-hera/big-key-chest, "King's Tomb" kings-tomb.
 *
 * Ids are save keys, and the keys of shared links: every game pack names its
 * locations through this one rule, and changing it loses the checks players
 * saved.
 */
export function locationId(name: string): string {
  return name
    .split(" - ")
    .map((part) =>
      part
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .join("/");
}
