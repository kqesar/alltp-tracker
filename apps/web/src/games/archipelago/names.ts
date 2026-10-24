// The slot's game's names and location groups, for the checks list: never
// saved or published (the run holds item names already). The tab connected to
// the room gets them from the server, through the session; a tab that follows
// it reads them from the name cache, where the connected tab left them.

import { type NameData, nameData, parseGamePackage } from "@alltp/archipelago";
import { create } from "zustand";
import {
  type LocationGroups,
  type NameCache,
  nameCache,
} from "@/games/archipelago/datapackageCache";
import type { ApRoom } from "@/games/archipelago/store";

type NamesState = {
  names: NameData | null;
  groups: LocationGroups | null;
};

export const useApNamesStore = create<NamesState>()(() => ({
  groups: null,
  names: null,
}));

/**
 * Read the room's names and groups from the cache, unless this page has them
 * already (for this game and checksum).
 * @param room - The run's room: its game and checksum
 * @param cache - The name cache
 */
export const loadCachedNames = async (
  room: Pick<ApRoom, "checksum" | "game">,
  cache: NameCache = nameCache,
) => {
  const { checksum, game } = room;
  if (checksum === null) return;
  const { groups, names } = useApNamesStore.getState();
  const current = names?.game === game && names.checksum === checksum;
  if (current && groups !== null) return;
  const [pkg, cachedGroups] = await Promise.all([
    current ? null : cache.get(game, checksum),
    cache.getGroups(game, checksum),
  ]);
  const parsed = parseGamePackage(pkg);
  // Another game's names and groups never stay beside this one's
  useApNamesStore.setState((state) => ({
    groups: cachedGroups ?? (current ? state.groups : null),
    names:
      parsed !== null ? nameData(game, parsed) : current ? state.names : null,
  }));
};
