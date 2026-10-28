import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ITEM_IDS, ITEMS, type ItemId } from "../items";
import { CHECK_FLAGS } from "./check-flags";
import {
  decodeChecks,
  decodeEntrances,
  decodeGoalPieces,
  decodeHealth,
  decodeItems,
  decodePrizesHeld,
  decodeProgress,
  FRAMES_PER_SECOND,
  ITEM_SOURCES,
  type MemoryView,
  playTimeMs,
  racePermitted,
} from "./decode";
import tables from "./entrance-tables.json" with { type: "json" };
import { MEMORY_RANGE, MEMORY_RANGES, type MemoryRangeId } from "./memory";

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
  // DungeonCollectedKeys, sewers first (sram.asm:361-375).
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
    if (kind === "key") image.set(SAVE(0x4e0 + keyBytes[code]), level);
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

/** Every item's count. */
function values(view: MemoryView, race = false): Record<string, number> {
  return decodeItems(view, { race }).counts;
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
    expect(decoded.counts).toEqual({
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

  it("counts the small keys found, not those held", () => {
    // Two Palace of Darkness keys found, one spent on a door: DungeonKeys
    // holds one, DungeonCollectedKeys two.
    const image = new Image().set(SAVE(0x37c + 6), 1).set(SAVE(0x4e0 + 6), 2);
    expect(values(image.view()).keyD1).toBe(2);
    // A key an enemy or a pot drops is held, never counted as found.
    expect(values(new Image().set(SAVE(0x37c + 3), 1).view()).keyP2).toBe(0);
  });

  it("takes back the second count of Tower of Hera's basement key", () => {
    // The game counts its own key there twice (stats.asm:99-103), seen on a
    // real game: one key, the byte at 2. Taken back by name, not by the cap:
    // nothing is beyond Hera's one key.
    const read = (count: number) =>
      decodeItems(new Image().set(SAVE(0x4e0 + 10), count).view(), {
        race: false,
      });
    expect(read(2).counts.keyP3).toBe(1);
    expect(read(2).beyond).toEqual({});
    expect(read(1).counts.keyP3).toBe(1);
    // A count past the double count is still reported
    expect(read(3).counts.keyP3).toBe(1);
    expect(read(3).beyond).toEqual({ keyP3: 3 });
  });

  it("reports a key count beyond a dungeon's keys rather than hiding it", () => {
    // Ice Palace holds two keys: a third counted is a double count the
    // decoder does not know of. The rules get the cap, the readout the count.
    const decoded = decodeItems(new Image().set(SAVE(0x4e0 + 9), 3).view(), {
      race: false,
    });
    expect(decoded.counts.keyD5).toBe(2);
    expect(decoded.beyond).toEqual({ keyD5: 3 });
  });

  it("reads Hyrule Castle's keys from the castle or the sewers byte", () => {
    const sewers = new Image().set(SAVE(0x4e0), 1).view();
    expect(values(sewers).keyH2).toBe(1);
    const castle = new Image().set(SAVE(0x4e0 + 1), 1).view();
    expect(values(castle).keyH2).toBe(1);
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
      .set(SAVE(0x4e0 + 6), 2) // two Palace of Darkness keys found
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
      bigBomb: false,
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

describe("decodeEntrances", () => {
  // The rooms of two exits, as the base ROM's exit table leaves them: Old
  // Man Cave's west side ($F0) and Elder House's east one ($F2)
  const OLD_MAN_WEST = 0xf0;
  const ELDER_EAST = 0xf2;
  const exitOf = (room: number) =>
    (tables.exitRooms as Record<string, number>)[room] ?? -1;

  /** A console's entrance ranges: ROM tables, then where Link is. */
  const game = ({
    doors = {},
    holes = {},
    mode = 0x07,
    room = 0,
    entrance = 0,
    door = 0,
  }: {
    doors?: Record<number, number>;
    holes?: Record<number, number>;
    mode?: number;
    room?: number;
    entrance?: number;
    door?: number;
  }): MemoryView => {
    const table = (id: MemoryRangeId, set: Record<number, number>) => {
      const bytes = new Uint8Array(MEMORY_RANGE[id].size);
      for (const [slot, value] of Object.entries(set)) bytes[+slot] = value;
      return bytes;
    };
    const ranges: Partial<Record<MemoryRangeId, Uint8Array>> = {
      "door-table": table("door-table", doors),
      entrance: Uint8Array.of(entrance, 0),
      "game-mode": Uint8Array.of(mode),
      "hole-table": table("hole-table", holes),
      "overworld-door": Uint8Array.of(door),
      room: Uint8Array.of(room & 0xff, room >> 8),
    };
    return {
      bytes: (id) => ranges[id as MemoryRangeId] ?? new Uint8Array(0),
      has: (id) => ranges[id as MemoryRangeId] !== undefined,
    };
  };
  const casual = { race: false };

  it("reads the door Link went in by, as the door table says it loads", () => {
    const view = game({ door: 0x11, doors: { 16: 0x2a }, entrance: 0x2a });
    expect(decodeEntrances(view, casual)).toEqual([
      { entrance: 0x2a, kind: "door", slot: 0x10 },
    ]);
  });

  it("reads a hole once Link fell, the door before left behind", () => {
    // The base patch keeps the last door; the fall loads the hole's entrance
    const view = game({
      door: 0x11,
      doors: { 16: 0x2a },
      entrance: 0x79,
      holes: { 5: 0x79, 6: 0x79 },
    });
    expect(decodeEntrances(view, casual)).toEqual([
      { entrance: 0x79, kind: "hole", slot: 5 },
    ]);
  });

  it("reads nothing after a respawn, which keeps the door but loads entrance 0", () => {
    // As a real game showed after a save and quit: the slot stays, the
    // entrance loaded is 0 (2026-10-19)
    const view = game({ door: 0x58, doors: { 87: 0x0d }, entrance: 0 });
    expect(decodeEntrances(view, casual)).toEqual([]);
    // A fresh file has no slot yet
    expect(
      decodeEntrances(game({ doors: { 0: 0x01 }, entrance: 0x01 }), casual),
    ).toEqual([]);
  });

  it("reads the door Link came out by, from the room he left", () => {
    expect(exitOf(OLD_MAN_WEST)).toBeGreaterThan(0);
    const outdoors = {
      door: 0x11,
      doors: { 16: 0x2a, 64: exitOf(OLD_MAN_WEST) },
      entrance: 0x2a,
      mode: 0x09,
      room: OLD_MAN_WEST,
    };
    expect(decodeEntrances(game(outdoors), casual)).toEqual([
      { entrance: 0x2a, kind: "door", slot: 0x10 },
      { entrance: exitOf(OLD_MAN_WEST), kind: "door", slot: 0x40 },
    ]);
    // Indoors, the room is where Link is, not where he came out; in the
    // special overworld (the grove), he came out all the same
    expect(decodeEntrances(game({ ...outdoors, mode: 0x07 }), casual)).toEqual([
      { entrance: 0x2a, kind: "door", slot: 0x10 },
    ]);
    expect(
      decodeEntrances(game({ ...outdoors, mode: 0x0b }), casual),
    ).toHaveLength(2);
  });

  it("reads the way in and out by one door once", () => {
    const exit = exitOf(ELDER_EAST);
    const view = game({
      door: 0x31,
      doors: { 48: exit },
      entrance: exit,
      mode: 0x09,
      room: ELDER_EAST,
    });
    expect(decodeEntrances(view, casual)).toEqual([
      { entrance: exit, kind: "door", slot: 0x30 },
    ]);
  });

  it("reads no way out of a room no exit leaves, or that several doors load", () => {
    // Agahnim's room: Link warps out, by no exit of the table
    expect(exitOf(0x20)).toBe(-1);
    const out = (room: number, doors: Record<number, number>) =>
      decodeEntrances(game({ doors, mode: 0x09, room }), casual);
    expect(out(0x20, { 64: 0x20 })).toEqual([]);
    // A cave of one door brings Link back where he came in: no table entry
    expect(exitOf(0x112)).toBe(-1);
    const exit = exitOf(OLD_MAN_WEST);
    expect(out(OLD_MAN_WEST, { 64: exit, 65: exit })).toEqual([]);
    expect(out(OLD_MAN_WEST, { 64: exit })).toHaveLength(1);
  });

  it("never reads in Race Mode, and waits for every range", () => {
    expect(
      decodeEntrances(new Image().view({ strict: true }), { race: true }),
    ).toBe("race-mode");
    const view = new Image().view({ read: (id) => id !== "door-table" });
    expect(decodeEntrances(view, casual)).toBe("not-read");
  });

  it("sizes its tables as the importer found them", () => {
    expect(MEMORY_RANGE["door-table"].size).toBe(tables.doors);
    expect(MEMORY_RANGE["hole-table"].size).toBe(tables.holes);
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

  it("withholds the crystals' numbers, Zelda's rescue and the heart counters, and only those", () => {
    const { counts, unsettled } = decodeItems(
      endGame().view({ strict: true }),
      { race: true },
    );
    expect(Object.keys(unsettled).sort()).toEqual(
      [
        // Which crystal is 5 or 6: v2.0 forbids telling it
        "crystal1",
        "crystal2",
        "crystal3",
        "crystal4",
        "crystal5",
        "crystal6",
        "crystal7",
        // The stats' counters, a HUD count Race Mode leaves alone
        "heartContainer",
        "pieceOfHeart",
        // v2.0: "may not alert whether or not Zelda was rescued"
        "rescueZelda",
      ].sort(),
    );
    expect(new Set(Object.values(unsettled))).toEqual(new Set(["race-mode"]));
    // The bottles (bottle contents) and the pendants (prizes upon
    // collection) are read
    expect(counts).toMatchObject({
      bottle: 4,
      pendantOfCourage: 1,
      pendantOfPower: 1,
      pendantOfWisdom: 1,
    });
    // The flute held, never whether it was activated
    expect(counts).toEqual({
      ...Object.fromEntries(
        Object.entries(END_GAME_ITEMS).filter(([id]) => !(id in unsettled)),
      ),
      flute: 1,
    });
  });

  it("reads the flute held in Race Mode, activated or not, as found alone", () => {
    // InventoryTracking: k the inactive flute $02, f the active one $01
    for (const [tracking, casual, race] of [
      [0x00, 0, 0],
      [0x02, 1, 1],
      [0x01, 2, 1],
    ] as const) {
      const image = new Image().set(SAVE(0x38c), tracking);
      expect(decodeItems(image.view(), { race: false }).counts.flute).toBe(
        casual,
      );
      expect(
        decodeItems(image.view({ strict: true }), { race: true }).counts.flute,
      ).toBe(race);
    }
  });

  it("reads every location, inside the dungeons too, but Zelda's rescue", () => {
    const { checked, unsettled } = decodeChecks(
      endGame().view({ strict: true }),
      { race: true },
    );
    const all = CHECK_FLAGS.map(({ id }) => id);
    expect([...checked].sort()).toEqual(
      all.filter((id) => id !== "zelda").sort(),
    );
    expect([...unsettled]).toEqual([["zelda", "race-mode"]]);
    expect(DUNGEON_IDS.length).toBeGreaterThan(130);
    expect(OUTSIDE_IDS.length).toBeGreaterThan(80);
  });

  it("reads the bosses and events as outside Race Mode, but not Zelda's rescue, the big bomb or the ROM's stats", () => {
    const image = endGame().set(SAVE(0x43e), 0x10, 0x0e).set(SAVE(0x3cc), 0x0d);
    const {
      bigBomb: raceBomb,
      rescueZelda: raceZelda,
      romStats: raced,
      ...race
    } = decodeProgress(image.view({ strict: true }), { race: true });
    const { bigBomb, rescueZelda, romStats, ...casual } = decodeProgress(
      image.view(),
      { race: false },
    );
    expect(race).toEqual(casual);
    expect([raced, raceZelda, raceBomb]).toEqual([
      "race-mode",
      "race-mode",
      "race-mode",
    ]);
    expect([rescueZelda, bigBomb]).toEqual([true, true]);
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

describe("decodePrizesHeld", () => {
  // PendantsField (sram.asm:139-140): Courage $04, Power $02, Wisdom $01.
  // CrystalsField (sram.asm:148-150): crystal 5 is $04, crystal 6 $01.
  const held = (pendants: number, crystals: number, race: boolean) =>
    decodePrizesHeld(
      new Image()
        .set(SAVE(0x374), pendants)
        .set(SAVE(0x37a), crystals)
        .view({ strict: race }),
      { race },
    );

  it("counts the prizes taken by class, in Race Mode as outside it", () => {
    for (const race of [false, true]) {
      expect(held(0x00, 0x00, race)).toEqual({
        crystal: 0,
        greenPendant: 0,
        pendant: 0,
      });
      expect(held(0x04, 0x00, race)).toEqual({
        crystal: 0,
        greenPendant: 1,
        pendant: 0,
      });
      expect(held(0x03, 0x7f, race)).toEqual({
        crystal: 7,
        greenPendant: 0,
        pendant: 2,
      });
    }
  });

  it("never tells a red crystal from another", () => {
    // Crystals 5 and 6, or crystals 1 and 2: the same reading
    expect(held(0, 0x04 | 0x01, true)).toEqual(held(0, 0x02 | 0x10, true));
    expect(held(0, 0x04 | 0x01, false)).toEqual(held(0, 0x02 | 0x10, false));
    // Bits no crystal sets are not counted
    expect(held(0xf8, 0x80, false)).toEqual({
      crystal: 0,
      greenPendant: 0,
      pendant: 0,
    });
  });

  it("waits for both fields", () => {
    const view = new Image().view({ read: (id) => id === "pendants" });
    expect(decodePrizesHeld(view, { race: true })).toBe("not-read");
  });
});

describe("the big bomb", () => {
  // FollowerIndicator (sram.asm:208-211): $0D the big bomb, $01 Zelda
  const follower = (value: number) =>
    decodeProgress(freshFile("open").set(SAVE(0x3cc), value).view(), {
      race: false,
    }).bigBomb;

  it("is seen while Link carries it, and no other follower", () => {
    expect(follower(0x0d)).toBe(true);
    for (const other of [0x00, 0x01, 0x04, 0x0a, 0x0c]) {
      expect(follower(other), String(other)).toBe(false);
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
          const where = [items.counts, items.unsettled].filter(
            (part) => id in part,
          );
          // An item memory does not hold is in none
          expect(where, id).toHaveLength(ITEM_SOURCES[id] === null ? 0 : 1);
          const value = items.counts[id];
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
        const entrances = decodeEntrances(view(ranges), { race });
        if (typeof entrances !== "string") {
          expect(race).toBe(false);
          expect(entrances.length).toBeLessThanOrEqual(2);
          for (const { kind, slot } of entrances) {
            const table = kind === "door" ? tables.doors : tables.holes;
            expect(slot).toBeLessThan(table);
          }
        }
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

describe("decodeGoalPieces", () => {
  const GOAL_COUNTER = SAVE(0x418);
  const pieces = (count: number, race = false) =>
    decodeGoalPieces(
      new Image()
        .set(GOAL_COUNTER, count & 0xff)
        .set(GOAL_COUNTER + 1, count >> 8)
        .view({ strict: race }),
      { race },
    );

  it("reads the goal items found, a word", () => {
    expect(pieces(0)).toBe(0);
    expect(pieces(12)).toBe(12);
    expect(pieces(50)).toBe(50);
  });

  it("reads them in Race Mode, which v2.0 lists among the items", () => {
    expect(racePermitted("goal-counter")).toBe(true);
    expect(pieces(7, true)).toBe(7);
  });

  it("settles nothing past what a goal asks for or before it is read", () => {
    expect(pieces(51)).toBe("not-read");
    expect(pieces(0x0100)).toBe("not-read");
    expect(
      decodeGoalPieces(new Image().view({ read: () => false }), {
        race: false,
      }),
    ).toBe("not-read");
  });
});

describe("decodeHealth", () => {
  const MAX_HEALTH = SAVE(0x36c);
  const PIECES = SAVE(0x36b);
  const health = (max: number, pieces = 0, race = false) =>
    decodeHealth(
      new Image()
        .set(PIECES, pieces)
        .set(MAX_HEALTH, max)
        .view({ strict: race }),
      { race },
    );

  it("reads the hearts on screen, $08 a heart", () => {
    expect(health(0x18)).toEqual({ hearts: 3, quarters: 0 });
    expect(health(0x50)).toEqual({ hearts: 10, quarters: 0 });
    expect(health(0xa0)).toEqual({ hearts: 20, quarters: 0 });
  });

  it("reads the pieces toward the next heart beside them: 9 and three pieces", () => {
    expect(health(0x48, 3)).toEqual({ hearts: 9, quarters: 3 });
    expect(health(0x48, 1)).toEqual({ hearts: 9, quarters: 1 });
  });

  it("reads both in Race Mode, which v2.0 lets react to the heart and piece counts", () => {
    expect(racePermitted("health")).toBe(true);
    expect(health(0x50, 3, true)).toEqual({ hearts: 10, quarters: 3 });
  });

  it("settles nothing off the scale or before it is read", () => {
    expect(health(0)).toBe("not-read");
    expect(health(0xa8)).toBe("not-read");
    // HeartPieceQuarter wraps after $03: more is no save of the game's
    expect(health(0x50, 4)).toBe("not-read");
    expect(
      decodeHealth(new Image().view({ read: () => false }), { race: false }),
    ).toBe("not-read");
  });
});
