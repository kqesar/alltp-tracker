import {
  assertRaceSafe,
  type ByteRange,
  definePack,
  planPieces,
  planReads,
  USB2SNES_LIMITS,
} from "@alltp/autotrack";
import { describe, expect, it } from "vitest";
import {
  outside,
  raceReads,
} from "../../../../packages/autotrack/test/race-reads";
import {
  DUNGEONS,
  MEMORY_RANGE,
  MEMORY_RANGES,
  roomAddress,
  screenAddress,
} from "./memory";
import { ALTTPR_AUTOTRACK } from "./pack";
import { ALTTPR_RACE_PROFILE } from "./race-profile";

const pack = definePack({
  id: "alttpr",
  profile: ALTTPR_RACE_PROFILE,
  ranges: MEMORY_RANGES,
});
const permitted = (id: string) =>
  ALTTPR_RACE_PROFILE.categories[
    MEMORY_RANGE[id as keyof typeof MEMORY_RANGE].category
  ]?.permitted;

/**
 * The plan of one full tick's phase: every polled range of that phase, the
 * dark room's switch on: its gate bytes ride in the casual plan, the rest of
 * it is gated and read apart (see dark-room.spec.ts).
 */
function phasePlan(race: boolean) {
  const ranges = MEMORY_RANGES.filter(
    (range) =>
      "everyMs" in range && !("when" in range) && permitted(range.id) === race,
  );
  const plan = planReads(ranges, {
    barriers: race ? pack.raceBarriers[0] : [],
    gap: pack.gap,
    limits: USB2SNES_LIMITS,
  });
  return { plan, ranges };
}

/**
 * Every range Race Mode reads, with its category: the header, the game
 * mode, the locations checked (outside and inside the dungeons), the bosses,
 * the items and dungeon items, the bottles, the heart count, the pendants
 * and crystals taken, the progress and the goal.
 */
const RACE_READS = [
  "rom-header:rom-header",
  "game-mode:game-start",
  "dungeon-rooms:dungeon-checks",
  "swamp-palace-boss-room:boss-kills",
  "tower-of-hera-boss-room:boss-kills",
  "skull-woods-boss-room:boss-kills",
  "kakariko-well-room:outside-checks",
  "desert-palace-boss-room:boss-kills",
  "hookshot-cave-room:outside-checks",
  "secret-passage-room:outside-checks",
  "palace-of-darkness-boss-room:boss-kills",
  "misery-mire-boss-room:boss-kills",
  "turtle-rock-boss-room:boss-kills",
  "thieves-town-boss-room:boss-kills",
  "eastern-palace-boss-room:boss-kills",
  "ice-palace-boss-room:boss-kills",
  "cave-rooms:outside-checks",
  "overworld:outside-checks",
  "equipment-a:items",
  "equipment-b:items",
  "equipment-c:items",
  "bottles:bottles",
  "compasses:items",
  "big-keys:keys",
  "maps:items",
  "health:health",
  "pendants:prizes-held",
  "crystals:prizes-held",
  "magic-upgrade:items",
  "item-tracking:items",
  "progress:items",
  "progress-flags:outside-checks",
  "npc-flags-vanilla:outside-checks",
  "agahnim-2:boss-kills",
  "npc-flags:outside-checks",
  // The Triforce pieces found (GoalCounter): v2.0 lists them as items
  "goal-counter:items",
  "stats-locked:goal",
  "dungeons-completed:items",
  // The small keys found (DungeonCollectedKeys)
  "collected-keys:keys",
];

const overlaps = (a: ByteRange, b: ByteRange) =>
  a.address < b.address + b.size && b.address < a.address + a.size;

