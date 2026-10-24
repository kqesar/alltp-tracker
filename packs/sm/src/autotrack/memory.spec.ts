import {
  assertRaceSafe,
  definePack,
  planReads,
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
  });

  it("reads only what races permit, which is everything it reads", () => {
    const plan = planReads(
      MEMORY_RANGES.filter((range) => "everyMs" in range),
      { barriers: [], gap: 16, limits: USB2SNES_LIMITS },
    );
    expect(() =>
      assertRaceSafe(plan, MAP_RANDO_RACE_PROFILE, [], []),
    ).not.toThrow();
    for (const category of new Set(MEMORY_RANGES.map((r) => r.category))) {
      expect(MAP_RANDO_RACE_PROFILE.categories[category]?.permitted).toBe(true);
    }
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
