import {
  assertRaceSafe,
  type ByteRange,
  definePack,
  planReads,
  RaceViolationError,
  USB2SNES_LIMITS,
} from "@alltp/autotrack";
import { describe, expect, it } from "vitest";
import { MEMORY_RANGE, MEMORY_RANGES } from "./memory";
import { MAP_RANDO_AUTOTRACK } from "./pack";
import { checkGame, MAP_RANDO_GAME_CHECK, MAP_RANDO_TITLE } from "./probes";
import { MAP_RANDO_RACE_PROFILE } from "./race-profile";

describe("MEMORY_RANGES", () => {
  it("is a valid @alltp/autotrack pack, with no race flag", () => {
    const pack = definePack({
      id: "map-rando",
      profile: MAP_RANDO_RACE_PROFILE,
      raceFlag: null,
      ranges: MEMORY_RANGES,
    });
    expect(pack.ranges).toHaveLength(MEMORY_RANGES.length);
    expect(MAP_RANDO_AUTOTRACK.id).toBe("map-rando");
  });

  it("lists ranges in address order, for the planner to coalesce", () => {
    const addresses = MEMORY_RANGES.map((range) => range.address);
    expect(addresses).toEqual([...addresses].sort((a, b) => a - b));
  });

  it("translates LoROM and WRAM addresses to FX Pak Pro space", () => {
    // Bank $DF's $FEF0 is ROM offset $2F_FEF0; WRAM $7E:xxxx is $F5:xxxx
    expect(MEMORY_RANGE.seed.address).toBe(0x2f_fef0);
    expect(MEMORY_RANGE["pack-sizes"].address).toBe(0x02_60b8);
    expect(MEMORY_RANGE.equipment.address).toBe(0xf5_09a2);
    expect(MEMORY_RANGE.events.address).toBe(0xf5_d820);
    // The RTA clock: SRAM $70:1E10 is $E0:1E10, and sorts before the WRAM byte
    expect(MEMORY_RANGE["rta-saved"].address).toBe(0xe0_1e10);
    expect(MEMORY_RANGE["rta-pending"].address).toBe(0xf5_1f80);
    // The locations: the collected bits $7E:D870 are $F5:D870, the Nothing
    // mask at bank $B5's $FE12 is ROM offset $1A_FE12
    expect(MEMORY_RANGE.collected.address).toBe(0xf5_d870);
    expect(MEMORY_RANGE.collected.size).toBe(0x14);
    expect(MEMORY_RANGE["nothing-mask"].address).toBe(0x1a_fe12);
    expect(MEMORY_RANGE["nothing-mask"].size).toBe(0x14);
  });

  it("polls the Nothing mask with the collected bits, so both come from one tick", () => {
    expect(MEMORY_RANGE["nothing-mask"]).toMatchObject({
      everyMs: MEMORY_RANGE.collected.everyMs,
    });
    expect(MEMORY_RANGE.collected.everyMs).toBe(1000);
  });

  const racePack = definePack({
    id: "map-rando",
    profile: MAP_RANDO_RACE_PROFILE,
    raceFlag: null,
    ranges: MEMORY_RANGES,
  });
  const polled = MEMORY_RANGES.filter((range) => "everyMs" in range);
  const clock = [MEMORY_RANGE["rta-saved"], MEMORY_RANGE["rta-pending"]];
  /** The game's own in-game time, $7E:09DA-$7E:09E1: frames to hours. */
  const igt = { address: 0xf5_09da, size: 8 };
  const locations = [MEMORY_RANGE.collected, MEMORY_RANGE["nothing-mask"]];
  const overlaps = (a: ByteRange, b: ByteRange) =>
    a.address < b.address + b.size && b.address < a.address + a.size;

  it("permits the items and the boss kills, and what reading them needs, alone", () => {
    const forbidden = MEMORY_RANGES.filter(
      (range) => !MAP_RANDO_RACE_PROFILE.categories[range.category]?.permitted,
    ).map((range) => `${range.id}:${range.category}`);
    expect(forbidden).toEqual([
      // The seed's objectives and settings: the player's in a race
      "objective-count:objectives",
      "objective-flags:objectives",
      "nothing-mask:locations",
      "seed:seed",
      "rta-saved:game-time",
      "rta-pending:game-time",
      // The escape, the statues used, the rooms cleared
      "events:events",
      "collected:locations",
    ]);
    for (const category of new Set(MEMORY_RANGES.map((r) => r.category))) {
      expect(MAP_RANDO_RACE_PROFILE.categories[category]).toBeDefined();
    }
  });

  it("reads nothing of the RTA clock nor of the locations in Race Mode", () => {
    // Race Mode's phase: the permitted ranges only, every forbidden byte
    // barred from a bridged gap
    const plan = planReads(
      polled.filter(
        (range) => MAP_RANDO_RACE_PROFILE.categories[range.category]?.permitted,
      ),
      {
        barriers: racePack.raceBarriers,
        gap: racePack.gap,
        limits: USB2SNES_LIMITS,
      },
    );
    expect(() =>
      assertRaceSafe(
        plan,
        MAP_RANDO_RACE_PROFILE,
        racePack.permittedBytes,
        racePack.forbiddenBytes,
      ),
    ).not.toThrow();
    for (const request of plan.requests) {
      for (let i = 0; i < request.pieces.length; i += 2) {
        const piece = {
          address: request.pieces[i],
          size: request.pieces[i + 1],
        };
        expect(clock.some((range) => overlaps(range, piece))).toBe(false);
        expect(locations.some((range) => overlaps(range, piece))).toBe(false);
        expect(overlaps(igt, piece)).toBe(false);
        for (const id of [
          "objective-count",
          "objective-flags",
          "seed",
          "events",
        ] as const) {
          expect(overlaps(MEMORY_RANGE[id], piece), id).toBe(false);
        }
      }
    }
    // The ranges are polled outside a race, so the exclusion is the profile's
    expect(polled).toEqual(expect.arrayContaining(locations));
    // And the guard stops a plan that reads the locations
    const peeking = planReads(locations, {
      barriers: [],
      gap: racePack.gap,
      limits: USB2SNES_LIMITS,
    });
    expect(() =>
      assertRaceSafe(
        peeking,
        MAP_RANDO_RACE_PROFILE,
        racePack.permittedBytes,
        racePack.forbiddenBytes,
      ),
    ).toThrow(RaceViolationError);
    // And the guard stops a plan that does read it
    const reading = planReads(clock, {
      barriers: [],
      gap: racePack.gap,
      limits: USB2SNES_LIMITS,
    });
    expect(() =>
      assertRaceSafe(
        reading,
        MAP_RANDO_RACE_PROFILE,
        racePack.permittedBytes,
        racePack.forbiddenBytes,
      ),
    ).toThrow(RaceViolationError);
  });

  it("permits no byte of the in-game time, between the equipment and the tanks disabled", () => {
    // The equipment stops at the reserves' maximum; the tanks disabled follow
    // the in-game time
    expect(MEMORY_RANGE.equipment.address + MEMORY_RANGE.equipment.size).toBe(
      0xf5_09d6,
    );
    expect(MEMORY_RANGE["disabled-tanks"].address).toBe(0xf5_09ec);
    for (const range of MEMORY_RANGES) {
      expect(overlaps(range, igt), range.id).toBe(false);
    }
    expect(
      MAP_RANDO_RACE_PROFILE.permitted.some((window) => overlaps(window, igt)),
    ).toBe(false);
  });

  it("reads the clock's two parts in one request, SRAM first", () => {
    // clockStraddled relies on the order of the pieces
    const plan = planReads(clock, {
      barriers: [],
      gap: racePack.gap,
      limits: USB2SNES_LIMITS,
    });
    expect(plan.requests).toHaveLength(1);
    expect([...plan.requests[0].pieces]).toEqual([
      MEMORY_RANGE["rta-saved"].address,
      4,
      MEMORY_RANGE["rta-pending"].address,
      1,
    ]);
  });
});

