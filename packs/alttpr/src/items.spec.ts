import { isIdentifier, RESERVED_WORDS } from "@alltp/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { loadFixtures, loadItemTable } from "../test/fixtures";
import {
  ALWAYS_EXCEPT,
  allItemsExcept,
  EXCEPT_GROUPS,
} from "../test/upstream-state";
import {
  fromUpstream,
  ITEM_IDS,
  ITEMS,
  type ItemId,
  stateFromUpstream,
  UPSTREAM_ENGLISH_NAMES,
  UPSTREAM_ITEMS,
} from "./items";

const table = loadItemTable();
const fixtures = loadFixtures();

describe("the item table", () => {
  it("has unique ids the rule language accepts", () => {
    expect(new Set(ITEM_IDS).size).toBe(ITEMS.length);
    for (const id of ITEM_IDS) {
      expect(isIdentifier(id) && !RESERVED_WORDS.has(id), id).toBe(true);
      expect(id, "lowerCamel").toMatch(/^[a-z][a-zA-Z0-9]*$/);
    }
  });

  it("gives every item a positive whole range", () => {
    for (const { id, max } of ITEMS) {
      expect(Number.isInteger(max) && max >= 1, id).toBe(true);
    }
  });

  it("is read by at least one upstream item", () => {
    const read = new Set(
      [...UPSTREAM_ITEMS.values()].flatMap((c) => (c === null ? [] : [c.item])),
    );
    expect(ITEM_IDS.filter((id) => !read.has(id))).toEqual([]);
  });
});

describe("UPSTREAM_ITEMS", () => {
  it("lists app/Item.php exactly, aliases included, in its order", () => {
    expect([...UPSTREAM_ITEMS.keys()]).toEqual(table.items.map((i) => i.name));
  });

  it("maps each contribution into its item's range", () => {
    const max = new Map(ITEMS.map((item) => [item.id as string, item.max]));
    for (const [name, contribution] of UPSTREAM_ITEMS) {
      if (contribution === null) continue;
      const { count, item } = contribution;
      expect(
        Number.isInteger(count) && count >= 1 && count <= (max.get(item) ?? 0),
        name,
      ).toBe(true);
    }
  });

  // What the item classes of app/Item.php mean to ItemCollection.php
  const byClass = (cls: string) =>
    table.items.filter((item) => item.class === cls).map((item) => item.name);
  const items = (names: string[]) =>
    names.map((name) => [name, fromUpstream(name)?.item ?? null]);

  it("counts every Item\\Bottle as a bottle, as bottleCount() does", () => {
    expect(byClass("Bottle")).toHaveLength(7);
    for (const name of byClass("Bottle")) {
      expect(fromUpstream(name), name).toEqual({ count: 1, item: "bottle" });
    }
    // Bottle contents are not bottles
    expect(items(byClass("BottleContents"))).toEqual(
      byClass("BottleContents").map((name) => [name, null]),
    );
  });

  it("files swords, shields, armor, bows and magic under their progressive item", () => {
    const expected = new Map<string, ItemId | null>([
      ["Sword", "sword"],
      ["Shield", "shield"],
      ["Armor", "armor"],
      ["Upgrade\\Magic", "magic"],
      ["Upgrade\\Health", "heartContainer"],
    ]);
    for (const [cls, item] of expected) {
      for (const name of byClass(cls)) {
        const got = fromUpstream(name)?.item ?? null;
        expect(got, name).toBe(name === "PieceOfHeart" ? "pieceOfHeart" : item);
      }
    }
    // canShootArrows reads every bow but ProgressiveBowAlternate
    expect(items(byClass("Bow"))).toEqual([
      ["Bow", "bow"],
      ["BowAndArrows", "bow"],
      ["BowAndSilverArrows", "bow"],
      ["ProgressiveBow", "bow"],
      ["ProgressiveBowAlternate", null],
    ]);
  });

  it("keeps each dungeon item apart, and only those the pool holds", () => {
    for (const cls of ["Key", "BigKey", "Map", "Compass"]) {
      for (const name of byClass(cls)) {
        const contribution = fromUpstream(name);
        if (contribution === null) continue;
        // KeyD1 -> keyD1, BigKeyP3 -> bigKeyP3: one id per dungeon
        expect(contribution.item, name).toBe(
          `${name.charAt(0).toLowerCase()}${name.slice(1)}`,
        );
      }
    }
    const unread = ["Key", "BigKey", "Map", "Compass"]
      .flatMap(byClass)
      .filter((name) => fromUpstream(name) === null);
    // The generic ones, the overworld maps, retro's generic key, and those
    // config/item.php puts none of in the pool
    expect(unread.sort()).toEqual([
      "BigKey",
      "BigKeyA1",
      "BigKeyH1",
      "BigKeyH2",
      "Compass",
      "CompassA1",
      "CompassH1",
      "CompassH2",
      "Key",
      "KeyGK",
      "KeyH1",
      "KeyP1",
      "Map",
      "MapA1",
      "MapDW",
      "MapH1",
      "MapLW",
    ]);
  });

  it("aliases count as upstream counts them", () => {
    expect(
      table.items
        .filter((item) => item.alias !== undefined)
        .map((item) => [item.name, item.alias, fromUpstream(item.name)]),
    ).toEqual([
      ["UncleSword", "ProgressiveSword", { count: 1, item: "sword" }],
      ["ShopKey", "KeyGK", { count: 1, item: "shopKey" }],
      ["ShopArrow", "Arrow", { count: 1, item: "shopArrow" }],
    ]);
  });
});

