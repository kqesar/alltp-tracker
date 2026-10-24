// Name data: AP sends ids, and each game's data package turns them into
// item and location names. Packages are fetched lazily, one game at a time,
// only for the games the board needs, and kept by checksum in a store the
// app provides (IndexedDB), so a room seen before costs no download.
//
// Location groups ("Desert Palace", "Light World"…) are not in the
// websocket data package: they come from the server's data storage
// (`_read_location_name_groups_<game>`, README "Name data").

import type { ApSnapshot } from "./snapshot";

/** One game's data package, as GetDataPackage returns it. */
export interface GamePackage {
  readonly checksum: string;
  readonly item_name_to_id: Readonly<Record<string, number>>;
  readonly location_name_to_id: Readonly<Record<string, number>>;
}

/** A game's names by id, both ways. */
export interface NameData {
  readonly game: string;
  readonly checksum: string;
  readonly items: ReadonlyMap<number, string>;
  readonly locations: ReadonlyMap<number, string>;
  readonly itemIds: ReadonlyMap<string, number>;
  readonly locationIds: ReadonlyMap<string, number>;
}

/** Where packages are kept between visits: the app's IndexedDB cache. */
export interface PackageStore {
  get(game: string, checksum: string): Promise<GamePackage | undefined>;
  put(game: string, pkg: GamePackage): Promise<void>;
}

/** A store that keeps packages for this page only: the fallback, and tests'. */
export function memoryStore(): PackageStore & { readonly size: number } {
  const packages = new Map<string, GamePackage>();
  const key = (game: string, checksum: string) => `${game}\n${checksum}`;
  return {
    get: async (game, checksum) => packages.get(key(game, checksum)),
    put: async (game, pkg) => {
      packages.set(key(game, pkg.checksum), pkg);
    },
    get size() {
      return packages.size;
    },
  };
}

function idTable(value: unknown): Record<string, number> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  for (const id of Object.values(value)) {
    if (!Number.isInteger(id)) return null;
  }
  return value as Record<string, number>;
}

/** A package from the network or a cache, checked; null when malformed. */
export function parseGamePackage(value: unknown): GamePackage | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const items = idTable(record.item_name_to_id);
  const locations = idTable(record.location_name_to_id);
  if (items === null || locations === null) return null;
  if (typeof record.checksum !== "string" || record.checksum === "") {
    return null;
  }
  return {
    checksum: record.checksum,
    item_name_to_id: items,
    location_name_to_id: locations,
  };
}

export function nameData(game: string, pkg: GamePackage): NameData {
  const itemIds = new Map(Object.entries(pkg.item_name_to_id));
  const locationIds = new Map(Object.entries(pkg.location_name_to_id));
  return {
    checksum: pkg.checksum,
    game,
    itemIds,
    items: new Map([...itemIds].map(([name, id]) => [id, name])),
    locationIds,
    locations: new Map([...locationIds].map(([name, id]) => [id, name])),
  };
}

export class NameDataError extends Error {
  override readonly name = "NameDataError";
}

export interface NameDataLoaderOptions {
  readonly store: PackageStore;
  /** One game's package from the server: `session.getDataPackage`. */
  readonly fetch: (game: string) => Promise<unknown>;
}

/**
 * Loads name data per game and checksum: from memory, then the store, then
 * the server. A package whose checksum is not the one the room announced is
 * used (names beat ids) but stored under its own checksum, so the next
 * visit asks again.
 */
export class NameDataLoader {
  private readonly store: PackageStore;
  private readonly fetchPackage: (game: string) => Promise<unknown>;
  private readonly loaded = new Map<string, Promise<NameData>>();

  constructor(options: NameDataLoaderOptions) {
    this.store = options.store;
    this.fetchPackage = options.fetch;
  }

  /** `checksum`: what RoomInfo announced for the game, if anything. */
  load(game: string, checksum: string | undefined): Promise<NameData> {
    const key = `${game}\n${checksum ?? ""}`;
    let pending = this.loaded.get(key);
    if (pending === undefined) {
      pending = this.fetchOnce(game, checksum);
      // A failure is not remembered: the next call tries again.
      pending.catch(() => this.loaded.delete(key));
      this.loaded.set(key, pending);
    }
    return pending;
  }

  private async fetchOnce(
    game: string,
    checksum: string | undefined,
  ): Promise<NameData> {
    if (checksum !== undefined) {
      const cached = parseGamePackage(await this.store.get(game, checksum));
      if (cached !== null && cached.checksum === checksum) {
        return nameData(game, cached);
      }
    }
    const pkg = parseGamePackage(await this.fetchPackage(game));
    if (pkg === null) {
      throw new NameDataError(`The server sent no usable names for ${game}`);
    }
    await this.store.put(game, pkg);
    return nameData(game, pkg);
  }
}

/**
 * The games whose names the board needs: the slot's own (its items and
 * locations), plus, with `senders`, the games of the slots that sent it
 * items (where each was found).
 */
export function neededGames(
  snapshot: ApSnapshot,
  options: { readonly senders?: boolean } = {},
): string[] {
  const own = snapshot.identity?.game;
  const games = new Set<string>(own === undefined ? [] : [own]);
  if (options.senders) {
    const gameOf = new Map(snapshot.players.map((p) => [p.slot, p.game]));
    for (const item of snapshot.items) {
      const game = gameOf.get(item.player);
      if (game !== undefined && game !== "") games.add(game);
    }
  }
  return [...games];
}

/** The data storage key holding a game's location groups. */
export function locationGroupsKey(game: string): string {
  return `_read_location_name_groups_${game}`;
}

/** AP's catch-all group, every location of the game: not a group to show. */
export const EVERYWHERE = "Everywhere";

/**
 * A game's location groups from the server's data storage, without
 * "Everywhere"; names only, as the server holds them.
 */
export async function loadLocationGroups(
  game: string,
  get: (keys: readonly string[]) => Promise<Record<string, unknown>>,
): Promise<Record<string, readonly string[]>> {
  const key = locationGroupsKey(game);
  const value = (await get([key]))[key];
  const groups: Record<string, readonly string[]> = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return groups;
  }
  for (const [group, names] of Object.entries(value)) {
    if (group === EVERYWHERE || !Array.isArray(names)) continue;
    groups[group] = names.filter((name) => typeof name === "string");
  }
  return groups;
}
