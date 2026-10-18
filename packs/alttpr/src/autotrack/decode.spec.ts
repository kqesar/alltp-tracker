import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ITEM_IDS, ITEMS, type ItemId } from "../items";
import { CHECK_FLAGS } from "./check-flags";
import {
  decodeChecks,
  decodeItems,
  decodeProgress,
  FRAMES_PER_SECOND,
  ITEM_SOURCES,
  type MemoryView,
  playTimeMs,
  racePermitted,
} from "./decode";
import { MEMORY_RANGES, type MemoryRangeId } from "./memory";

// A fake console: WRAM as the game lays it out, written byte by byte at the
// documented addresses (z3randomizer sram.asm), and a view over it that
// serves each range of the map, as the session's snapshot does.
const WRAM = 0x7e_0000;

class Image {
  readonly wram = new Uint8Array(0x2_0000);

  /** Writes bytes at an A-bus address. */
  set(at: number, ...values: number[]): this {
    values.forEach((value, i) => {
      this.wram[at - WRAM + i] = value;
    });
    return this;
  }

  /** Sets bits of the little-endian word at `at`. */
  orWord(at: number, mask: number): this {
    this.wram[at - WRAM] |= mask & 0xff;
    this.wram[at - WRAM + 1] |= mask >> 8;
    return this;
  }

  /** Sets bits of the byte at `at`. */
  or(at: number, mask: number): this {
    this.wram[at - WRAM] |= mask;
    return this;
  }

  /**
   * The view a session would give. `read` says which ranges were read;
   * `strict` throws on any question about a range Race Mode forbids.
   */
  view(
    options: { read?: (id: string) => boolean; strict?: boolean } = {},
  ): MemoryView {
    const { read = () => true, strict = false } = options;
    const range = (id: string) => {
      const found = MEMORY_RANGES.find((r) => r.id === id);
      if (found === undefined) throw new Error(`unknown range ${id}`);
      if (strict && !racePermitted(found.id)) {
        throw new Error(`Race Mode read forbidden range ${id}`);
      }
      return found;
    };
    return {
      bytes: (id) => {
        const { bus, size } = range(id);
        return this.wram.slice(bus - WRAM, bus - WRAM + size);
      },
      has: (id) => {
        range(id);
        return read(id);
      },
    };
  }
}

const SAVE = (offset: number) => 0x7e_f000 + offset;
const ROOM = (room: number) => SAVE(room * 2);
const SCREEN = (screen: number) => SAVE(0x280 + screen);

/** A new file, as the base patch's initial SRAM writes it. */
function freshFile(mode: "open" | "standard"): Image {
  const image = new Image();
  // vt app/Rom.php:1553-1575: Open starts with Zelda rescued ($02) and the
  // uncle gone and Zelda's flag set ($14); Standard with zeros.
  if (mode === "open") image.set(SAVE(0x3c5), 0x02).set(SAVE(0x3c6), 0x14);
  // Link wakes up indoors: game mode $07 (ram.asm:41).
  return image.set(0x7e_0010, 0x07);
}

