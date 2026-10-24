import type { GamePackage } from "@alltp/archipelago";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import {
  CACHE_BUDGET,
  CACHE_DB,
  createNameCache,
  evictions,
} from "@/games/archipelago/datapackageCache";

const pkg = (checksum: string, filler = 0): GamePackage => ({
  checksum,
  item_name_to_id: { Hookshot: 10, ...(filler ? { pad: filler } : {}) },
  location_name_to_id: {
    "Link's House": 1,
    ...(filler ? { ["x".repeat(filler)]: 2 } : {}),
  },
});

describe("the name cache on IndexedDB", () => {
  it("keeps a game's names and groups by checksum, across pages", async () => {
    const factory = new IDBFactory();
    const cache = createNameCache(() => factory);
    expect(await cache.get("A Link to the Past", "abc")).toBeUndefined();
    await cache.put("A Link to the Past", pkg("abc"));
    await cache.putGroups("A Link to the Past", "abc", {
      "Light World": ["Link's House"],
    });
    // Another page of the same browser
    const later = createNameCache(() => factory);
    expect(await later.get("A Link to the Past", "abc")).toEqual(pkg("abc"));
    expect(await later.getGroups("A Link to the Past", "abc")).toEqual({
      "Light World": ["Link's House"],
    });
    expect(await later.get("A Link to the Past", "other")).toBeUndefined();
    expect(await later.getGroups("SMZ3", "abc")).toBeUndefined();
  });

  it("drops the least recently used game past its budget", async () => {
    const factory = new IDBFactory();
    let now = 0;
    const cache = createNameCache(
      () => factory,
      () => now++,
    );
    const big = Math.ceil(CACHE_BUDGET / 2);
    await cache.put("Old", pkg("1", big));
    await cache.put("Used", pkg("2", big / 4));
    await cache.get("Old", "1");
    await cache.get("Used", "2");
    await cache.put("New", pkg("3", big));
    expect(await cache.get("Old", "1")).toBeUndefined();
    expect(await cache.get("Used", "2")).toBeDefined();
    expect(await cache.get("New", "3")).toBeDefined();
  });
});

describe("evictions", () => {
  it("go oldest first until the rest fits", () => {
    expect(
      evictions(
        [
          { key: "a", size: 5, usedAt: 3 },
          { key: "b", size: 5, usedAt: 1 },
          { key: "c", size: 5, usedAt: 2 },
        ],
        10,
      ),
    ).toEqual(["b"]);
    expect(evictions([{ key: "a", size: 5, usedAt: 1 }], 10)).toEqual([]);
  });
});

describe("without IndexedDB", () => {
  it("keeps names for this page only", async () => {
    const cache = createNameCache(() => undefined);
    await cache.put("SMZ3", pkg("abc"));
    await cache.putGroups("SMZ3", "abc", { Crateria: [] });
    expect(await cache.get("SMZ3", "abc")).toEqual(pkg("abc"));
    expect(await cache.getGroups("SMZ3", "abc")).toEqual({ Crateria: [] });
    expect(await createNameCache(() => undefined).get("SMZ3", "abc")).toBe(
      undefined,
    );
  });

  it("falls back when IndexedDB refuses to open", async () => {
    const refusing = {
      open: () => {
        const request = {} as IDBOpenDBRequest;
        queueMicrotask(() =>
          (request.onerror as (() => void) | null)?.call(request),
        );
        return request;
      },
    } as unknown as IDBFactory;
    const cache = createNameCache(() => refusing);
    await cache.put("SMZ3", pkg("abc"));
    expect(await cache.get("SMZ3", "abc")).toEqual(pkg("abc"));
  });

  it("falls back when another tab blocks the upgrade", async () => {
    const blocked = {
      open: () => {
        const request = {} as IDBOpenDBRequest;
        queueMicrotask(() =>
          (request.onblocked as (() => void) | null)?.call(request),
        );
        return request;
      },
    } as unknown as IDBFactory;
    const cache = createNameCache(() => blocked);
    await cache.putGroups("SMZ3", "abc", { Crateria: [] });
    expect(await cache.getGroups("SMZ3", "abc")).toEqual({ Crateria: [] });
  });

  it("falls back when a transaction fails", async () => {
    const factory = new IDBFactory();
    const cache = createNameCache(() => factory);
    await cache.put("SMZ3", pkg("abc"));
    // The database goes away under the page
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = factory.open(CACHE_DB, 1);
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    const broken = createNameCache(
      () =>
        ({
          ...factory,
          open: () => {
            const request = factory.open(CACHE_DB, 1);
            request.addEventListener("success", () => request.result.close());
            return request;
          },
        }) as IDBFactory,
    );
    await broken.put("Clique", pkg("c"));
    expect(await broken.get("Clique", "c")).toEqual(pkg("c"));
    await broken.putGroups("Clique", "c", {});
    expect(await broken.getGroups("Clique", "c")).toEqual({});
  });
});
