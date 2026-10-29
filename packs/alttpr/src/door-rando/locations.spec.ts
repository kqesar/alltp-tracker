import { readFileSync } from "node:fs";
import { locationId } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { DUNGEON_IDS } from "../dungeons";
import {
  DR_LOCATIONS,
  DR_TABLES,
  DR_UPSTREAM,
  type DrLocation,
  type DrModes,
  drFlagAddress,
  drKeysAdded,
  drLocationsOf,
} from "./locations";

const upstream = JSON.parse(
  readFileSync(new URL("../../upstream.json", import.meta.url), "utf8"),
) as {
  doorRandomizer: {
    commit: string;
    license: string;
    repo: string;
    version: string;
  };
};

const byName = (name: string): DrLocation => {
  const found = DR_LOCATIONS.find((location) => location.name === name);
  if (found === undefined) throw new Error(`no ${name}`);
  return found;
};

const kinds = (list: readonly DrLocation[]) => {
  const count: Record<string, number> = {};
  for (const { kind } of list) count[kind] = (count[kind] ?? 0) + 1;
  return count;
};

/** A seed with none of DR's extra locations. */
const NONE: DrModes = {
  bossShuffle: false,
  dropShuffle: "none",
  enemyShuffle: false,
  potShuffle: false,
  pottery: "none",
  shopsanity: false,
  takeAny: "none",
};