describe("MEMORY_RANGES", () => {
  it("is a valid @alltp/autotrack pack under the ALttPR race profile", () => {
    // definePack throws on an unknown category or a race-permitted range
    // outside Race Mode's windows.
    expect(pack.ranges).toHaveLength(MEMORY_RANGES.length);
    // The dark room's position is read four times a second (NAV_MS)
    expect(pack.tickMs).toBe(250);
  });

  it("lists ranges in address order, for the planner to coalesce", () => {
    const addresses = MEMORY_RANGES.map((range) => range.address);
    expect(addresses).toEqual([...addresses].sort((a, b) => a - b));
  });

  it("translates A-bus addresses to FX Pak Pro space", () => {
    // LoROM bank $00 $FFC0 is ROM offset $7FC0; WRAM $7E:xxxx is $F5:xxxx.
    expect(MEMORY_RANGE["rom-header"]).toMatchObject({
      address: 0x00_7fc0,
      size: 0x20,
    });
    expect(MEMORY_RANGE["game-mode"]).toMatchObject({
      address: 0xf5_0010,
      size: 1,
    });
    expect(MEMORY_RANGE["dungeon-rooms"]).toMatchObject({
      address: 0xf5_f000,
      size: 0x1c2,
    });
    expect(MEMORY_RANGE["cave-rooms"]).toMatchObject({
      address: 0xf5_f1c2,
      size: 0x8e,
    });
    expect(MEMORY_RANGE.overworld).toMatchObject({
      address: 0xf5_f280,
      size: 0x82,
    });
    // DungeonCollectedKeys, inside Race Mode's save window
    expect(MEMORY_RANGE["collected-keys"]).toMatchObject({
      address: 0xf5_f4e0,
      category: "keys",
      size: 14,
    });
    expect(MEMORY_RANGE["dungeons-completed"]).toMatchObject({
      address: 0xf5_f472,
      size: 2,
    });
    // ROM folds each LoROM bank's upper half onto 32 KiB: bank $30's
    // $8045 is ROM offset $18_0045, where vt writes it (Rom.php:2053).
    expect(MEMORY_RANGE["dungeon-item-menu"].address).toBe(0x18_0045);
    expect(MEMORY_RANGE["initial-progress"].address).toBe(0x18_33c5);
    for (const range of MEMORY_RANGES) {
      expect(range.address, range.id).toBe(
        range.bus < 0x40_0000
          ? (range.bus >>> 16) * 0x8000 + (range.bus & 0x7fff)
          : range.bus - 0x7e_0000 + 0xf5_0000,
      );
    }
  });

  it("forbids exactly the seed's settings, the entrances, the prize table and map, the follower and the HUD", () => {
    const forbidden = MEMORY_RANGES.filter((range) => !permitted(range.id)).map(
      (range) => `${range.id}:${range.category}`,
    );
    expect(forbidden).toEqual([
      // Which prize each dungeon holds (prizes.ts)
      "prize-bits:prizes",
      // Where the seed's doors and holes lead, and where Link went through
      "hole-table:entrances",
      "door-table:entrances",
      // Outside Race Mode's windows: anything else, which Race Mode leaves
      "medallions:other",
      "map-mode:prizes",
      "swordless-mode:other",
      "dungeon-item-menu:other",
      "inverted-mode:other",
      "prize-kinds:prizes",
      "goal-items:other",
      "generic-keys:other",
      "tower-crystals:other",
      "ganon-crystals:other",
      "ganon-vulnerable:other",
      // The seed type, a setting a Mystery seed may hide (seed-settings.ts)
      "seed-type:other",
      "initial-pyramid:other",
      "initial-progress:other",
      // The dark room map (dark-room.ts): navigation, which no race permits
      "dark-room-mode:navigation",
      "dark-room-indoors:navigation",
      "dark-room-art-screens:navigation",
      "dark-room-link:navigation",
      "dark-room-stance:navigation",
      "overworld-screen:other",
      "room:entrances",
      "dark-room-room:navigation",
      "dark-room-art-view:navigation",
      "dark-room-layer:navigation",
      "entrance:entrances",
      "dark-room-lights:navigation",
      "dark-room-objects:navigation",
      "dark-room-chests:navigation",
      "dark-room-art-sprites:navigation",
      // The boss in a boss room (boss-rooms.ts): which room Link is in
      "boss-sprites:navigation",
      "dark-room-doors:navigation",
      "dark-room-art-bg2:navigation",
      "dark-room-art-bg1:navigation",
      "dark-room-dark:navigation",
      "dark-room-art-palette:navigation",
      "bomb-count:hud",
      "bottle-index:hud",
      // The world Link is in, which picks the world map's half
      "current-world:prizes",
      // Who follows Link: Zelda among them, whose rescue a race never tells
      "follower:other",
      "map-overlay:prizes",
      // The ROM's own stats, which no category of the spec permits
      "stats:other",
      "menu-frames:other",
      "heart-containers:hud",
      "stats-finds:other",
      "heart-pieces:hud",
      "dark-room-map:navigation",
      "overworld-door:entrances",
    ]);
  });

  it("overlaps only where a permitted room sits inside the dungeon rooms", () => {
    const pairs: string[] = [];
    MEMORY_RANGES.forEach((a, i) => {
      for (const b of MEMORY_RANGES.slice(i + 1)) {
        if (overlaps(a, b)) pairs.push(`${a.id}/${b.id}`);
      }
    });
    expect(pairs).toEqual([
      // The map's own copies of the mode and the room, `navigation`
      "game-mode/dark-room-mode",
      "room/dark-room-room",
      "dungeon-rooms/swamp-palace-boss-room",
      "dungeon-rooms/tower-of-hera-boss-room",
      "dungeon-rooms/skull-woods-boss-room",
      "dungeon-rooms/kakariko-well-room",
      "dungeon-rooms/desert-palace-boss-room",
      "dungeon-rooms/hookshot-cave-room",
      "dungeon-rooms/secret-passage-room",
      "dungeon-rooms/palace-of-darkness-boss-room",
      "dungeon-rooms/misery-mire-boss-room",
      "dungeon-rooms/turtle-rock-boss-room",
      "dungeon-rooms/thieves-town-boss-room",
      "dungeon-rooms/eastern-palace-boss-room",
      "dungeon-rooms/ice-palace-boss-room",
    ]);
  });

  it("reads each dungeon's boss room, and only those, as boss kills", () => {
    const bossRooms = MEMORY_RANGES.filter(
      (range) => range.category === "boss-kills",
    )
      .filter((range) => range.id !== "agahnim-2")
      .map((range) => range.bus);
    const expected = DUNGEONS.flatMap((dungeon) =>
      "bossRoom" in dungeon ? [roomAddress(dungeon.bossRoom)] : [],
    ).sort((a, b) => a - b);
    expect(bossRooms).toEqual(expected);
    expect(bossRooms).toHaveLength(10);
  });

  it("covers the overworld up to Zora's ledge, screen $81", () => {
    const { bus, size } = MEMORY_RANGE.overworld;
    expect(bus).toBe(screenAddress(0));
    expect(bus + size - 1).toBe(screenAddress(0x81));
  });

  it("never polls the HUD bytes between the equipment", () => {
    for (const id of ["bomb-count", "bottle-index"] as const) {
      expect(MEMORY_RANGE[id].everyMs, id).toBeUndefined();
    }
    const { plan } = phasePlan(true);
    for (const piece of planPieces(plan)) {
      for (const id of ["bomb-count", "bottle-index"] as const) {
        expect(overlaps(piece, MEMORY_RANGE[id]), id).toBe(false);
      }
    }
  });

  it("passes the race guard and reads in one request per phase", () => {
    const race = phasePlan(true);
    expect(() =>
      assertRaceSafe(race.plan, ALTTPR_RACE_PROFILE, pack.permittedBytes),
    ).not.toThrow();
    expect(race.plan.requests).toHaveLength(1);
    expect(phasePlan(false).plan.requests).toHaveLength(1);
  });

  it("lets Race Mode read the heart count and the heart piece count alone of the HUD", () => {
    const health = MEMORY_RANGES.filter((range) => range.category === "health");
    // HeartPieceQuarter, then MaximumHealth (sram.asm:130-132)
    expect(health.map((range) => [range.id, range.bus, range.size])).toEqual([
      ["health", 0x7e_f36b, 2],
    ]);
    expect(permitted("health")).toBe(true);
    expect(ALTTPR_RACE_PROFILE.categories.health?.rule).toContain(
      "heart count, heart piece count",
    );
    // The stats' heart counters (the pieces collected in all, the
    // containers) and the rest of the HUD stay the player's
    for (const id of ["heart-containers", "heart-pieces", "bomb-count"]) {
      expect(permitted(id), id).toBe(false);
    }
  });

  it("lets Race Mode read exactly what v2.0 names", () => {
    const read = MEMORY_RANGES.filter((range) => permitted(range.id)).map(
      (range) => `${range.id}:${range.category}`,
    );
    expect(read).toEqual(RACE_READS);
    // Each of v2.0's openings is one range under its own category
    for (const [id, category] of [
      ["dungeon-rooms", "dungeon-checks"],
      ["bottles", "bottles"],
      ["pendants", "prizes-held"],
      ["crystals", "prizes-held"],
    ] as const) {
      expect(MEMORY_RANGE[id].category, id).toBe(category);
      expect(
        ALTTPR_RACE_PROFILE.categories[category]?.rule,
        category,
      ).toContain(
        category === "bottles"
          ? "bottle contents"
          : category === "prizes-held"
            ? "but not identify if a crystal is a 5/6 crystal"
            : "dungeon-locations",
      );
    }
  });

  it("reads this many bytes on a full tick", () => {
    // Without the two race flag bytes, which the race phase adds. The seed's
    // settings count in: every range falls due on the first tick, and the
    // settings every 20th after (SETTINGS_MS). Outside races, where Link
    // went adds three pieces a second, and the ROM's door and hole tables
    // two with the settings; the prizes' tables (prizes.ts) one more, and
    // map mode and the prizes' kinds another, beside the settings; the pad
    // medallions (medallion-pads.ts) a piece with the settings and the
    // overworld screen one with the game mode. Race Mode asks for neither.
    // The dark room's gate (mode, indoors, dark: 4 bytes) rides in the casual
    // phase with its switch on, 13 bytes and 2 pieces over what it was; the
    // rest of it is gated, read apart. The seed type left the race phase
    // for the casual one (a setting, which Race Mode never reads). The heart
    // count and the pieces toward the next heart (health) join the race
    // phase: 3 bytes, the gap from the maps' range, in no new piece. The dungeon rooms, the bottles, the
    // pendants and the crystals joined it too (v2.0's dungeon-locations,
    // bottle contents and prizes upon collection): the rooms bridge the
    // boss rooms, so the race phase reads more bytes in fewer pieces; the
    // follower byte (the big bomb) joins the casual one. The sprites of a
    // boss room (boss-rooms.ts) join it too: 96 bytes in one more piece.
    // The small keys found (collected-keys)
    // replace the keys held: the casual plan already spans them, Race Mode
    // reads 14 bytes more, in one more piece. The Triforce pieces found
    // (goal-counter, a word v2.0 lists among the items) join it too: 2 bytes,
    // in one more piece. Race Mode bridges no byte outside its ranges (the
    // rupee and arrow counts, the ability flags, the keys held, the map icons,
    // the starting entrance): 35 bytes less, in six more pieces, one request.
    const race = phasePlan(true);
    const casual = phasePlan(false);
    expect({
      casual: {
        bytes: casual.plan.size,
        pieces: planPieces(casual.plan).length,
      },
      race: { bytes: race.plan.size, pieces: planPieces(race.plan).length },
      ranges: { casual: casual.ranges.length, race: race.ranges.length },
    }).toEqual({
      casual: { bytes: 436, pieces: 19 },
      race: { bytes: 793, pieces: 20 },
      ranges: { casual: 33, race: 38 },
    });
  });
});