describe("checkGame", () => {
  const header = (title: string) => {
    const bytes = new Uint8Array(0x20);
    bytes.set([...title].map((c) => c.charCodeAt(0)));
    return bytes;
  };

  it("takes a Map Rando seed by its cartridge name", () => {
    expect(checkGame(header(MAP_RANDO_TITLE))).toEqual({ ok: true });
    expect(MAP_RANDO_GAME_CHECK.ranges).toEqual(["rom-header"]);
    expect(
      MAP_RANDO_GAME_CHECK.verify(
        (id) =>
          id === "rom-header" ? header(MAP_RANDO_TITLE) : new Uint8Array(0),
        {
          device: { id: "ra://127.0.0.1:55355", kind: "retroarch" },
          flags: [],
          name: "retroarch",
          rom: "sm",
          romReadable: true,
          version: "1.22.2",
        },
      ),
    ).toEqual({ ok: true });
  });

  it("refuses the original game, another ROM, or a header read as zeros", () => {
    expect(checkGame(header("Super Metroid        "))).toMatchObject({
      code: "vanilla-sm",
      ok: false,
    });
    expect(checkGame(header("VT abcdefghij"))).toMatchObject({
      code: "not-map-rando",
    });
    // AP 0.6.8's Super Metroid (VARIA's): the Archipelago board follows it
    expect(checkGame(header("SM068_2_42424242424"))).toMatchObject({
      code: "archipelago-rom",
      message: expect.stringContaining("Follow your slot on the Archipelago"),
    });
    expect(checkGame(header("SMALL GAME"))).toMatchObject({
      code: "not-map-rando",
    });
    expect(checkGame(new Uint8Array(0x20))).toMatchObject({
      code: "zero-filled",
    });
  });
});
