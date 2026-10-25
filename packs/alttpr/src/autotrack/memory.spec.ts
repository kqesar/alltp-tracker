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
  DUNGEONS,
  MEMORY_RANGE,
  MEMORY_RANGES,
  roomAddress,
  screenAddress,
} from "./memory";
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

/** The plan of one full tick's phase: every polled range of that phase. */
function phasePlan(race: boolean) {
  const ranges = MEMORY_RANGES.filter(
    (range) => "everyMs" in range && permitted(range.id) === race,
  );
  const plan = planReads(ranges, {
    barriers: race ? pack.raceBarriers : [],
    gap: pack.gap,
    limits: USB2SNES_LIMITS,
  });
  return { plan, ranges };
}

const overlaps = (a: ByteRange, b: ByteRange) =>
  a.address < b.address + b.size && b.address < a.address + a.size;

describe("MEMORY_RANGES", () => {
  it("is a valid @alltp/autotrack pack under the ALttPR race profile", () => {
    // definePack throws on an unknown category or a race-permitted range
    // outside Race Mode's windows.
    expect(pack.ranges).toHaveLength(MEMORY_RANGES.length);
    expect(pack.tickMs).toBe(500);
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
    expect(MEMORY_RANGE["small-keys"]).toMatchObject({
      address: 0xf5_f37c,
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

  it("forbids exactly the seed's settings, the entrances, the dungeon rooms, the prizes and the HUD", () => {
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
      "initial-pyramid:other",
      "initial-progress:other",
      "overworld-screen:other",
      "room:entrances",
      "entrance:entrances",
      "dungeon-rooms:dungeon-checks",
      "bomb-count:hud",
      "bottle-index:hud",
      "bottles:hud",
      "pendants:prizes",
      "crystals:prizes",
      "current-world:prizes",
      "map-overlay:prizes",
      // The ROM's own stats, which no category of the spec permits
      "stats:other",
      "menu-frames:other",
      "heart-containers:hud",
      "stats-finds:other",
      "heart-pieces:hud",
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
      assertRaceSafe(
        race.plan,
        ALTTPR_RACE_PROFILE,
        pack.permittedBytes,
        pack.forbiddenBytes,
      ),
    ).not.toThrow();
    expect(race.plan.requests).toHaveLength(1);
    expect(phasePlan(false).plan.requests).toHaveLength(1);
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
      casual: { bytes: 785, pieces: 19 },
      race: { bytes: 364, pieces: 25 },
      ranges: { casual: 31, race: 33 },
    });
  });
});
