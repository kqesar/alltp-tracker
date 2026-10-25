import { describe, expect, it } from "vitest";
import {
  SAMPLE_GUID,
  type Smz3Game,
  viewOf,
  writeSmz3,
} from "../../test/smz3-rom";
import {
  decodeBeforePlay,
  decodeChecks,
  decodeGameClock,
  decodeGoal,
  decodeInPlay,
  decodeItems,
  decodeMode,
  decodeRequirements,
  decodeSeed,
  decodeSeedGuid,
  SMZ3_FRAMES_PER_SECOND,
  smz3Ms,
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

  it("gives its guid outside races, never in one", () => {
    const game = read({ guid: SAMPLE_GUID });
    expect(decodeSeedGuid(game, false)).toEqual({ guid: SAMPLE_GUID });
    expect(decodeSeedGuid(game, true)).toBe("race-mode");
    expect(decodeSeedGuid({ ...game, has: () => false }, false)).toBe(
      "not-read",
    );
  });

  it("calls a guid that is not 32 lowercase hex digits unreadable", () => {
    for (const guid of [
      "0".repeat(32),
      "8506BBEF2C2B4432AF378B571C6C9133",
      "8506bbef2c2b4432af378b571c6c913g",
      "x".repeat(32),
    ]) {
      const read = decodeSeedGuid(
        viewOf(writeSmz3(image(), { guid }), "zelda"),
        false,
      );
      expect(read, guid).toEqual(
        guid === "0".repeat(32) ? { guid } : "unreadable",
      );
    }
    // A blank ROM, a block never written
    expect(decodeSeedGuid(viewOf(image(), "zelda"), false)).toBe("unreadable");
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

describe("before play", () => {
  it("is the title, the menus, the file select and the loading of a game, in either game", () => {
    for (const state of [0x00, 0x01, 0x04, 0x05, 0x1b]) {
      expect(decodeBeforePlay(read({ state })), `zelda $${state}`).toBe(true);
    }
    // In play, a pre-dungeon or overworld load, the menu, a death
    for (const state of [0x06, 0x07, 0x08, 0x09, 0x0b, 0x0e, 0x12]) {
      expect(decodeBeforePlay(read({ state })), `zelda $${state}`).toBe(false);
    }
    for (const state of [0x00, 0x04, 0x06, 0x1f]) {
      expect(
        decodeBeforePlay(read({ mode: "sm", state })),
        `sm $${state}`,
      ).toBe(true);
    }
    // In play, a door, a portal ($0B), a pause, a death, the escape
    for (const state of [0x07, 0x08, 0x09, 0x0b, 0x0c, 0x13, 0x26]) {
      expect(
        decodeBeforePlay(read({ mode: "sm", state })),
        `sm $${state}`,
      ).toBe(false);
    }
  });

  it("is not, in the credits, and not known until the mode and its state are read", () => {
    expect(decodeBeforePlay(read({ mode: "credits" }))).toBe(false);
    expect(decodeBeforePlay(viewOf(writeSmz3(image()), null))).toBe("not-read");
    const memory = writeSmz3(image());
    expect(
      decodeBeforePlay({ ...viewOf(memory, "zelda"), has: () => false }),
    ).toBe("not-read");
    expect(
      decodeBeforePlay({ ...viewOf(memory, "sm"), has: () => false }),
    ).toBe("not-read");
  });
});

describe("the goal", () => {
  /** The game byte as written: the credits write its low byte only. */
  const withGameByte = (low: number, high: number) => {
    const memory = writeSmz3(image());
    memory[MEMORY_RANGE["current-game"].address] = low;
    memory[MEMORY_RANGE["current-game"].address + 1] = high;
    return viewOf(memory, "credits");
  };

  it("is reached when the credits run: the game byte's low byte is $11, whatever the high one", () => {
    expect(decodeGoal(read({ mode: "credits" }))).toBe(true);
    // From Super Metroid the high byte stays $FF
    expect(decodeGoal(withGameByte(0x11, 0xff))).toBe(true);
    expect(decodeGoal(withGameByte(0x11, 0x00))).toBe(true);
  });

  it("is not, in either game or for any other byte that decodeMode calls the credits", () => {
    expect(decodeGoal(read({ mode: "zelda" }))).toBe(false);
    expect(decodeGoal(read({ mode: "sm" }))).toBe(false);
    // Positive, so decodeMode says credits, but only $11 is what credits_init writes
    expect(decodeMode(withGameByte(0x12, 0x00))).toBe("credits");
    expect(decodeGoal(withGameByte(0x12, 0x00))).toBe(false);
    expect(decodeGoal(withGameByte(0x01, 0x00))).toBe(false);
    expect(decodeGoal({ ...read(), has: () => false })).toBe("not-read");
  });
});

describe("the game time", () => {
  it("is the live counter of the game that runs and the saved one of the other", () => {
    const clock = { sm: 6_000, zelda: 1_500 };
    expect(decodeGameClock(read({ clock, mode: "zelda" }), false)).toEqual({
      final: false,
      frames: 7_500,
    });
    expect(decodeGameClock(read({ clock, mode: "sm" }), false)).toEqual({
      final: false,
      frames: 7_500,
    });
  });

  it("goes on across a portal: each game saves before it", () => {
    // Super Metroid ran to 6 000 frames with Zelda's 1 500 saved; Zelda takes
    // over from its 1 500 and Super Metroid's 6 000 is saved
    const before = read({ clock: { sm: 6_000, zelda: 1_500 }, mode: "sm" });
    const after = read({ clock: { sm: 6_000, zelda: 1_500 }, mode: "zelda" });
    expect(decodeGameClock(after, false)).toEqual(
      decodeGameClock(before, false),
    );
    // And Zelda runs on, 120 frames later
    expect(
      decodeGameClock(
        read({ clock: { sm: 6_000, zelda: 1_620 }, mode: "zelda" }),
        false,
      ),
    ).toMatchObject({ frames: 7_620 });
  });

  it("is final in the credits, where both counters are saved", () => {
    expect(
      decodeGameClock(
        read({ clock: { sm: 400_000, zelda: 300_000 }, mode: "credits" }),
        false,
      ),
    ).toEqual({ final: true, frames: 700_000 });
  });

  it("reads all four bytes of each counter, as unsigned", () => {
    const sm = 0x8000_0001;
    const zelda = 0x0001_ffff;
    expect(
      decodeGameClock(read({ clock: { sm, zelda }, mode: "zelda" }), false),
    ).toEqual({ final: false, frames: sm + zelda });
  });

  it("is never known in Race Mode, whatever the bytes", () => {
    for (const mode of ["zelda", "sm", "credits"] as const) {
      expect(
        decodeGameClock(read({ clock: { sm: 9, zelda: 9 }, mode }), true),
      ).toBe("race-mode");
    }
  });

  it("is not known until the mode's two halves were read", () => {
    const memory = writeSmz3(image(), {
      clock: { sm: 5, zelda: 5 },
      mode: "sm",
    });
    for (const missing of ["clock-sm-live", "clock-zelda-saved"] as const) {
      const unread = viewOf(memory, "sm", [missing]);
      expect(decodeGameClock(unread, false)).toBe("not-read");
    }
    // Super Metroid's mode, but only Zelda's ranges are read: after a portal
    // the scheduler counts the new mode's ranges unread until read again
    const stale = viewOf(memory, "sm", ["clock-sm-live"]);
    expect(decodeGameClock(stale, false)).toBe("not-read");
    expect(decodeGameClock(viewOf(memory, null), false)).toBe("not-read");
  });

  it("counts a frame as a sixtieth of a second, as the credits print it", () => {
    expect(SMZ3_FRAMES_PER_SECOND).toBe(60);
    expect(smz3Ms(60)).toBe(1_000);
    expect(smz3Ms(216_000)).toBe(3_600_000);
    expect(smz3Ms(1)).toBe(17);
  });
});