/** Writes item `id` at `level`, from the documented layout. */
function writeItem(image: Image, id: ItemId, level: number): void {
  if (level === 0) return;
  const equipment: Partial<Record<ItemId, number>> = {
    bombos: 0x347,
    bookOfMudora: 0x34e,
    bugCatchingNet: 0x34d,
    caneOfByrna: 0x351,
    caneOfSomaria: 0x350,
    cape: 0x352,
    ether: 0x348,
    fireRod: 0x345,
    flippers: 0x356,
    hammer: 0x34b,
    hookshot: 0x342,
    iceRod: 0x346,
    lamp: 0x34a,
    moonPearl: 0x357,
    pegasusBoots: 0x355,
    quake: 0x349,
  };
  const levels: Partial<Record<ItemId, number>> = {
    armor: 0x35b,
    glove: 0x354,
    magic: 0x37b,
    shield: 0x35a,
    sword: 0x359,
  };
  // InventoryTracking, low byte (sram.asm:175-179).
  const tracking: Partial<Record<ItemId, number>> = {
    boomerang: 0x80,
    mushroom: 0x08, // traded to the witch: n only
    powder: 0x10,
    redBoomerang: 0x40,
    shovel: 0x04,
  };
  // Compass, big key and map fields, by dungeon (sram.asm:119-126).
  const dungeonBits: Record<string, number> = {
    A2: 0x0004,
    D1: 0x0200,
    D2: 0x0400,
    D3: 0x0080,
    D4: 0x0010,
    D5: 0x0040,
    D6: 0x0100,
    D7: 0x0008,
    H2: 0x4000,
    P1: 0x2000,
    P2: 0x1000,
    P3: 0x0020,
  };
  // DungeonKeys, sewers first (sram.asm:154-168).
  const keyBytes: Record<string, number> = {
    A1: 4,
    A2: 13,
    D1: 6,
    D2: 5,
    D3: 8,
    D4: 11,
    D5: 9,
    D6: 7,
    D7: 12,
    H2: 1,
    P2: 3,
    P3: 10,
  };
  // vt app/Item.php:148-150 and 254-260.
  const prizes: Partial<Record<ItemId, [number, number]>> = {
    crystal1: [0x37a, 0x02],
    crystal2: [0x37a, 0x10],
    crystal3: [0x37a, 0x40],
    crystal4: [0x37a, 0x20],
    crystal5: [0x37a, 0x04],
    crystal6: [0x37a, 0x01],
    crystal7: [0x37a, 0x08],
    pendantOfCourage: [0x374, 0x04],
    pendantOfPower: [0x374, 0x02],
    pendantOfWisdom: [0x374, 0x01],
  };
  const dungeon = /^(bigKey|compass|map|key)([A-Z]\d)$/.exec(id);
  if (equipment[id] !== undefined) image.set(SAVE(equipment[id]), 0x01);
  else if (levels[id] !== undefined) image.set(SAVE(levels[id]), level);
  else if (tracking[id] !== undefined) image.or(SAVE(0x38c), tracking[id]);
  else if (prizes[id] !== undefined)
    image.or(SAVE(prizes[id][0]), prizes[id][1]);
  else if (dungeon !== null) {
    const [, kind, code] = dungeon;
    if (kind === "key") image.set(SAVE(0x37c + keyBytes[code]), level);
    const field = { bigKey: 0x366, compass: 0x364, map: 0x368 }[kind];
    if (field !== undefined) image.orWord(SAVE(field), dungeonBits[code]);
  } else {
    switch (id) {
      case "bottle":
        for (let slot = 0; slot < level; slot++)
          image.set(SAVE(0x35c + slot), 0x02);
        break;
      // BowTracking: any bow, then the first and second progressive bows;
      // the second resolves to the silver bow, which sets s.
      case "bow":
        image.or(SAVE(0x38e), level === 1 ? 0x90 : 0xf0);
        break;
      case "silverArrowUpgrade":
        image.or(SAVE(0x38e), 0x40);
        break;
      case "flute":
        image.or(SAVE(0x38c), level === 2 ? 0x01 : 0x02);
        break;
      case "magicMirror":
        image.set(SAVE(0x353), 0x02);
        break;
      case "tenBombs":
        image.or(SAVE(0x38d), 0x02);
        break;
      case "heartContainer":
        image.set(SAVE(0x448), level);
        break;
      case "pieceOfHeart":
        image.set(SAVE(0x470), level);
        break;
      case "rescueZelda":
        image.set(SAVE(0x3c5), 0x02);
        break;
      case "defeatAgahnim":
        image.set(SAVE(0x3c5), 0x03);
        break;
      case "defeatAgahnim2":
        image.set(SAVE(0x40f), 0x01);
        break;
      default:
        throw new Error(`no layout for ${id}`);
    }
  }
}

const isKey = (id: string) => /^key[A-Z]\d$/.test(id);

