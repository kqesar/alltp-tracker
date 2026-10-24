import { describe, expect, it } from "vitest";
import { dataPackage, fixture, packetsTo } from "../test/fixtures";
import {
  EVERYWHERE,
  type GamePackage,
  loadLocationGroups,
  locationGroupsKey,
  memoryStore,
  NameDataError,
  NameDataLoader,
  neededGames,
  parseGamePackage,
} from "./datapackage";
import { EMPTY_SNAPSHOT, reduce } from "./snapshot";

const ALTTP = "A Link to the Past";
const ALTTP_SUM = "1858ba29ffb7bf55e9e71a76fc7aba1b5c0950e4";

function counting(packages: Record<string, unknown> = {}) {
  const asked: string[] = [];
  return {
    asked,
    fetch: async (game: string) => {
      asked.push(game);
      return game in packages ? packages[game] : dataPackage(game);
    },
  };
}

describe("name data", () => {
  it("reads the recorded packages, with the checksums archipelago.gg serves", () => {
    const sums: Record<string, [string, number, number]> = {
      APQuest: ["854499b00d82a68764ce591dd80218ad75e83e2b", 7, 7],
      [ALTTP]: [ALTTP_SUM, 146, 286],
      Archipelago: ["ac9141e9ad0318df2fa27da5f20c50a842afeecb", 1, 2],
      SMZ3: ["12f632000dfc0e2bb4404146d4c9121e830b9b8f", 151, 316],
      "Super Metroid": ["4fd6c0bb6c0f0ab1157fb5dbda01a572ae3d0da6", 24, 101],
    };
    for (const [game, [sum, items, locations]] of Object.entries(sums)) {
      const pkg = parseGamePackage(dataPackage(game));
      expect(pkg?.checksum).toBe(sum);
      expect(Object.keys(pkg?.item_name_to_id ?? {})).toHaveLength(items);
      expect(Object.keys(pkg?.location_name_to_id ?? {})).toHaveLength(
        locations,
      );
    }
  });

  it("fetches a game once, then serves it from the store", async () => {
    const store = memoryStore();
    const net = counting();
    const first = new NameDataLoader({ fetch: net.fetch, store });
    const names = await first.load(ALTTP, ALTTP_SUM);
    expect(names.items.get(names.itemIds.get("Progressive Sword") ?? -1)).toBe(
      "Progressive Sword",
    );
    expect(names.locations.size).toBe(286);
    expect(names.locationIds.size).toBe(286);
    await first.load(ALTTP, ALTTP_SUM);
    expect(net.asked).toEqual([ALTTP]);
    expect(store.size).toBe(1);
    // A later visit: the store has it.
    const second = new NameDataLoader({ fetch: net.fetch, store });
    await second.load(ALTTP, ALTTP_SUM);
    expect(net.asked).toEqual([ALTTP]);
  });

  it("fetches again when the room announces another checksum", async () => {
    const store = memoryStore();
    const net = counting();
    const loader = new NameDataLoader({ fetch: net.fetch, store });
    await loader.load(ALTTP, ALTTP_SUM);
    const other = await loader.load(ALTTP, "a-newer-world-version");
    expect(net.asked).toEqual([ALTTP, ALTTP]);
    // Used, but kept under its own checksum: the next visit asks again.
    expect(other.checksum).toBe(ALTTP_SUM);
    await new NameDataLoader({ fetch: net.fetch, store }).load(
      ALTTP,
      "a-newer-world-version",
    );
    expect(net.asked).toHaveLength(3);
  });

  it("fetches without a checksum, and refuses a malformed package", async () => {
    const store = memoryStore();
    const net = counting({ Broken: { item_name_to_id: { a: "1" } } });
    const loader = new NameDataLoader({ fetch: net.fetch, store });
    expect((await loader.load("APQuest", undefined)).items.get(2)).toBe(
      "Sword",
    );
    await expect(loader.load("Broken", "x")).rejects.toBeInstanceOf(
      NameDataError,
    );
    // Not remembered: asked again.
    await expect(loader.load("Broken", "x")).rejects.toThrow(
      "no usable names for Broken",
    );
    expect(net.asked.filter((g) => g === "Broken")).toHaveLength(2);
  });

  it("treats a store entry under the wrong checksum as missing", async () => {
    const bad: GamePackage = {
      checksum: "other",
      item_name_to_id: {},
      location_name_to_id: {},
    };
    const store = { get: async () => bad, put: async () => {} };
    const net = counting();
    await new NameDataLoader({ fetch: net.fetch, store }).load(
      ALTTP,
      ALTTP_SUM,
    );
    expect(net.asked).toEqual([ALTTP]);
  });

  it.each([
    null,
    "x",
    { checksum: "a", item_name_to_id: [], location_name_to_id: {} },
    { checksum: "a", item_name_to_id: {}, location_name_to_id: { a: 1.5 } },
    { checksum: "", item_name_to_id: {}, location_name_to_id: {} },
    { item_name_to_id: {}, location_name_to_id: {} },
  ])("refuses the package %j", (value) => {
    expect(parseGamePackage(value)).toBeNull();
  });
});

describe("neededGames", () => {
  const tracked = (() => {
    let s = EMPTY_SNAPSHOT;
    for (const p of packetsTo(fixture("normal-session"), "tracker"))
      s = reduce(s, p).snapshot;
    return s;
  })();

  it("asks for the slot's own game only, by default", () => {
    expect(neededGames(tracked)).toEqual([ALTTP]);
    expect(neededGames(EMPTY_SNAPSHOT)).toEqual([]);
  });

  it("adds the games of the slots that sent items", () => {
    // Link got items from Quester (APQuest) and from its own world.
    expect(neededGames(tracked, { senders: true }).sort()).toEqual([
      "A Link to the Past",
      "APQuest",
    ]);
    const stranger = {
      ...tracked,
      items: [...tracked.items, { flags: 0, item: 1, location: 1, player: 99 }],
      players: [
        ...tracked.players,
        { alias: "", game: "", name: "Ghost", slot: 98, team: 0 },
      ],
    };
    expect(neededGames(stranger, { senders: true })).toHaveLength(2);
  });
});

describe("location groups", () => {
  const recorded = packetsTo(fixture("normal-session"), "tracker").find(
    (p) => p.cmd === "Retrieved" && p.uuid === "bench-get-1",
  )?.keys as Record<string, unknown>;

  it("reads the recorded groups without Everywhere", async () => {
    const asked: string[][] = [];
    const groups = await loadLocationGroups(ALTTP, async (keys) => {
      asked.push([...keys]);
      return recorded;
    });
    expect(asked).toEqual([[locationGroupsKey(ALTTP)]]);
    expect(Object.keys(groups)).toHaveLength(20);
    expect(groups).not.toHaveProperty(EVERYWHERE);
    expect(groups["Desert Palace"]).toContain("Desert Palace - Big Chest");
  });

  it("returns no groups for an odd value", async () => {
    for (const value of [null, [], "x"]) {
      expect(
        await loadLocationGroups("X", async () => ({
          [locationGroupsKey("X")]: value,
        })),
      ).toEqual({});
    }
    const mixed = await loadLocationGroups("X", async () => ({
      [locationGroupsKey("X")]: { A: ["a", 1], B: "b" },
    }));
    expect(mixed).toEqual({ A: ["a"] });
  });
});
