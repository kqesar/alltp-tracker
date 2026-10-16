import {
  fromLegacy,
  INVENTORY_ITEM_IDS,
  LEGACY_ITEM_RANGES,
} from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { items, itemsMax, itemsMin } from "@/data/items";
import { itemsFromPack, PACK_ITEMS, packReading } from "@/logic/packItems";

/** Every value an item takes in the tracker, as the store holds it. */
const valuesOf = (id: string): (number | boolean)[] => {
  if (typeof items[id] === "boolean") return [false, true];
  const values: number[] = [];
  for (let value = itemsMin[id]; value <= itemsMax[id]; value++) {
    values.push(value);
  }
  return values;
};

describe("the app's one table of the pack's items", () => {
  it("says what every item the tracker tracks records, and no other", () => {
    expect(Object.keys(PACK_ITEMS).sort()).toEqual(Object.keys(items).sort());
  });

  it("names only items the player marks", () => {
    const named = Object.values(PACK_ITEMS).flatMap((entry) =>
      entry.kind === "count"
        ? [entry.item]
        : entry.kind === "bits"
          ? entry.items
          : [],
    );

    expect(named.filter((id) => !INVENTORY_ITEM_IDS.includes(id))).toEqual([]);
  });

  // The pack's frozen copy of the version 5 tables read every run until the
  // table: for the ids it knows, the table must read each value alike
  it.each(Object.keys(LEGACY_ITEM_RANGES))(
    "reads every value of %s as the pack's legacy table does",
    (id) => {
      for (const value of valuesOf(id)) {
        const {
          beaten,
          items: held,
          prizes,
        } = fromLegacy({
          chestsOpened: [],
          items: { [id]: value },
          medallions: [],
          smallKeys: [],
        }).input;

        expect(packReading({ [id]: value } as never), `${id} ${value}`).toEqual(
          {
            beaten,
            items: held,
            prizes,
          },
        );
      }
    },
  );

  it("reads a boss beaten, Agahnim twice, and a prize", () => {
    expect(
      packReading({
        agahnim: 1,
        agahnim2: 1,
        boss3: 2,
        reward3: 4,
        reward4: 2,
      } as never),
    ).toEqual({
      beaten: {
        "castle-tower": true,
        "ganons-tower": true,
        "hyrule-castle": true,
        "palace-of-darkness": true,
      },
      items: {},
      prizes: { "palace-of-darkness": "redCrystal", "swamp-palace": "pendant" },
    });
  });

  it("gives back every item value from the pack items it records", () => {
    for (const [id, entry] of Object.entries(PACK_ITEMS)) {
      if (entry.kind !== "count" && entry.kind !== "bits") continue;
      for (const value of valuesOf(id)) {
        const { items: held } = packReading({ [id]: value } as never);

        expect(itemsFromPack(held)[id], `${id} ${value}`).toEqual(value);
      }
    }
  });

  it("reads nothing held as a fresh run's items, and no boss or prize", () => {
    const read = itemsFromPack({});

    expect(read).toEqual(
      Object.fromEntries(Object.keys(read).map((id) => [id, items[id]])),
    );
    expect(
      Object.keys(read).filter((id) => /^(boss|reward|chest)/.test(id)),
    ).toEqual([]);
  });

  it("keeps a pack count within the tracker's range", () => {
    // The pack counts the flute 2 once active, the bow 2 with its upgrade
    expect(itemsFromPack({ bow: 2, flute: 2, sword: 9 })).toMatchObject({
      bow: 2,
      flute: true,
      sword: 4,
    });
  });
});