/** Every item's value: its count, or for small keys the bound. */
function values(view: MemoryView, race = false): Record<string, number> {
  const { atLeast, counts } = decodeItems(view, { race });
  return { ...counts, ...atLeast };
}

/** The items memory holds: the Big Bomb it does not (ITEM_SOURCES). */
const READ = ITEMS.filter(({ id }) => ITEM_SOURCES[id] !== null);

const zeros = () => Object.fromEntries(READ.map(({ id }) => [id, 0]));

const DUNGEON_IDS = CHECK_FLAGS.filter(({ dungeon }) => dungeon !== null).map(
  ({ id }) => id,
);
const OUTSIDE_IDS = CHECK_FLAGS.filter(({ dungeon }) => dungeon === null).map(
  ({ id }) => id,
);

/** Sets every flag CHECK_FLAGS lists. */
function everyFlag(image: Image): Image {
  for (const { flag } of CHECK_FLAGS) {
    if ("atLeast" in flag) image.set(flag.at, Math.max(flag.atLeast, 3));
    else if (flag.size === 2) image.orWord(flag.at, flag.mask);
    else image.or(flag.at, flag.mask);
  }
  return image;
}

/** The end of a run: everything found, every flag set, the goal reached. */
function endGame(): Image {
  const image = everyFlag(new Image());
  for (const { id, max } of READ) writeItem(image, id, max);
  // Both Agahnims fall in their dungeons, which marks them completed too
  // (events.asm:98-108).
  image.orWord(SAVE(0x472), 0x0800 | 0x0004);
  // The Triforce room, and StatsLocked set as it began (stats.asm:322-326).
  return image.set(0x7e_0010, 0x19).set(SAVE(0x443), 0x01);
}

/**
 * The end game's items: every item at its max, but the silver arrow
 * upgrade, which the second progressive bow's own silver bit hides.
 */
const END_GAME_ITEMS: Record<string, number> = {
  ...Object.fromEntries(READ.map(({ id, max }) => [id, max])),
  silverArrowUpgrade: 0,
};