/**
 * Where the game keeps Link's place, by the names z3randomizer's ram.asm gives
 * them (`z3:ram.asm`, MEMORY_SOURCES.z3) and, for the dungeon, the engine's
 * variables. The race admins' clarification of June 2026 bars a tracker from
 * identifying or displaying any of it in a race.
 */
const POSITION: readonly { name: string; bus: number; size: number }[] = [
  { bus: 0x7e_001b, name: "IndoorsFlag", size: 1 },
  { bus: 0x7e_0020, name: "LinkAbsoluteY / LinkPosY", size: 2 },
  { bus: 0x7e_0022, name: "LinkAbsoluteX / LinkPosX", size: 2 },
  { bus: 0x7e_008a, name: "OverworldIndex", size: 2 },
  { bus: 0x7e_00a0, name: "RoomIndex", size: 2 },
  { bus: 0x7e_00a2, name: "PreviousRoom", size: 2 },
  { bus: 0x7e_010e, name: "EntranceIndex", size: 2 },
  { bus: 0x7e_040c, name: "DungeonID", size: 2 },
];

const wram = (bus: number) => bus - 0x7e_0000 + 0xf5_0000;

/**
 * Save bytes between Race Mode's ranges that no range of it names, by
 * z3randomizer's sram.asm names: a merge once bridged them.
 */
