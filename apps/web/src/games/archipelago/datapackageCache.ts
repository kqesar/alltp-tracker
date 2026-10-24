// Where the Archipelago board keeps each game's name data between visits:
// IndexedDB (`alltp-tracker-archipelago`, store `datapackages`), keyed by game
// and checksum, so a room seen before costs no download. It implements the
// package's `PackageStore` seam, and keeps each game's location groups beside
// its names: a tab that follows the connected one reads both from here.
// A browser that refuses IndexedDB (a private window, blocked site data) gets
// a cache for this page only.

import type { GamePackage, PackageStore } from "@alltp/archipelago";

export const CACHE_DB = "alltp-tracker-archipelago";
const STORE = "datapackages";

/** What the cache may hold before it drops the least recently used game. */
export const CACHE_BUDGET = 20 * 1024 * 1024;

/** A game's location groups, names only, `Everywhere` left out. */
export type LocationGroups = Readonly<Record<string, readonly string[]>>;

export interface NameCache extends PackageStore {
  getGroups(
    game: string,
    checksum: string,
  ): Promise<LocationGroups | undefined>;
  putGroups(
    game: string,
    checksum: string,
    groups: LocationGroups,
  ): Promise<void>;
}

/** One game at one checksum, as stored. */
type Entry = {
  key: string;
  game: string;
  checksum: string;
  pkg?: GamePackage;
  groups?: LocationGroups;
  /** Its size as JSON, in UTF-16 code units: what the budget counts. */
  size: number;
  usedAt: number;
};

const keyOf = (game: string, checksum: string) => `${game}\n${checksum}`;

const sizeOf = (entry: Pick<Entry, "pkg" | "groups">) =>
  JSON.stringify(entry.pkg ?? null).length +
  JSON.stringify(entry.groups ?? null).length;

/** A request's result, as a promise. */
const done = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const open = (factory: IDBFactory) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(CACHE_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // Another tab holds an older version open: give up, the memory cache serves
    request.onblocked = () => reject(new Error("The cache is blocked"));
  });

/** The entries that go so the rest fits the budget, oldest use first. */
export const evictions = (
  entries: readonly Pick<Entry, "key" | "size" | "usedAt">[],
  budget: number,
): string[] => {
  let total = entries.reduce((sum, entry) => sum + entry.size, 0);
  const gone: string[] = [];
  for (const entry of [...entries].sort((a, b) => a.usedAt - b.usedAt)) {
    if (total <= budget) break;
    total -= entry.size;
    gone.push(entry.key);
  }
  return gone;
};

/** The same cache for this page only: the fallback. */
const memoryCache = (): NameCache => {
  const entries = new Map<string, Entry>();
  const touch = (game: string, checksum: string) => {
    const key = keyOf(game, checksum);
    const entry = entries.get(key) ?? {
      checksum,
      game,
      key,
      size: 0,
      usedAt: 0,
    };
    entries.set(key, entry);
    return entry;
  };
  return {
    get: async (game, checksum) => entries.get(keyOf(game, checksum))?.pkg,
    getGroups: async (game, checksum) =>
      entries.get(keyOf(game, checksum))?.groups,
    put: async (game, pkg) => {
      touch(game, pkg.checksum).pkg = pkg;
    },
    putGroups: async (game, checksum, groups) => {
      touch(game, checksum).groups = groups;
    },
  };
};

/**
 * The name cache on IndexedDB, or in memory where IndexedDB fails.
 * @param factory - The page's IndexedDB, none where the browser has none
 * @param now - The clock that dates each use, for the eviction order
 */
export const createNameCache = (
  factory: () => IDBFactory | undefined = () => globalThis.indexedDB,
  now: () => number = Date.now,
): NameCache => {
  const memory = memoryCache();
  let database: Promise<IDBDatabase | null> | null = null;
  const db = () => {
    database ??= (async () => {
      const idb = factory();
      if (idb === undefined) return null;
      try {
        return await open(idb);
      } catch {
        return null;
      }
    })();
    return database;
  };

  /** Reads an entry, dating the use. */
  const read = async (game: string, checksum: string) => {
    const handle = await db();
    if (handle === null) return null;
    try {
      const store = handle.transaction(STORE, "readwrite").objectStore(STORE);
      const entry = (await done(store.get(keyOf(game, checksum)))) as
        | Entry
        | undefined;
      if (entry !== undefined) store.put({ ...entry, usedAt: now() });
      return entry ?? null;
    } catch {
      return null;
    }
  };

  /** Writes what changed of an entry, then drops what passes the budget. */
  const write = async (
    game: string,
    checksum: string,
    change: Pick<Entry, "pkg"> | Pick<Entry, "groups">,
  ) => {
    const handle = await db();
    if (handle === null) return false;
    try {
      const store = handle.transaction(STORE, "readwrite").objectStore(STORE);
      const key = keyOf(game, checksum);
      const before = (await done(store.get(key))) as Entry | undefined;
      const merged = { ...before, ...change };
      const entry: Entry = {
        ...merged,
        checksum,
        game,
        key,
        size: sizeOf(merged),
        usedAt: now(),
      };
      store.put(entry);
      const all = (await done(store.getAll())) as Entry[];
      for (const gone of evictions(all, CACHE_BUDGET)) {
        if (gone !== key) store.delete(gone);
      }
      return true;
    } catch {
      return false;
    }
  };

  return {
    get: async (game, checksum) =>
      (await read(game, checksum))?.pkg ?? memory.get(game, checksum),
    getGroups: async (game, checksum) =>
      (await read(game, checksum))?.groups ?? memory.getGroups(game, checksum),
    put: async (game, pkg) => {
      if (!(await write(game, pkg.checksum, { pkg }))) {
        await memory.put(game, pkg);
      }
    },
    putGroups: async (game, checksum, groups) => {
      if (!(await write(game, checksum, { groups }))) {
        await memory.putGroups(game, checksum, groups);
      }
    },
  };
};

/** The page's cache: one per page, shared by the session and the board. */
export const nameCache = createNameCache();
