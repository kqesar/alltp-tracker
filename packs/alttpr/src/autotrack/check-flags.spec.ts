import { describe, expect, it } from "vitest";
import type { LocationDef } from "../location";
import type { RegionModule } from "../world";
import { OPEN_REGIONS } from "../worlds/open";
import { STANDARD_REGIONS } from "../worlds/standard";
import {
  CHECK_FLAGS,
  type CheckEntry,
  dungeonOf,
  UNMAPPED_LOCATIONS,
} from "./check-flags";
import {
  DUNGEONS,
  MEMORY_RANGE,
  ROOM_BITS,
  roomAddress,
  SAVE_DATA,
  SCREEN_ITEM,
  screenAddress,
} from "./memory";
import { ALTTPR_RACE_PROFILE } from "./race-profile";

interface Placed {
  readonly location: LocationDef;
  readonly region: string;
  readonly file: string;
}

function placed(modules: readonly RegionModule[]): Placed[] {
  return modules.flatMap((module) =>
    module.regions.flatMap((region) =>
      region.locations.map((location) => ({
        file: module.file,
        location,
        region: region.id,
      })),
    ),
  );
}

const STANDARD = placed(STANDARD_REGIONS);
const ALL_IDS = new Set(
  [...STANDARD, ...placed(OPEN_REGIONS)].map(({ location }) => location.id),
);
const KIND = new Map(
  STANDARD.map(({ location }) => [location.id, location.kind]),
);
const BY_ID = new Map(CHECK_FLAGS.map((entry) => [entry.id, entry]));

function entry(id: string): CheckEntry {
  const found = BY_ID.get(id);
  if (found === undefined) throw new Error(`no flag for ${id}`);
  return found;
}

/** The room and mask of a room flag. */
function roomOf(id: string): { room: number; mask: number } {
  const { flag } = entry(id);
  if (!("mask" in flag) || flag.size !== 2 || flag.at >= SAVE_DATA + 0x250) {
    throw new Error(`${id} is no room flag`);
  }
  return { mask: flag.mask, room: (flag.at - SAVE_DATA) / 2 };
}

const ROOM_FLAGS = CHECK_FLAGS.filter(
  ({ flag }) => flag.size === 2 && flag.at < SAVE_DATA + 0x250,
).map(({ id }) => ({ id, ...roomOf(id) }));

/** The upstream region files of the spec's dungeons. */
const DUNGEON_FILES = new Set(
  [
    "DesertPalace",
    "EasternPalace",
    "GanonsTower",
    "HyruleCastleEscape",
    "HyruleCastleTower",
    "IcePalace",
    "MiseryMire",
    "PalaceOfDarkness",
    "SkullWoods",
    "SwampPalace",
    "ThievesTown",
    "TowerOfHera",
    "TurtleRock",
  ].map((name) => `app/Region/Standard/${name}.php`),
);

describe("CHECK_FLAGS and UNMAPPED_LOCATIONS", () => {
  it("map or explain every location of both worlds, once", () => {
    const mapped = CHECK_FLAGS.map(({ id }) => id);
    const unmapped = UNMAPPED_LOCATIONS.map(({ id }) => id);
    expect(new Set(mapped).size).toBe(mapped.length);
    expect([...mapped, ...unmapped].sort()).toEqual([...ALL_IDS].sort());
    expect(mapped).toHaveLength(229);
    for (const { id, reason } of UNMAPPED_LOCATIONS) {
      expect(reason, id).toMatch(/^[A-Z].+\.$/);
    }
  });

  it("read each flag inside the range they name", () => {
    for (const { flag, id } of CHECK_FLAGS) {
      const range = MEMORY_RANGE[flag.range];
      expect(flag.at, id).toBeGreaterThanOrEqual(range.bus);
      expect(flag.at + flag.size, id).toBeLessThanOrEqual(
        range.bus + range.size,
      );
    }
  });

  it("read outside locations from race-permitted ranges only", () => {
    for (const { dungeon, flag, id } of CHECK_FLAGS) {
      const { category } = MEMORY_RANGE[flag.range];
      const expected =
        dungeon === null
          ? ["outside-checks"]
          : ["dungeon-checks", "boss-kills", "items"];
      expect(expected, id).toContain(category);
    }
    expect(ALTTPR_RACE_PROFILE.categories["outside-checks"]?.permitted).toBe(
      true,
    );
  });
});