const UNNAMED: readonly { name: string; bus: number; size: number }[] = [
  { bus: 0x7e_f360, name: "CurrentRupees / DisplayRupees", size: 4 },
  { bus: 0x7e_f36a, name: "WishingPond", size: 1 },
  { bus: 0x7e_f36d, name: "CurrentHealth to BombCapacity", size: 7 },
  { bus: 0x7e_f375, name: "BombsFiller to AbilityFlags", size: 5 },
  { bus: 0x7e_f37c, name: "DungeonKeys", size: 16 },
  { bus: 0x7e_f3c7, name: "MapIcons", size: 1 },
  { bus: 0x7e_f3c8, name: "StartingEntrance", size: 1 },
];

describe("Race Mode, byte by byte", () => {
  it("asks for no byte outside its ranges and the flag, in every state Race Mode can be on in", async () => {
    // The real poller: forced on, "auto" over a race ROM, a flag pending,
    // unknown or unreadable, the dark room's switches off and on, a whole
    // polling cycle, the game check first
    const reads = await raceReads(ALTTPR_AUTOTRACK);
    expect(reads.length).toBeGreaterThan(0);
    expect(outside(reads, ALTTPR_AUTOTRACK.permittedBytes)).toEqual([]);
    for (const place of UNNAMED) {
      const at = { address: wram(place.bus), size: place.size };
      expect(
        ALTTPR_AUTOTRACK.permittedBytes.some((range) => overlaps(range, at)),
        place.name,
      ).toBe(false);
      expect(
        reads.some((piece) => overlaps(piece, at)),
        place.name,
      ).toBe(false);
    }
  });

  it("has the guard refuse a plan that bridges them", () => {
    const bridging = planReads([MEMORY_RANGE.bottles, MEMORY_RANGE.compasses], {
      gap: 16,
      limits: USB2SNES_LIMITS,
    });
    expect(planPieces(bridging)).toHaveLength(1);
    expect(() =>
      assertRaceSafe(bridging, ALTTPR_RACE_PROFILE, pack.permittedBytes),
    ).toThrow(/\$F5F360, which no permitted range covers/);
  });
});