describe("fromUpstream", () => {
  it("resolves English names as Item::get does", () => {
    for (const [english, name] of UPSTREAM_ENGLISH_NAMES) {
      // getNice returns the first item, in Item::all order, with that name
      const first = table.items.find(
        (item) => table.english[item.name] === english,
      );
      expect(first?.name, english).toBe(name);
      expect(fromUpstream(english)).toBe(fromUpstream(name));
    }
  });

  it("rejects a name upstream does not have", () => {
    expect(() => fromUpstream("Sword")).toThrow(
      /Unknown upstream item "Sword"/,
    );
    expect(() => fromUpstream("fireRod")).toThrow(RangeError);
  });

  it("maps every item name the upstream tests use", () => {
    const names = new Set<string>();
    for (const fixture of fixtures) {
      for (const name of fixture.setUp.collected) names.add(name);
      for (const name of Object.values(fixture.setUp.locationItems))
        names.add(name);
      for (const c of fixture.cases) {
        if ("items" in c) for (const name of c.items.add) names.add(name);
        if ("item" in c) names.add(c.item);
        for (const name of Object.values(
          ("locationItems" in c && c.locationItems) || {},
        )) {
          names.add(name);
        }
      }
    }
    // The fixtures hold over a hundred distinct names; a loader that read
    // none would pass the loop below.
    expect(names.size).toBeGreaterThan(100);
    for (const name of names)
      expect(() => fromUpstream(name), name).not.toThrow();
  });

  it("maps every name allItemsExcept removes", () => {
    const except = new Set(ALWAYS_EXCEPT);
    for (const fixture of fixtures) {
      for (const c of fixture.cases) {
        if ("items" in c)
          for (const name of c.items.except ?? []) except.add(name);
      }
    }
    expect(
      [...except].filter((name) => EXCEPT_GROUPS.has(name)).sort(),
    ).toEqual([
      "AnyBottle",
      "AnyBow",
      "AnySword",
      "Flute",
      "Gloves",
      "UpgradedSword",
    ]);
    for (const name of except) {
      const members = EXCEPT_GROUPS.get(name) ?? [name];
      for (const member of members) {
        expect(UPSTREAM_ITEMS.has(member), `${name}: ${member}`).toBe(true);
      }
    }
  });
});