describe("dungeonOf", () => {
  it("places in a dungeon what upstream's dungeon regions hold", () => {
    // The escape's region holds Link's Uncle and the Secret Passage, which
    // the compass totals leave out of Hyrule Castle (vt app/Rom.php:2015).
    const outside = new Set(["links-uncle", "secret-passage"]);
    for (const { file, location } of STANDARD) {
      const inDungeon = DUNGEON_FILES.has(file) && !outside.has(location.id);
      expect(dungeonOf(location.id) !== null, location.id).toBe(inDungeon);
    }
  });

  it("counts each dungeon's locations as the HUD compass counts do", () => {
    // vt app/Rom.php:2015, setCompassCountTotals: one total per DungeonID / 2,
    // sewers first; the sewers share Hyrule Castle's.
    const totals = [8, 8, 6, 6, 2, 10, 14, 8, 8, 8, 6, 8, 12, 27];
    const counts = new Map<string, number>();
    for (const id of ALL_IDS) {
      const code = dungeonOf(id);
      if (code === null || KIND.get(id) === "prize") continue;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    for (const dungeon of DUNGEONS) {
      expect(counts.get(dungeon.code), dungeon.name).toBe(totals[dungeon.keys]);
    }
  });
});

describe("room flags", () => {
  it("use the bits sram.asm documents, the boss bit for boss drops only", () => {
    const single = [
      ...ROOM_BITS.chests,
      ROOM_BITS.secondKey,
      ROOM_BITS.key,
      ROOM_BITS.boss,
    ];
    for (const { id, mask } of ROOM_FLAGS) expect(single, id).toContain(mask);
    const bosses = ROOM_FLAGS.filter(({ mask }) => mask === ROOM_BITS.boss);
    const byRoom = (a: number, b: number) => a - b;
    expect(bosses.map(({ room }) => room).sort(byRoom)).toEqual(
      DUNGEONS.flatMap((d) => ("bossRoom" in d ? [d.bossRoom] : [])).sort(
        byRoom,
      ),
    );
    expect(bosses.map(({ id }) => id).sort()).toEqual(
      [...KIND]
        .filter(([id, kind]) => kind === "drop" && id.endsWith("/boss"))
        .map(([id]) => id)
        .sort(),
    );
  });

  it("number a room's chests from chest 0 up", () => {
    const chests = new Map<number, number[]>();
    for (const { mask, room } of ROOM_FLAGS) {
      const index = ROOM_BITS.chests.indexOf(mask as never);
      if (index < 0) continue;
      chests.set(room, [...(chests.get(room) ?? []), index]);
    }
    expect(chests.size).toBeGreaterThan(60);
    for (const [room, indices] of chests) {
      const sorted = [...indices].sort((a, b) => a - b);
      expect(sorted, `room ${room.toString(16)}`).toEqual(
        sorted.map((_, i) => i),
      );
    }
  });

  it("put heart pieces where heartpieces.asm looks them up", () => {
    // LoadIndoorValue (heartpieces.asm:185-231): rooms in decimal.
    const indoor: Record<string, number> = {
      "cave-45": 283, // HeartPiece_Circle_Bushes
      "checkerboard-cave": 294, // HeartPiece_Mire_Warp
      "graveyard-ledge": 283, // HeartPiece_Graveyard_Warp
      "hammer-pegs": 295, // HeartPiece_Smith_Pegs
      "lost-woods-hideout": 225, // HeartPiece_Forest_Thieves
      "lumberjack-tree": 226, // HeartPiece_Lumberjack_Tree
      "spectacle-rock-cave": 234, // HeartPiece_Spectacle_Cave
      "tower-of-hera/basement-cage": 135, // StandingKey_Hera
    };
    for (const [id, room] of Object.entries(indoor)) {
      const flag = roomOf(id);
      expect(flag.room, id).toBe(room);
      expect([ROOM_BITS.key, ROOM_BITS.secondKey], id).toContain(flag.mask);
    }
    // LoadOutdoorValue (heartpieces.asm:233-301): screens.
    const outdoor: Record<string, number> = {
      "bumper-cave": 0x4a, // HeartPiece_Cliffside
      "desert-ledge": 0x30, // HeartPiece_Desert
      "digging-game": 0x68, // HeartPiece_Digging
      "floating-island": 0x05, // HeartPiece_Mountain_Warp
      "flute-spot": 0x2a, // HauntedGroveItem
      "lake-hylia-island": 0x35, // HeartPiece_Lake
      "maze-race": 0x28, // HeartPiece_Maze
      pyramid: 0x5b, // HeartPiece_Pyramid
      "spectacle-rock": 0x03, // HeartPiece_Spectacle
      "sunken-treasure": 0x3b, // HeartPiece_Swamp
      "zoras-ledge": 0x81, // HeartPiece_Zora
    };
    for (const [id, screen] of Object.entries(outdoor)) {
      expect(entry(id).flag, id).toEqual({
        at: screenAddress(screen),
        mask: SCREEN_ITEM,
        range: "overworld",
        size: 1,
      });
    }
  });
});

describe("NPC and progress flags", () => {
  it("use the bits sram.asm documents", () => {
    // NpcFlags, sram.asm:240-247, as one little-endian word.
    const npc: Record<string, number> = {
      blacksmith: 0x0400,
      "bombos-tablet": 0x0200,
      catfish: 0x0020,
      "ether-tablet": 0x0100,
      "king-zora": 0x0002,
      library: 0x0080,
      "magic-bat": 0x8000,
      mushroom: 0x1000,
      "old-man": 0x0001,
      "potion-shop": 0x2000,
      sahasrahla: 0x0010,
      "sick-kid": 0x0004,
      stumpy: 0x0008,
    };
    for (const [id, mask] of Object.entries(npc)) {
      expect(entry(id).flag, id).toEqual({
        at: SAVE_DATA + 0x410,
        mask,
        range: "npc-flags",
        size: 2,
      });
    }
    // NpcFlagsVanilla (sram.asm:203-205) and ProgressFlags (sram.asm:194-195).
    const single: Record<string, [number, number]> = {
      "bottle-merchant": [0x3c9, 0x02],
      hobo: [0x3c9, 0x01],
      "links-uncle": [0x3c6, 0x01],
      "purple-chest": [0x3c9, 0x10],
    };
    for (const [id, [offset, mask]] of Object.entries(single)) {
      expect(entry(id).flag, id).toMatchObject({
        at: SAVE_DATA + offset,
        mask,
        size: 1,
      });
    }
  });

  it("tell the prizes and the Agahnims from the base patch's own flags", () => {
    expect(entry("eastern-palace/prize").flag).toEqual({
      at: SAVE_DATA + 0x472,
      mask: 0x2000,
      range: "dungeons-completed",
      size: 2,
    });
    expect(entry("zelda").flag).toMatchObject({
      atLeast: 2,
      range: "progress",
    });
    expect(entry("agahnim").flag).toMatchObject({
      atLeast: 3,
      range: "progress",
    });
    expect(entry("agahnim-2").flag).toMatchObject({
      at: SAVE_DATA + 0x40f,
      mask: 0x01,
      range: "agahnim-2",
    });
    expect(roomAddress(0x12)).toBe(entry("sanctuary").flag.at);
  });
});