describe("Race Mode and Link's position", () => {
  it("permits no memory where Link, the room, the dungeon or the entrance are", () => {
    for (const place of POSITION) {
      const at = { address: wram(place.bus), size: place.size };
      const window = ALTTPR_RACE_PROFILE.permitted.find((range) =>
        overlaps(range, at),
      );
      expect(
        window,
        `${place.name} lies in a permitted window`,
      ).toBeUndefined();
    }
  });

  it("permits in low WRAM, where the game keeps all of it, the game mode alone", () => {
    const low = { address: 0xf5_0000, size: 0x2000 };
    expect(
      ALTTPR_RACE_PROFILE.permitted.filter((range) => overlaps(range, low)),
    ).toEqual([{ address: wram(0x7e_0010), size: 1 }]);
    // The one byte is read: the check above is not vacuous
    expect(MEMORY_RANGE["game-mode"]).toMatchObject({
      address: wram(0x7e_0010),
      size: 1,
    });
  });

  it("reads no race-permitted range over any of it", () => {
    for (const place of POSITION) {
      const at = { address: wram(place.bus), size: place.size };
      const readers = MEMORY_RANGES.filter(
        (range) => permitted(range.id) && overlaps(range, at),
      ).map((range) => range.id);
      expect(readers, place.name).toEqual([]);
    }
  });

  it("plans no race read over any of it, nor a bridge across", () => {
    const { plan } = phasePlan(true);
    const pieces = planPieces(plan);
    expect(pieces.length).toBeGreaterThan(0);
    for (const place of POSITION) {
      const at = { address: wram(place.bus), size: place.size };
      for (const piece of pieces) {
        expect(overlaps(piece, at), place.name).toBe(false);
      }
    }
    // The race flag is the only other thing the race phase adds
    expect(() =>
      assertRaceSafe(plan, ALTTPR_RACE_PROFILE, pack.permittedBytes),
    ).not.toThrow();
  });

  it("files each of its addresses under a category no race permits", () => {
    // Where the map reads them at all, so that a range can never be filed
    // under a permitted category without this failing.
    const wanted = POSITION.flatMap((place) =>
      MEMORY_RANGES.filter((range) =>
        overlaps(range, { address: wram(place.bus), size: place.size }),
      ),
    );
    expect(wanted.length).toBeGreaterThan(0);
    for (const range of wanted) {
      expect(permitted(range.id), range.id).toBe(false);
    }
  });

  it("refuses a pack that files a range over Link under a permitted category", () => {
    const bad = {
      address: wram(0x7e_0020),
      bus: 0x7e_0020,
      category: "items",
      everyMs: 250,
      id: "link-position",
      size: 4,
      source: "z3:ram.asm:51",
    };
    expect(() =>
      definePack({
        id: "alttpr",
        profile: ALTTPR_RACE_PROFILE,
        ranges: [bad],
      }),
    ).toThrow();
  });
});