describe("decodeItems", () => {
  it("reads a fresh Open file as Zelda rescued and nothing found", () => {
    const decoded = decodeItems(freshFile("open").view(), { race: false });
    expect({ ...decoded.counts, ...decoded.atLeast }).toEqual({
      ...zeros(),
      rescueZelda: 1,
    });
    expect(decoded.unsettled).toEqual({});
    expect(values(freshFile("standard").view())).toEqual(zeros());
  });

  it("reads every item memory holds at every level, alone, and never the Big Bomb", () => {
    expect(ITEMS.filter(({ id }) => ITEM_SOURCES[id] === null)).toEqual([
      { id: "shopArrow", max: 1 },
      { id: "shopKey", max: 1 },
      { id: "bigRedBomb", max: 1 },
    ]);
    for (const { id, max } of READ) {
      for (let level = 0; level <= max; level++) {
        const image = new Image();
        writeItem(image, id, level);
        const expected = { ...zeros(), [id]: level };
        // Agahnim's defeat moves the progress past Zelda's rescue.
        if (id === "defeatAgahnim" && level > 0) expected.rescueZelda = 1;
        expect(values(image.view()), `${id} ${level}`).toEqual(expected);
      }
    }
  });

  it("keeps small keys as lower bounds, the keys held", () => {
    const { atLeast, counts } = decodeItems(
      new Image().set(SAVE(0x37c + 6), 2).view(),
      { race: false },
    );
    expect(atLeast.keyD1).toBe(2);
    expect(Object.keys(counts).filter(isKey)).toEqual([]);
    expect(Object.keys(atLeast).sort()).toEqual(ITEM_IDS.filter(isKey).sort());
  });

  it("reads Hyrule Castle's keys from the castle or the sewers byte", () => {
    const sewers = new Image().set(SAVE(0x37c), 1).view();
    expect(decodeItems(sewers, { race: false }).atLeast.keyH2).toBe(1);
  });

  it("reads a found mushroom whether held or traded", () => {
    const held = new Image().set(SAVE(0x38c), 0x20).view();
    expect(values(held).mushroom).toBe(1);
  });

  it("counts silvers found with one progressive bow", () => {
    const image = new Image().set(SAVE(0x38e), 0x90 | 0x40);
    expect(values(image.view())).toMatchObject({
      bow: 1,
      silverArrowUpgrade: 1,
    });
  });

  it("reads no sword from the swordless $FF and values past the last level", () => {
    expect(values(new Image().set(SAVE(0x359), 0xff).view()).sword).toBe(0);
    expect(values(new Image().set(SAVE(0x35a), 0x04).view()).shield).toBe(0);
    expect(values(new Image().set(SAVE(0x353), 0x01).view()).magicMirror).toBe(
      0,
    );
  });

  it("reads a mid-game file", () => {
    const image = freshFile("standard")
      .set(SAVE(0x3c5), 0x02) // Zelda rescued
      .set(SAVE(0x359), 0x02) // Master Sword
      .set(SAVE(0x35a), 0x01)
      .set(SAVE(0x354), 0x01)
      .set(SAVE(0x342), 0x01) // hookshot
      .set(SAVE(0x34a), 0x01) // lamp
      .set(SAVE(0x355), 0x01) // boots
      .set(SAVE(0x357), 0x01) // pearl
      .set(SAVE(0x37b), 0x01) // half magic
      .set(SAVE(0x35c), 0x02, 0x03) // two bottles, one empty, one red potion
      .set(SAVE(0x38c), 0x80 | 0x08 | 0x10 | 0x01) // boomerang, traded mushroom, powder, flute
      .set(SAVE(0x38e), 0x90) // the first progressive bow
      .set(SAVE(0x374), 0x05) // courage and wisdom
      .set(SAVE(0x37a), 0x02) // crystal 1
      .set(SAVE(0x448), 3)
      .set(SAVE(0x470), 6)
      .set(SAVE(0x37c + 6), 2) // two Palace of Darkness keys held
      .orWord(SAVE(0x366), 0x2000 | 0x0200) // big keys P1, D1
      .orWord(SAVE(0x364), 0x0200); // compass D1
    expect(values(image.view())).toEqual({
      ...zeros(),
      bigKeyD1: 1,
      bigKeyP1: 1,
      boomerang: 1,
      bottle: 2,
      bow: 1,
      compassD1: 1,
      crystal1: 1,
      flute: 2,
      glove: 1,
      heartContainer: 3,
      hookshot: 1,
      keyD1: 2,
      lamp: 1,
      magic: 1,
      moonPearl: 1,
      mushroom: 1,
      pegasusBoots: 1,
      pendantOfCourage: 1,
      pendantOfWisdom: 1,
      pieceOfHeart: 6,
      powder: 1,
      rescueZelda: 1,
      shield: 1,
      sword: 2,
    });
  });

  it("reads an end-game file at every item's max", () => {
    expect(values(endGame().view())).toEqual(END_GAME_ITEMS);
  });
});

