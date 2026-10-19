import { describe, expect, it } from "vitest";
import { type Smz3Game, viewOf, writeSmz3 } from "../../test/smz3-rom";
import {
  decodeChecks,
  decodeInPlay,
  decodeItems,
  decodeMode,
  decodeRequirements,
  decodeSeed,
} from "./decode";
import { MEMORY_RANGE } from "./memory";

const image = () => new Uint8Array(0x100_0000);

/** A game read as the session would, in its mode. */
const read = (game: Smz3Game = {}) =>
  viewOf(writeSmz3(image(), game), game.mode ?? "zelda");

/** The same game while each of the two games runs. */
const both = (game: Smz3Game) =>
  [read({ ...game, mode: "zelda" }), read({ ...game, mode: "sm" })] as const;

/** Some of Zelda's items, by save offset (z3 sram.asm). */
const ZELDA_ITEMS = {
  851: 2,
  855: 1,
  // Master Sword, mirror, moon pearl, two bottles
  857: 2,
  860: 2,
  861: 3,
  871: 0x02,
  // The green pendant and one other; crystals 5 and 6, the red, and one blue
  884: 0x05,
  890: 0x07,
  // Half magic
  891: 1,
  // The mushroom, the active flute
  908: 0x21,
  // Bow by BowTracking's b bit
  910: 0x80,
  1248: 1,
  // Three of Palace of Darkness's keys, the sewers' key, its big key
  1254: 3,
};

/** Some of Super Metroid's, by save offset (z3/items.asm:118-176). */
const SM_ITEMS = {
  // Morph and bombs; the charge beam
  2: 0x04,
  3: 0x10,
  7: 0x10,
  // 299 energy: two tanks; 15 missiles: three packs
  34: 0x2b,
  35: 0x01,
  38: 15,
  // Crateria's and Brinstar's level 1 keycards; Phantoon's token
  112: 0x09,
  114: 0x02,
};

describe("the running game", () => {
  it("is the mode the probe read, in play or not", () => {
    expect(decodeMode(read())).toBe("zelda");
    expect(decodeInPlay(read())).toBe(true);
    expect(decodeInPlay(read({ inPlay: false }))).toBe(false);
    expect(decodeInPlay(read({ mode: "sm" }))).toBe(true);
    expect(decodeInPlay(read({ inPlay: false, mode: "sm" }))).toBe(false);
    expect(decodeInPlay(read({ mode: "credits" }))).toBe(false);
    const unknown = viewOf(writeSmz3(image()), null);
    expect(decodeMode(unknown)).toBe("not-read");
    expect(decodeInPlay(unknown)).toBe("not-read");
  });
});

describe("the items", () => {
  it("are the same whichever game runs, both games' together", () => {
    const [inZelda, inSm] = both({ sm: SM_ITEMS, zelda: ZELDA_ITEMS });
    const items = decodeItems(inZelda);
    expect(decodeItems(inSm)).toEqual(items);
    expect(items).toMatchObject({
      bigKeyPD: 1,
      bombs: 1,
      bottle: 2,
      bow: 1,
      cardBrinstarL1: 1,
      cardCrateriaL1: 1,
      cardCrateriaL2: 0,
      charge: 1,
      crystalBlue: 1,
      crystalRed: 2,
      eTank: 2,
      flute: 1,
      halfMagic: 1,
      keyHC: 1,
      keyPD: 3,
      mirror: 1,
      missile: 3,
      moonPearl: 1,
      morph: 1,
      mushroom: 1,
      pendantGreen: 1,
      pendantNonGreen: 1,
      powder: 0,
      sword: 2,
      tokenKraid: 0,
      tokenPhantoon: 1,
      varia: 0,
    });
  });

  it("are capped at their pools, and none for an unknown level", () => {
    const items = decodeItems(
      read({ sm: { 38: 0xff, 39: 0xff }, zelda: { 857: 0xff, 1254: 9 } }),
    );
    expect(items).toMatchObject({ keyPD: 6, missile: 40, sword: 0 });
  });

  it("take Zelda's finds in Super Metroid from its buffers, over its SRAM", () => {
    const memory = writeSmz3(image(), { mode: "sm" });
    // The moon pearl and a Desert Palace key, found in Zebes: only the
    // buffers have them until the next save
    memory[MEMORY_RANGE["zelda-buffer"].address + 0x57] = 1;
    memory[MEMORY_RANGE["zelda-keys-buffer"].address + 3] = 1;
    expect(decodeItems(viewOf(memory, "sm"))).toMatchObject({
      keyDP: 1,
      moonPearl: 1,
    });
  });

  it("are not known from a save never written, as blank SRAM reads", () => {
    const zelda = writeSmz3(image(), { mode: "sm" });
    zelda.fill(
      0xff,
      MEMORY_RANGE["zelda-sram"].address,
      MEMORY_RANGE["zelda-sram"].address + 0x500,
    );
    zelda.fill(
      0xff,
      MEMORY_RANGE["zelda-buffer"].address,
      MEMORY_RANGE["zelda-buffer"].address + 0x100,
    );
    expect(decodeItems(viewOf(zelda, "sm"))).toBe("not-read");
    expect(decodeChecks(viewOf(zelda, "sm"))).toBe("not-read");
    const sm = writeSmz3(image(), { sm: { 2: 0xff, 3: 0xff } });
    expect(decodeItems(viewOf(sm, "zelda"))).toBe("not-read");
  });

  it("are not known before both games' homes are read", () => {
    const memory = writeSmz3(image());
    const partly = {
      ...viewOf(memory, "zelda"),
      has: (id: string) => id !== "sm-buffer",
    };
    expect(decodeItems(partly)).toBe("not-read");
    expect(decodeChecks(partly)).toBe("not-read");
    const noZelda = {
      ...viewOf(memory, "sm"),
      has: (id: string) => id !== "zelda-buffer",
    };
    expect(decodeItems(noZelda)).toBe("not-read");
    const noSm = {
      ...viewOf(memory, "sm"),
      has: (id: string) => id !== "sm-events",
    };
    expect(decodeChecks(noSm)).toBe("not-read");
    const noWram = {
      ...viewOf(memory, "zelda"),
      has: (id: string) => id !== "zelda-wram",
    };
    expect(decodeItems(noWram)).toBe("not-read");
    expect(decodeItems(viewOf(memory, "credits"))).toBe("not-read");
    // A range read short says nothing either
    const short = {
      ...viewOf(memory, "zelda"),
      bytes: (id: string) =>
        id === "zelda-mode"
          ? new Uint8Array(0)
          : viewOf(memory, "zelda").bytes(id),
    };
    expect(decodeInPlay(short)).toBe("not-read");
    const smShort = {
      ...viewOf(memory, "sm"),
      has: (id: string) => id !== "sm-state",
    };
    expect(decodeInPlay(smShort)).toBe("not-read");
  });
});