describe("DR_LOCATIONS", () => {
  it("is read from the release upstream.json pins", () => {
    const { commit, license, repo, version } = upstream.doorRandomizer;
    expect(DR_UPSTREAM).toEqual({ commit, license, repo, version });
  });

  it("counts every kind as DR's source does", () => {
    // Read independently of the importer, in DR 1.5.6:
    // - key_drop_data (PotShuffle.py:1001-1035): 14 'Drop' and 19 'Pot';
    // - vanilla_pots (PotShuffle.py:24-858): 832 Pot( calls, 19 of them a
    //   PotItem.Key and 1 a PotItem.Hole, which are no pot locations;
    // - shop_to_location_table (Regions.py:1297-1309): ten shops of three
    //   items and the capacity upgrade's two; retro_shops (1311-1317): the
    //   old man's sword and four take-anys of two;
    // - init_vanilla_sprites: the 714 sprites valid_drop_location takes
    //   (EnemyList.py:2248-2257), a regression pin of the importer.
    expect(kinds(DR_LOCATIONS)).toEqual({
      enemyDrop: 714,
      keyDrop: 33,
      pot: 812,
      shop: 32,
      takeAny: 9,
    });
    const keyDrops = DR_LOCATIONS.filter(({ kind }) => kind === "keyDrop");
    expect(keyDrops.filter(({ flag }) => flag.memory === "drop")).toHaveLength(
      14,
    );
    expect(keyDrops.filter(({ flag }) => flag.memory === "pot")).toHaveLength(
      19,
    );
    const pots = DR_LOCATIONS.filter(({ kind }) => kind === "pot");
    const content = (name: string) =>
      pots.filter(({ pot }) => pot?.content === name).length;
    // 29 PotItem.Switch, 190 PotItem.Nothing, 5 blocks but the key's
    expect([content("Switch"), content("Nothing")]).toEqual([29, 190]);
    expect(pots.filter(({ pot }) => pot?.block)).toHaveLength(5);
  });

  it("keys each location by locationId(name), once", () => {
    for (const location of DR_LOCATIONS) {
      expect(location.id).toBe(locationId(location.name));
    }
    const ids = DR_LOCATIONS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("places each in a pack dungeon or outside, a cave never in one", () => {
    for (const location of DR_LOCATIONS) {
      if (location.dungeon !== null) {
        expect(DUNGEON_IDS).toContain(location.dungeon);
        expect(location.cave).toBe(false);
      } else expect(location.cave).toBe(true);
    }
    expect(
      DR_LOCATIONS.filter(({ kind }) => kind === "keyDrop").every(
        ({ dungeon }) => dungeon !== null,
      ),
    ).toBe(true);
  });

  it("flags each within the base patch's tables, once", () => {
    const seen = new Set<string>();
    for (const { flag, name } of DR_LOCATIONS) {
      const { bus, size } = drFlagAddress(flag);
      const table = DR_TABLES[flag.memory];
      expect(bus, name).toBeGreaterThanOrEqual(table.bus);
      expect(bus + size, name).toBeLessThanOrEqual(table.bus + table.size);
      if (flag.memory !== "purchase") {
        expect(flag.bit, name).toBeGreaterThanOrEqual(0);
        expect(flag.bit, name).toBeLessThan(16);
      }
      const key = `${bus}:${drFlagAddress(flag).mask}`;
      expect(seen.has(key), name).toBe(false);
      seen.add(key);
    }
  });

  it("pins real entries", () => {
    // The first Key pot of supertile $BA, fifth in its list
    // (PotShuffle.py:1006; vanilla_pots[0xba])
    expect(byName("Eastern Palace - Dark Square Pot Key")).toMatchObject({
      dungeon: "eastern-palace",
      flag: { bit: 4, memory: "pot", room: 0xba },
      key: "small",
      region: "Eastern Dark Pots",
    });
    expect(
      drFlagAddress(byName("Eastern Palace - Dark Square Pot Key").flag),
    ).toEqual({ bus: 0x7f_6018 + 0xba * 2, mask: 0x0800, size: 2 });
    // Sprite 0 of supertile $72 (PotShuffle.py:1002)
    expect(byName("Hyrule Castle - Map Guard Key Drop")).toMatchObject({
      dungeon: "hyrule-castle",
      enemy: "BlueGuard",
      flag: { bit: 0, memory: "drop", room: 0x72 },
    });
    // Sprite 2 of supertile $39, after one overlord: slot 1
    // (EnemyList.py:2133-2139)
    expect(byName("Skull Woods - Spike Corner Key Drop").flag).toEqual({
      bit: 1,
      memory: "drop",
      room: 0x39,
    });
    expect(byName("Hyrule Castle - Big Key Drop").key).toBe("big");
    // Kakariko Shop's sram index is 21 (Regions.py:1290)
    expect(byName("Kakariko Shop - Left").flag).toEqual({
      index: 21,
      memory: "purchase",
    });
    expect(drFlagAddress(byName("Kakariko Shop - Left").flag)).toEqual({
      bus: 0x7f_64b8 + 21,
      mask: 0xff,
      size: 1,
    });
    expect(byName("Take-Any #4 Item 2").flag).toEqual({
      index: 40,
      memory: "purchase",
    });
    expect(byName("Old Man Sword Cave Item 1").flag).toEqual({
      index: 32,
      memory: "purchase",
    });
  });
});

describe("drLocationsOf", () => {
  it("has none for a seed without DR's options", () => {
    expect(drLocationsOf(NONE)).toEqual({
      locations: [],
      partial: [],
      unflagged: new Set(),
    });
  });

  it("takes the key drops by drop shuffle and pottery (Regions.py:1186-1187)", () => {
    const drops = drLocationsOf({ ...NONE, dropShuffle: "keys" });
    expect(kinds(drops.locations)).toEqual({ keyDrop: 14 });
    const pots = drLocationsOf({ ...NONE, pottery: "keys" });
    expect(kinds(pots.locations)).toEqual({ keyDrop: 19 });
    // The cave pottery leaves the key pots alone
    expect(
      kinds(drLocationsOf({ ...NONE, pottery: "cave" }).locations),
    ).toEqual({ pot: 144 });
    expect(
      kinds(drLocationsOf({ ...NONE, pottery: "cavekeys" }).locations),
    ).toEqual({ keyDrop: 19, pot: 144 });
  });

  it("takes each pottery mode's pots, a switch only with potshuffle", () => {
    const count = (modes: Partial<DrModes>) =>
      kinds(drLocationsOf({ ...NONE, ...modes }).locations).pot;
    // 812 pots less the 29 switches; less the 190 empty ones
    expect(count({ pottery: "lottery" })).toBe(783);
    expect(count({ pottery: "nonempty" })).toBe(593);
    expect(count({ pottery: "dungeon" })).toBe(639);
    expect(count({ potShuffle: true, pottery: "lottery" })).toBe(812);
    // reduced and clustered: the caves' pots, the dungeons' unknown
    const reduced = drLocationsOf({ ...NONE, pottery: "reduced" });
    expect(kinds(reduced.locations)).toEqual({ keyDrop: 19, pot: 144 });
    expect(reduced.partial).toEqual(["chosen-pots"]);
  });

  it("says when a key pot's flag cannot be read", () => {
    const moved = drLocationsOf({ ...NONE, potShuffle: true, pottery: "keys" });
    expect(moved.unflagged.size).toBe(19);
    expect(drLocationsOf({ ...NONE, pottery: "keys" }).unflagged.size).toBe(0);
  });

  it("takes the underworld's enemies unless enemies or bosses move", () => {
    const all = drLocationsOf({ ...NONE, dropShuffle: "underworld" });
    expect(kinds(all.locations)).toEqual({ enemyDrop: 714, keyDrop: 14 });
    const shuffled = drLocationsOf({
      ...NONE,
      dropShuffle: "underworld",
      enemyShuffle: true,
    });
    expect(kinds(shuffled.locations)).toEqual({ keyDrop: 14 });
    expect(shuffled.partial).toEqual(["enemy-shuffle"]);
    const bosses = drLocationsOf({
      ...NONE,
      bossShuffle: true,
      dropShuffle: "underworld",
    });
    expect(kinds(bosses.locations).enemyDrop).toBe(
      714 - DR_LOCATIONS.filter(({ bossRoom }) => bossRoom).length,
    );
    expect(bosses.partial).toEqual(["boss-rooms"]);
  });

  it("takes shopsanity's items and the take-any caves'", () => {
    expect(
      kinds(drLocationsOf({ ...NONE, shopsanity: true }).locations),
    ).toEqual({ shop: 32 });
    // The old man's sword and the four hearts; their potions with shopsanity
    const takeAny = drLocationsOf({ ...NONE, takeAny: "random" });
    expect(takeAny.locations.map(({ name }) => name)).toEqual([
      "Old Man Sword Cave Item 1",
      "Take-Any #1 Item 2",
      "Take-Any #2 Item 2",
      "Take-Any #3 Item 2",
      "Take-Any #4 Item 2",
    ]);
    // Without shopsanity, a take-any purchase marks its shop's index only
    expect(takeAny.unflagged.size).toBe(4);
    const both = drLocationsOf({ ...NONE, shopsanity: true, takeAny: "fixed" });
    expect(kinds(both.locations)).toEqual({ shop: 32, takeAny: 9 });
    expect(both.unflagged.size).toBe(0);
  });
});

describe("drKeysAdded", () => {
  it("gives each dungeon the keys its real key drops held", () => {
    const keys = drLocationsOf({
      ...NONE,
      dropShuffle: "keys",
      pottery: "keys",
    });
    expect(drKeysAdded(keys.locations, "hyrule-castle")).toEqual({
      big: 1,
      small: 3,
    });
    expect(drKeysAdded(keys.locations, "swamp-palace")).toEqual({
      big: 0,
      small: 5,
    });
    const potsOnly = drLocationsOf({ ...NONE, pottery: "keys" });
    expect(drKeysAdded(potsOnly.locations, "hyrule-castle")).toEqual({
      big: 0,
      small: 0,
    });
  });
});