describe("decodeChecks", () => {
  it("reads each location's flag from its documented byte and bit", () => {
    // Spot checks by hand, from sram.asm's layout and AP's tables.
    const cases: [string, (image: Image) => void][] = [
      ["links-house", (i) => i.orWord(ROOM(0x104), 0x10)],
      ["kakariko-well/bottom", (i) => i.orWord(ROOM(0x2f), 0x100)],
      ["eastern-palace/boss", (i) => i.orWord(ROOM(0xc8), 0x800)],
      ["ganons-tower/moldorm-chest", (i) => i.orWord(ROOM(0x4d), 0x10)],
      ["lake-hylia-island", (i) => i.or(SCREEN(0x35), 0x40)],
      ["master-sword-pedestal", (i) => i.or(SCREEN(0x80), 0x40)],
      ["magic-bat", (i) => i.or(SAVE(0x411), 0x80)],
      ["old-man", (i) => i.or(SAVE(0x410), 0x01)],
      ["links-uncle", (i) => i.or(SAVE(0x3c6), 0x01)],
      ["purple-chest", (i) => i.or(SAVE(0x3c9), 0x10)],
      ["turtle-rock/prize", (i) => i.orWord(SAVE(0x472), 0x0008)],
      ["agahnim-2", (i) => i.set(SAVE(0x40f), 0x01)],
    ];
    for (const [id, write] of cases) {
      const image = new Image();
      write(image);
      const { checked } = decodeChecks(image.view(), { race: false });
      expect([...checked], id).toEqual([id]);
    }
  });

  it("tells every mapped location by its flag alone", () => {
    for (const { flag, id } of CHECK_FLAGS) {
      const image = new Image();
      if ("atLeast" in flag) image.set(flag.at, flag.atLeast);
      else if (flag.size === 2) image.orWord(flag.at, flag.mask);
      else image.or(flag.at, flag.mask);
      const { checked } = decodeChecks(image.view(), { race: false });
      // Agahnim's $03 is past Zelda's $02.
      expect([...checked].sort(), id).toEqual(
        id === "agahnim" ? ["agahnim", "zelda"] : [id],
      );
    }
  });

  it("reads a fresh Open file with Zelda rescued only", () => {
    const { checked, unsettled } = decodeChecks(freshFile("open").view(), {
      race: false,
    });
    expect([...checked]).toEqual(["zelda"]);
    expect(unsettled.size).toBe(0);
  });

  it("reads an end-game file as every location checked", () => {
    const { checked } = decodeChecks(endGame().view(), { race: false });
    expect([...checked].sort()).toEqual(CHECK_FLAGS.map(({ id }) => id).sort());
  });

  it("leaves unread locations unsettled, not unchecked", () => {
    const view = endGame().view({ read: (id) => id !== "cave-rooms" });
    const { checked, unsettled } = decodeChecks(view, { race: false });
    expect(unsettled.get("links-house")).toBe("not-read");
    expect(checked.has("links-house")).toBe(false);
    expect(checked.has("kakariko-well/top")).toBe(true);
  });
});