describe("the locations checked", () => {
  it("are Zelda's by its save's flags and Super Metroid's by its items' bits", () => {
    const game: Smz3Game = {
      // Morphing Ball is bit 26: byte $B3, bit 2
      sm: { 179: 0x04 },
      // Link's House's chest: room $104's word, chest bit $10 (offset $208)
      zelda: { 520: 0x10 },
    };
    for (const memory of both(game)) {
      expect(decodeChecks(memory)).toEqual(["links-house", "morphing-ball"]);
    }
  });
});

describe("the seed", () => {
  it("states its settings and whether it is a race seed", () => {
    expect(decodeSeed(read())).toEqual({
      keysanity: false,
      race: false,
      smLogic: "normal",
      title: "ZSM11.3.2CN1234ABCD",
    });
    expect(
      decodeSeed(read({ keysanity: true, race: true, smLogic: "hard" })),
    ).toMatchObject({ keysanity: true, race: true, smLogic: "hard" });
    const memory = writeSmz3(image());
    memory[MEMORY_RANGE.seed.address + 3] = 0x02;
    expect(decodeSeed(viewOf(memory, "zelda"))).toMatchObject({
      smLogic: null,
    });
    expect(decodeSeed({ ...viewOf(memory, "zelda"), has: () => false })).toBe(
      "not-read",
    );
  });

  it("gives its requirements outside races, never in one", () => {
    const game = read({
      ganonCrystals: 5,
      mire: "bombos",
      tourianBosses: 3,
      towerCrystals: 6,
      turtleRock: "ether",
    });
    expect(decodeRequirements(game, false)).toEqual({
      ganonCrystals: 5,
      mire: "bombos",
      tourianBosses: 3,
      towerCrystals: 6,
      turtleRock: "ether",
    });
    expect(decodeRequirements(game, true)).toBe("race-mode");
    expect(
      decodeRequirements(
        read({ ganonCrystals: 8, tourianBosses: 9, towerCrystals: 0xff }),
        false,
      ),
    ).toMatchObject({
      ganonCrystals: null,
      tourianBosses: null,
      towerCrystals: null,
    });
    // Another part of the ROM served in its place: its bytes are not what
    // the seed block foretells
    const served = writeSmz3(image());
    served[MEMORY_RANGE.requirements.address + 0x1c] = 0xdf;
    expect(decodeRequirements(viewOf(served, "zelda"), false)).toBe(
      "unreadable",
    );
    served[MEMORY_RANGE.requirements.address + 0x1c] = 0x03;
    served[MEMORY_RANGE.requirements.address + 0x20] = 0x7f;
    expect(decodeRequirements(viewOf(served, "zelda"), false)).toBe(
      "unreadable",
    );
    // A fast Ganon seed: $04 there
    served[MEMORY_RANGE.requirements.address + 0x20] = 0x01;
    served[MEMORY_RANGE.seed.address + 9] = 0x01;
    expect(decodeRequirements(viewOf(served, "zelda"), false)).toBe(
      "unreadable",
    );
    served[MEMORY_RANGE.requirements.address + 0x1c] = 0x04;
    expect(decodeRequirements(viewOf(served, "zelda"), false)).toMatchObject({
      towerCrystals: 7,
    });
    const memory = writeSmz3(image());
    memory[MEMORY_RANGE.requirements.address] = 7;
    expect(decodeRequirements(viewOf(memory, "zelda"), false)).toMatchObject({
      mire: null,
    });
    expect(
      decodeRequirements(
        { ...viewOf(memory, "zelda"), has: () => false },
        false,
      ),
    ).toBe("not-read");
  });
});
