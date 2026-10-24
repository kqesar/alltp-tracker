// The slot's own locations as the checks list shows them: by the world's
// location groups (AP's `location_name_groups`, `Everywhere` left out), each
// location checked or not as the server states it. No logic: nothing here
// says what the player can reach.

import type { NameData } from "@alltp/archipelago";
import type { LocationGroups } from "@/games/archipelago/datapackageCache";

export type CheckRow = {
  readonly id: number;
  readonly name: string;
  readonly checked: boolean;
};

export type CheckZone = {
  readonly name: string;
  readonly rows: readonly CheckRow[];
};

/** Where the locations no group holds go, or every location without groups. */
export const OTHER_ZONE = "Other locations";
export const ALL_ZONE = "Locations";

/**
 * The slot's locations by group, in the order the world lists its groups; a
 * location may sit in several. Those in no group come last.
 * @param names - The world's names; none yet means no rows
 * @param groups - Its location groups; none means one zone of every location
 */
export const checkZones = (
  checked: readonly number[],
  missing: readonly number[],
  names: NameData | null,
  groups: LocationGroups | null,
): CheckZone[] => {
  if (names === null) return [];
  const done = new Set(checked);
  const row = (id: number): CheckRow => ({
    checked: done.has(id),
    id,
    name: names.locations.get(id) ?? `Location ${id}`,
  });
  const own = [...checked, ...missing].sort((a, b) => a - b);
  if (groups === null) {
    return [{ name: ALL_ZONE, rows: own.map(row) }];
  }
  const ownSet = new Set(own);
  const placed = new Set<number>();
  const zones: CheckZone[] = [];
  for (const [name, locations] of Object.entries(groups)) {
    const rows: CheckRow[] = [];
    for (const location of locations) {
      const id = names.locationIds.get(location);
      if (id === undefined || !ownSet.has(id)) continue;
      placed.add(id);
      rows.push(row(id));
    }
    if (rows.length > 0) zones.push({ name, rows });
  }
  const rest = own.filter((id) => !placed.has(id));
  if (rest.length > 0) zones.push({ name: OTHER_ZONE, rows: rest.map(row) });
  return zones;
};

/**
 * The zones as the list shows them: rows whose name (or zone's) holds the
 * filter's words, the checked ones hidden on request; empty zones dropped.
 */
export const visibleZones = (
  zones: readonly CheckZone[],
  filter: string,
  hideChecked: boolean,
): CheckZone[] => {
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (text: string) =>
    words.every((word) => text.toLowerCase().includes(word));
  return zones
    .map((zone) => ({
      name: zone.name,
      rows: zone.rows.filter(
        (row) =>
          !(hideChecked && row.checked) && matches(`${zone.name} ${row.name}`),
      ),
    }))
    .filter((zone) => zone.rows.length > 0);
};