describe("decodeProgress", () => {
  it("reads a fresh file: in play, nothing beaten", () => {
    const decoded = decodeProgress(freshFile("standard").view(), {
      race: false,
    });
    expect(decoded).toEqual({
      beforePlay: false,
      bosses: {
        A1: false,
        A2: false,
        D1: false,
        D2: false,
        D3: false,
        D4: false,
        D5: false,
        D6: false,
        D7: false,
        P1: false,
        P2: false,
        P3: false,
      },
      completed: {
        A1: false,
        A2: false,
        D1: false,
        D2: false,
        D3: false,
        D4: false,
        D5: false,
        D6: false,
        D7: false,
        P1: false,
        P2: false,
        P3: false,
      },
      goal: false,
      rescueZelda: false,
      romStats: {
        bonks: 0,
        bossKills: {
          fighter: 0,
          gold: 0,
          master: 0,
          swordless: 0,
          tempered: 0,
        },
        damageTaken: 0,
        deaths: 0,
        faerieRevivals: 0,
        found: { boots: 0, flute: 0, mirror: 0, sword: 0 },
        itemsCollected: 0,
        lagFrames: 0,
        magicUsed: 0,
        menuFrames: 0,
        playFrames: 0,
        saveAndQuits: 0,
      },
      started: true,
    });
  });

  it("reads the stats the ROM's credits show, at sram.asm's addresses", () => {
    const image = new Image()
      .set(SAVE(0x420), 7) // BonkCounter
      .set(SAVE(0x423), 0x2c, 0x01) // TotalItemCounter: 300
      .set(SAVE(0x425), 0x21, 0x43) // SwordBossKills: t4 g3 f2 m1
      .set(SAVE(0x42d), 2) // SaveQuitCounter
      .set(SAVE(0x42e), 0x00, 0x10, 0x00, 0x00) // LoopFrames: 4096
      .set(SAVE(0x43e), 0x80, 0x10, 0x00, 0x00) // NMIFrames: 4224
      .set(SAVE(0x444), 0x58, 0x02, 0x00, 0x00) // MenuFrames: 600
      .set(SAVE(0x449), 3) // DeathCounter
      .set(SAVE(0x452), 1) // SwordlessBossKills
      .set(SAVE(0x453), 4) // FaerieRevivalCounter
      .set(SAVE(0x458), 0x10, 0x0e, 0x00, 0x00) // SwordTime: 3600
      .set(SAVE(0x45c), 0x20, 0x1c, 0x00, 0x00) // BootsTime: 7200
      .set(SAVE(0x460), 0x30, 0x2a, 0x00, 0x00) // FluteTime: 10800
      .set(SAVE(0x464), 0x40, 0x38, 0x00, 0x00) // MirrorTime: 14400
      .set(SAVE(0x46a), 0xe8, 0x03) // DamageCounter: 1000
      .set(SAVE(0x46c), 0x00, 0x02); // MagicCounter: 512
    expect(decodeProgress(image.view(), { race: false }).romStats).toEqual({
      bonks: 7,
      bossKills: { fighter: 2, gold: 3, master: 1, swordless: 1, tempered: 4 },
      damageTaken: 1000,
      deaths: 3,
      faerieRevivals: 4,
      found: { boots: 7200, flute: 10800, mirror: 14400, sword: 3600 },
      itemsCollected: 300,
      lagFrames: 128,
      magicUsed: 512,
      menuFrames: 600,
      playFrames: 4224,
      saveAndQuits: 2,
    });
  });

  it("says the stats are not read until all three of their ranges are", () => {
    for (const range of ["stats", "menu-frames", "stats-finds"]) {
      const view = new Image().view({ read: (id) => id !== range });
      expect(decodeProgress(view, { race: false }).romStats, range).toBe(
        "not-read",
      );
    }
  });

  it("tells the screens before play from play, menus included", () => {
    const at = (mode: number) =>
      decodeProgress(new Image().set(0x7e_0010, mode).view(), {
        race: false,
      });
    // The title, the file select, its name screen, the loading and the
    // spawn select come before play
    for (const mode of [0x00, 0x01, 0x04, 0x05, 0x1b]) {
      expect(at(mode), `$${mode.toString(16)}`).toMatchObject({
        beforePlay: true,
        started: false,
      });
    }
    // In play, and in a menu or a text box (mode $0E) during play, neither
    // says the game is before play: a menu is no new start
    expect(at(0x07)).toMatchObject({ beforePlay: false, started: true });
    expect(at(0x0e)).toMatchObject({ beforePlay: false, started: false });
  });

  it("reads the frames played, 32 bits, and turns them into time", () => {
    const frames = (...bytes: number[]) => {
      const { romStats } = decodeProgress(
        new Image().set(SAVE(0x43e), ...bytes).view(),
        { race: false },
      );
      return typeof romStats === "string" ? romStats : romStats.playFrames;
    };
    expect(frames(0x78, 0x56, 0x34, 0x12)).toBe(0x1234_5678);
    expect(frames(0xff, 0xff, 0xff, 0xff)).toBe(0xffff_ffff);
    // An hour of NTSC frames is an hour, within a frame
    expect(FRAMES_PER_SECOND).toBeCloseTo(60.0988, 4);
    const hour = playTimeMs(Math.round(FRAMES_PER_SECOND * 3600));
    expect(Math.abs(hour - 3_600_000)).toBeLessThan(1000 / 60);
    expect(playTimeMs(0)).toBe(0);
  });

  it("reads each boss from its own flag", () => {
    const flags: Record<string, (image: Image) => void> = {
      A1: (i) => i.set(SAVE(0x3c5), 0x03),
      A2: (i) => i.set(SAVE(0x40f), 0x01),
      D1: (i) => i.orWord(ROOM(0x5a), 0x800),
      D2: (i) => i.orWord(ROOM(0x06), 0x800),
      D3: (i) => i.orWord(ROOM(0x29), 0x800),
      D4: (i) => i.orWord(ROOM(0xac), 0x800),
      D5: (i) => i.orWord(ROOM(0xde), 0x800),
      D6: (i) => i.orWord(ROOM(0x90), 0x800),
      D7: (i) => i.orWord(ROOM(0xa4), 0x800),
      P1: (i) => i.orWord(ROOM(0xc8), 0x800),
      P2: (i) => i.orWord(ROOM(0x33), 0x800),
      P3: (i) => i.orWord(ROOM(0x07), 0x800),
    };
    for (const [code, write] of Object.entries(flags)) {
      const image = new Image();
      write(image);
      const { bosses } = decodeProgress(image.view(), { race: false });
      const beaten = Object.entries(bosses)
        .filter(([, fact]) => fact === true)
        .map(([dungeon]) => dungeon);
      expect(beaten, code).toEqual([code]);
    }
  });

  it("reads the goal from the game mode or StatsLocked", () => {
    const goal = (image: Image, read?: (id: string) => boolean) =>
      decodeProgress(image.view({ read }), { race: false }).goal;
    expect(goal(new Image().set(0x7e_0010, 0x19))).toBe(true);
    expect(goal(new Image().set(0x7e_0010, 0x1a))).toBe(true);
    expect(goal(new Image().set(SAVE(0x443), 0x01))).toBe(true);
    expect(goal(new Image().set(0x7e_0010, 0x09))).toBe(false);
    // Past the credits the mode leaves the goal; StatsLocked stays.
    const later = new Image().set(0x7e_0010, 0x09).set(SAVE(0x443), 0x01);
    expect(goal(later)).toBe(true);
    // A mode outside the goal says nothing without StatsLocked.
    expect(goal(new Image(), (id) => id !== "stats-locked")).toBe("not-read");
    expect(
      goal(new Image().set(0x7e_0010, 0x19), (id) => id !== "stats-locked"),
    ).toBe(true);
  });

  it("reads an end-game file: every boss beaten, the goal reached", () => {
    const decoded = decodeProgress(endGame().view(), { race: false });
    expect(Object.values(decoded.bosses)).toEqual(Array(12).fill(true));
    expect(Object.values(decoded.completed)).toEqual(Array(12).fill(true));
    expect(decoded).toMatchObject({
      goal: true,
      rescueZelda: true,
      started: true,
    });
  });

  it("reads the file select as not started", () => {
    const { started } = decodeProgress(
      new Image().set(0x7e_0010, 0x01).view(),
      {
        race: false,
      },
    );
    expect(started).toBe(false);
  });
});