describe("stateFromUpstream", () => {
  // Each row: upstream items, then the state upstream's helpers imply
  // (ItemCollection.php hasSword, canLiftDarkRocks, canShootArrows,
  // canBlockLasers, hasArmor, canExtendMagic, bottleCount, canFly).
  const table: [string[], Partial<Record<ItemId, number>>][] = [
    [[], {}],
    [["TwentyRupees", "Nothing", "Bee"], {}],
    // The retro world's shops: what can be bought, as a rule reads it
    [["ShopKey", "ShopArrow"], { shopArrow: 1, shopKey: 1 }],
    [["ProgressiveSword"], { sword: 1 }],
    // hasSword(3) is false: a progressive sword does not upgrade a fixed one
    [["ProgressiveSword", "MasterSword"], { sword: 2 }],
    [["ProgressiveSword", "ProgressiveSword", "MasterSword"], { sword: 2 }],
    [
      ["ProgressiveSword", "ProgressiveSword", "ProgressiveSword"],
      { sword: 3 },
    ],
    // UncleSword is one more progressive sword
    [["UncleSword", "ProgressiveSword"], { sword: 2 }],
    [
      [
        "UncleSword",
        "ProgressiveSword",
        "ProgressiveSword",
        "ProgressiveSword",
      ],
      { sword: 4 },
    ],
    [["L1Sword", "L1SwordAndShield"], { sword: 1 }],
    [["L3Sword", "ProgressiveSword"], { sword: 3 }],
    [Array(5).fill("ProgressiveSword"), { sword: 4 }],
    // canLiftDarkRocks: TitansMitt or two progressive gloves
    [["PowerGlove", "ProgressiveGlove"], { glove: 1 }],
    [["ProgressiveGlove", "ProgressiveGlove"], { glove: 2 }],
    [["TitansMitt"], { glove: 2 }],
    // canShootArrows(2): silvers, two progressive bows, or the upgrade
    [["Bow", "ProgressiveBow"], { bow: 1 }],
    [["BowAndSilverArrows"], { bow: 2 }],
    [["SilverArrowUpgrade"], { silverArrowUpgrade: 1 }],
    [["SilverArrowUpgrade", "BowAndArrows"], { bow: 1, silverArrowUpgrade: 1 }],
    [["ProgressiveShield", "ProgressiveShield", "BlueShield"], { shield: 2 }],
    [["MirrorShield", "ProgressiveShield"], { shield: 3 }],
    [["BlueMail", "ProgressiveArmor"], { armor: 1 }],
    [["RedMail", "ProgressiveArmor"], { armor: 2 }],
    [["HalfMagic"], { magic: 1 }],
    [["HalfMagic", "QuarterMagic"], { magic: 2 }],
    [["Bottle", "BottleWithBee", "BottleWithGoldBee"], { bottle: 3 }],
    [["Flute"], { flute: 1 }],
    [["OcarinaInactive", "OcarinaActive"], { flute: 2 }],
    [
      ["PieceOfHeart", "PieceOfHeart", "BossHeartContainer", "HeartContainer"],
      { heartContainer: 2, pieceOfHeart: 2 },
    ],
    [Array(7).fill("KeyD1"), { keyD1: 6 }],
    [
      ["KeyP3", "BigKeyP3", "MapP3", "CompassP3"],
      { bigKeyP3: 1, compassP3: 1, keyP3: 1, mapP3: 1 },
    ],
    [
      ["Crystal5", "Crystal6", "PendantOfCourage", "DefeatAgahnim"],
      { crystal5: 1, crystal6: 1, defeatAgahnim: 1, pendantOfCourage: 1 },
    ],
  ];

  it.each(table)("%j", (names, state) => {
    expect(stateFromUpstream(names)).toEqual(state);
  });

  const MAX_OF = (id: string) => ITEMS.find((item) => item.id === id)?.max ?? 0;
  const names = [...UPSTREAM_ITEMS.keys()];
  // The levels and progressive items of one thing are where counting can go
  // wrong: draw them as often as all the other names together.
  const leveled = names.filter((name) => {
    const contribution = fromUpstream(name);
    return contribution !== null && MAX_OF(contribution.item) > 1;
  });
  const name = fc.oneof(fc.constantFrom(...names), fc.constantFrom(...leveled));
  const collection = fc.array(name, { maxLength: 40 });
  const atMost = (
    a: Partial<Record<ItemId, number>>,
    b: Partial<Record<ItemId, number>>,
  ) => ITEM_IDS.every((id) => (a[id] ?? 0) <= (b[id] ?? 0));

  it("never lowers a count when an item is added (monotone)", () => {
    fc.assert(
      fc.property(collection, name, (held, extra) =>
        atMost(stateFromUpstream(held), stateFromUpstream([...held, extra])),
      ),
    );
  });

  it("does not depend on the order of the items", () => {
    fc.assert(
      fc.property(
        collection.chain((held) =>
          fc.tuple(
            fc.constant(held),
            fc.shuffledSubarray(held, {
              maxLength: held.length,
              minLength: held.length,
            }),
          ),
        ),
        ([held, shuffled]) => {
          expect(stateFromUpstream(shuffled)).toEqual(stateFromUpstream(held));
        },
      ),
    );
  });

  it("stays within every item's range", () => {
    const max = new Map(ITEMS.map((item) => [item.id as string, item.max]));
    fc.assert(
      fc.property(collection, (held) =>
        Object.entries(stateFromUpstream(held)).every(
          ([id, count]) => count >= 1 && count <= (max.get(id) ?? 0),
        ),
      ),
    );
  });
});

describe("allItemsExcept (tests/TestCase.php)", () => {
  const state = (except: string[]) => stateFromUpstream(allItemsExcept(except));

  it("holds everything, every small key the dungeon has, but no generic key", () => {
    const all = state([]);
    // Upstream leaves the key for sale out, always (TestCase.php:63, 69)
    expect(Object.keys(all).sort()).toEqual(
      ITEM_IDS.filter((id) => id !== "shopKey").sort(),
    );
    expect(all).toMatchObject({
      bottle: 4,
      bow: 2,
      keyA2: 4,
      keyD1: 6,
      sword: 4,
    });
    expect(allItemsExcept([])).not.toContain("ShopKey");
    expect(allItemsExcept([]).filter((name) => name === "KeyD1")).toHaveLength(
      10,
    );
  });

  it("removes a group with each of its members", () => {
    expect(state(["AnySword"]).sword).toBeUndefined();
    // The level-1 swords and one ProgressiveSword are left
    expect(state(["UpgradedSword"]).sword).toBe(1);
    expect(state(["AnyBottle"]).bottle).toBeUndefined();
    // Silvers alone shoot nothing: the upgrade stays, the bows go
    expect(state(["AnyBow"])).toMatchObject({ silverArrowUpgrade: 1 });
    expect(state(["AnyBow"]).bow).toBeUndefined();
    expect(state(["Flute"]).flute).toBeUndefined();
    expect(state(["Gloves"]).glove).toBeUndefined();
    expect(state(["TitansMitt"]).glove).toBe(1);
    expect(state(["Lamp", "Hookshot"])).not.toHaveProperty("lamp");
  });

  it("rejects a name that is neither an item nor a group", () => {
    expect(() => allItemsExcept(["Sword"])).toThrow(/unknown name "Sword"/);
  });
});
