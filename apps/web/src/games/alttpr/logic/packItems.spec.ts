import {
  EMPTY_INPUT,
  fromLegacy,
  INVENTORY_ITEM_IDS,
  LEGACY_ITEM_RANGES,
  PRE_COLLECTED_STATE,
  toState,
} from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import {
  items,
  itemsMax,
  itemsMin,
  STARTING_HEARTS,
} from "@/games/alttpr/data/items";
import { getPreset } from "@/games/alttpr/data/presets";
import {
  ACTIVATION,
  itemsFromPack,
  PACK_ITEMS,
  packReading,
  RECORDED_LEVELS,
} from "@/games/alttpr/logic/packItems";
import { packSettings } from "@/games/alttpr/logic/settings";

const INVERTED = getPreset("inverted").settings;

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
            // A legacy run has no hearts set, nor any bombs; no cell records
            // the Door Randomizer's bomb upgrade
            unknown: { bombs: true, bombUpgrade: true, health: true },
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
      unknown: { bombs: true, bombUpgrade: true, health: true },
    });
  });

  it("reads the Ten Bombs as known only once autotracking set them", () => {
    expect(packReading({ tenbombs: 0 } as never).unknown).toMatchObject({
      bombs: true,
    });
    expect(packReading({ tenbombs: 1 } as never).unknown).not.toHaveProperty(
      "bombs",
    );
    expect(packReading({ tenbombs: 2 } as never).items).toEqual({
      tenBombs: 1,
    });
    // From the game: known where read, left alone where not
    expect(itemsFromPack({ tenBombs: 0 }).tenbombs).toBe(1);
    expect(itemsFromPack({ tenBombs: 1 }).tenbombs).toBe(2);
    expect(itemsFromPack({})).not.toHaveProperty("tenbombs");
  });

  /** The flute's cell and its activation, as the pack reads them. */
  const read = (fluteactive: number, flute = true) =>
    packReading({ flute, fluteactive } as never);

  it("reads the flute activated as flute 2, and gives it back from the game", () => {
    // By hand, or read not activated: the flute as its cell says
    expect(read(ACTIVATION.NOT_READ).items).toEqual({ flute: 1 });
    expect(read(ACTIVATION.INACTIVE).items).toEqual({ flute: 1 });
    expect(read(ACTIVATION.ACTIVE).items).toEqual({ flute: 2 });
    // Known where the game was read, left alone where not
    expect(itemsFromPack({ flute: 2 })).toMatchObject({
      flute: true,
      fluteactive: ACTIVATION.ACTIVE,
    });
    expect(itemsFromPack({ flute: 1 }).fluteactive).toBe(ACTIVATION.INACTIVE);
    expect(itemsFromPack({})).not.toHaveProperty("fluteactive");
  });

  it("drops the activation with the flute: the cell cleared holds no flute", () => {
    expect(read(ACTIVATION.ACTIVE, false).items).toEqual({});
    // Not known in a race, and no flute: the pack then holds no fact
    const none = read(ACTIVATION.UNKNOWN, false);
    expect(none.unknown).toMatchObject({ flute: true });
    expect(
      toState({ ...EMPTY_INPUT, ...none }, packSettings(INVERTED)),
    ).not.toHaveProperty("fluteActivationUnknown");
  });

  it("leaves the activation unknown in Race Mode alone, known otherwise", () => {
    expect(read(ACTIVATION.UNKNOWN).unknown).toEqual({
      bombs: true,
      bombUpgrade: true,
      flute: true,
      health: true,
    });
    for (const known of [
      ACTIVATION.NOT_READ,
      ACTIVATION.INACTIVE,
      ACTIVATION.ACTIVE,
    ]) {
      expect(read(known).unknown, String(known)).toEqual({
        bombs: true,
        bombUpgrade: true,
        health: true,
      });
    }
  });

  it("counts Hyrule Castle finished but while autotracking reads the escape going on", () => {
    const castle = (value: number) =>
      packReading({ escape: value } as never).beaten["hyrule-castle"];
    // Not known (a run by hand), then done: finished, as a legacy run
    expect(castle(0)).toBe(true);
    expect(castle(2)).toBe(true);
    // Zelda not yet in the Sanctuary
    expect(castle(1)).toBe(false);
  });

  it("reads the prizes held by class, none when none is held", () => {
    expect(
      packReading({ heldcrystals: 3, heldgreen: 1, heldpendants: 0 } as never)
        .held,
    ).toEqual({ crystal: 3, greenPendant: 1 });
    expect(packReading({ heldcrystals: 0 } as never)).not.toHaveProperty(
      "held",
    );
  });

  it("reads the hearts on screen as those found beyond the 3 Link starts with", () => {
    const found = (hearts: number) => packReading({ hearts } as never);
    // Not set: the health is unknown, and nothing is held
    expect(found(0)).toMatchObject({
      items: {},
      unknown: { bombs: true, bombUpgrade: true, health: true },
    });
    // 3 hearts (1), the start: none found, and the health known
    expect(found(1).items).toEqual({});
    expect(found(1).unknown).toEqual({ bombs: true, bombUpgrade: true });
    // 10 hearts: 7 found, to which the pack adds the 3 every world is
    // given (Randomizer.php:46-56)
    expect(found(8).items).toEqual({ heartContainer: 7 });
    expect(STARTING_HEARTS).toBe(PRE_COLLECTED_STATE.heartContainer);
    // 20 hearts: the pool's 11 containers and 24 pieces
    expect(found(18).items).toEqual({ heartContainer: 11, pieceOfHeart: 24 });
  });

  it("reads the pieces toward the next heart as pieces of heart, a quarter each", () => {
    const read = (hearts: number, heartquarters: number) =>
      packReading({ heartquarters, hearts } as never);
    // 3 hearts and 2 pieces: the pieces alone found
    expect(read(1, 2).items).toEqual({ pieceOfHeart: 2 });
    // 10 hearts and 3 pieces: 7 containers found, and the 3 pieces
    expect(read(8, 3).items).toEqual({ heartContainer: 7, pieceOfHeart: 3 });
    // 16 hearts and a piece: the pool's 11 containers, 2 hearts of pieces
    expect(read(14, 1).items).toEqual({ heartContainer: 11, pieceOfHeart: 9 });
    // Not set, the pieces say nothing; at 20 there is no piece left
    expect(read(0, 3)).toMatchObject({ items: {}, unknown: { health: true } });
    expect(read(18, 3).items).toEqual({
      heartContainer: 11,
      pieceOfHeart: 24,
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

  it("keeps the magic the game holds, a quarter as it is", () => {
    expect(itemsFromPack({ magic: 1 })).toMatchObject({ magic: 1 });
    expect(itemsFromPack({ magic: 2 })).toMatchObject({ magic: 2 });
    expect(packReading({ magic: 2 } as never).items).toEqual({ magic: 2 });
  });
});

describe("RECORDED_LEVELS", () => {
  it("holds each pack item a cell records, at the most it can say", () => {
    expect(Object.fromEntries(RECORDED_LEVELS)).toMatchObject({
      armor: 2,
      bigKeyD1: 1,
      bottle: 4,
      bow: 1,
      crystal5: 1,
      defeatAgahnim: 1,
      defeatAgahnim2: 1,
      flute: 1,
      glove: 2,
      hammer: 1,
      magic: 2,
      pendantOfCourage: 1,
      redBoomerang: 1,
      shield: 3,
      silverArrowUpgrade: 1,
      sword: 4,
    });
  });

  it("leaves out what no cell records", () => {
    for (const item of ["keyD1", "rescueZelda", "tenBombs"]) {
      expect(RECORDED_LEVELS.has(item), item).toBe(false);
    }
  });

  it("holds the hearts the hearts cell reaches, as the state holds them", () => {
    // The pool's 11 containers and the 3 every world is given
    expect(RECORDED_LEVELS.get("heartContainer")).toBe(14);
    expect(RECORDED_LEVELS.get("pieceOfHeart")).toBe(24);
  });
});