describe("Race Mode", () => {
  const forbidden = MEMORY_RANGES.filter((r) => !racePermitted(r.id)).map(
    (r) => r.id,
  );

  it("never asks for a forbidden range", () => {
    const view = endGame().view({ strict: true });
    expect(() => decodeItems(view, { race: true })).not.toThrow();
    expect(() => decodeChecks(view, { race: true })).not.toThrow();
    expect(() => decodeProgress(view, { race: true })).not.toThrow();
    // The strict view does throw when asked: the check above can fail.
    expect(() => decodeItems(view, { race: false })).toThrow(/forbidden/);
    expect(forbidden.length).toBeGreaterThan(0);
  });

  it("leaves the HUD and prize items unsettled, and only those", () => {
    const { atLeast, counts, unsettled } = decodeItems(
      endGame().view({ strict: true }),
      { race: true },
    );
    expect(Object.keys(unsettled).sort()).toEqual(
      [
        "bottle",
        "crystal1",
        "crystal2",
        "crystal3",
        "crystal4",
        "crystal5",
        "crystal6",
        "crystal7",
        "heartContainer",
        "pendantOfCourage",
        "pendantOfPower",
        "pendantOfWisdom",
        "pieceOfHeart",
      ].sort(),
    );
    expect(new Set(Object.values(unsettled))).toEqual(new Set(["race-mode"]));
    expect({ ...counts, ...atLeast }).toEqual(
      Object.fromEntries(
        Object.entries(END_GAME_ITEMS).filter(([id]) => !(id in unsettled)),
      ),
    );
  });

  it("withholds every dungeon location and reads every other", () => {
    const { checked, unsettled } = decodeChecks(
      endGame().view({ strict: true }),
      { race: true },
    );
    expect([...checked].sort()).toEqual([...OUTSIDE_IDS].sort());
    expect([...unsettled.keys()].sort()).toEqual([...DUNGEON_IDS].sort());
    expect(new Set(unsettled.values())).toEqual(new Set(["race-mode"]));
    expect(OUTSIDE_IDS.length).toBeGreaterThan(80);
  });

  it("reads the bosses and events as outside Race Mode, not the ROM's stats", () => {
    const image = endGame().set(SAVE(0x43e), 0x10, 0x0e);
    const { romStats: raced, ...race } = decodeProgress(
      image.view({ strict: true }),
      { race: true },
    );
    const { romStats, ...casual } = decodeProgress(image.view(), {
      race: false,
    });
    expect(race).toEqual(casual);
    expect(raced).toBe("race-mode");
    expect(romStats).toMatchObject({ playFrames: 0x0e10 });
  });

  it("says not-read before the first poll, in either mode", () => {
    const view = new Image().view({ read: () => false });
    for (const race of [false, true]) {
      const items = decodeItems(view, { race });
      expect(Object.keys(items.counts)).toEqual([]);
      expect(Object.keys(items.unsettled)).toHaveLength(READ.length);
      expect(decodeChecks(view, { race }).checked.size).toBe(0);
      expect(decodeProgress(view, { race }).goal).toBe("not-read");
    }
  });
});

describe("the decoders on random bytes", () => {
  const ids = MEMORY_RANGES.map((range) => range.id);
  const sizes = new Map(MEMORY_RANGES.map((range) => [range.id, range.size]));
  const memory = fc.record(
    Object.fromEntries(
      ids.map((id) => [
        id,
        fc.option(
          fc.oneof(
            fc.uint8Array({
              maxLength: sizes.get(id),
              minLength: sizes.get(id),
            }),
            fc.uint8Array({ maxLength: 4 }),
          ),
          { nil: null },
        ),
      ]),
    ) as Record<MemoryRangeId, fc.Arbitrary<Uint8Array | null>>,
  );
  const view = (ranges: Record<string, Uint8Array | null>): MemoryView => ({
    bytes: (id) => ranges[id] ?? new Uint8Array(0),
    has: (id) => ranges[id] !== null && ranges[id] !== undefined,
  });

  it("never throw, and keep every value within its bounds", () => {
    const max = new Map(ITEMS.map(({ id, max }) => [id, max]));
    const mapped = new Set(CHECK_FLAGS.map(({ id }) => id));
    fc.assert(
      fc.property(memory, fc.boolean(), (ranges, race) => {
        const items = decodeItems(view(ranges), { race });
        for (const id of ITEM_IDS) {
          const where = [items.counts, items.atLeast, items.unsettled].filter(
            (part) => id in part,
          );
          // An item memory does not hold is in none
          expect(where, id).toHaveLength(ITEM_SOURCES[id] === null ? 0 : 1);
          const value = items.counts[id] ?? items.atLeast[id];
          if (value !== undefined) {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(max.get(id) ?? 0);
            expect(Number.isInteger(value)).toBe(true);
          }
        }
        const checks = decodeChecks(view(ranges), { race });
        for (const id of [...checks.checked, ...checks.unsettled.keys()]) {
          expect(mapped.has(id)).toBe(true);
        }
        expect(checks.checked.size + checks.unsettled.size).toBeLessThanOrEqual(
          mapped.size,
        );
        const progress = decodeProgress(view(ranges), { race });
        for (const fact of [
          ...Object.values(progress.bosses),
          ...Object.values(progress.completed),
          progress.goal,
          progress.started,
          progress.rescueZelda,
        ]) {
          expect([true, false, "race-mode", "not-read"]).toContain(fact);
        }
      }),
      { numRuns: 300 },
    );
  });
});
