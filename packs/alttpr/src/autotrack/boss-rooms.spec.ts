import { describe, expect, it } from "vitest";
import { BOSS_PLACES, bossesAt } from "../bosses";
import { BOSS_ROOMS, BOSS_SPRITES, decodeBosses } from "./boss-rooms";
import type { MemoryView } from "./decode";
import { MEMORY_RANGE, MEMORY_RANGES, type MemoryRangeId } from "./memory";
import { ALTTPR_RACE_PROFILE } from "./race-profile";

/** Ranges' bytes, by id; a range left out was not read. */
const view = (
  ranges: Partial<Record<MemoryRangeId, number[]>>,
): MemoryView => ({
  bytes: (id) => Uint8Array.from(ranges[id as MemoryRangeId] ?? []),
  has: (id) => id in ranges,
});

const DUNGEON = 0x07;
const OVERWORLD = 0x09;

/**
 * Link in `room` in game mode `mode`, with these sprites loaded: a type
 * each, its slot's state set (0 an empty slot).
 */
const game = ({
  mode = DUNGEON,
  room = 0x90,
  sprites = [],
}: {
  mode?: number;
  room?: number;
  sprites?: readonly (readonly [type: number, state: number])[];
}) => {
  const slots = Array<number>(MEMORY_RANGE["boss-sprites"].size).fill(0);
  sprites.forEach(([type, state], slot) => {
    slots[slot] = state;
    slots[0x50 + slot] = type;
  });
  return {
    "boss-sprites": slots,
    "game-mode": [mode],
    room: [room & 0xff, room >> 8],
  } satisfies Partial<Record<MemoryRangeId, number[]>>;
};

const decode = (ranges: Partial<Record<MemoryRangeId, number[]>>) =>
  decodeBosses(view(ranges), { race: false });

const BLIND = 0xce;
const VITREOUS = 0xbd;
const EYE = 0xbe;

describe("decodeBosses", () => {
  it("tells a dungeon's boss once Link stands in its room with it", () => {
    // Misery Mire's room holding Blind, as bGbbOaDWGP's does
    expect(decode(game({ sprites: [[BLIND, 0x09]] }))).toEqual({
      miseryMire: "blind",
    });
    // Vitreous among his eyes, which name no boss
    expect(
      decode(
        game({
          sprites: [
            [EYE, 0x09],
            [VITREOUS, 0x09],
            [EYE, 0x09],
          ],
        }),
      ),
    ).toEqual({ miseryMire: "vitreous" });
    // Trinexx's heads, Kholdstare in his shell: one boss each
    expect(
      decode(
        game({
          room: 0xa4,
          sprites: [
            [0xcb, 0x09],
            [0xcc, 0x09],
            [0xcd, 0x09],
          ],
        }),
      ),
    ).toEqual({ turtleRock: "trinexx" });
    expect(decode(game({ room: 0xde, sprites: [[0xa3, 0x09]] }))).toEqual({
      icePalace: "kholdstare",
    });
  });

  it("knows each boss room and each boss", () => {
    const places = Object.values(BOSS_ROOMS);
    expect(new Set(places).size).toBe(10);
    expect(
      Object.entries(BOSS_PLACES)
        .filter(([, { dungeon }]) => dungeon !== "ganons-tower")
        .map(([, { dungeon }]) => dungeon)
        .sort(),
    ).toEqual([...places].sort());
    expect(new Set(Object.values(BOSS_SPRITES))).toEqual(
      new Set(bossesAt("turtleRock")),
    );
  });

  it("tells nothing it cannot see: elsewhere, an empty slot, two bosses", () => {
    // Out of a boss room, or on the overworld
    expect(decode(game({ room: 0x91, sprites: [[BLIND, 0x09]] }))).toEqual({});
    expect(decode(game({ mode: OVERWORLD, sprites: [[BLIND, 0x09]] }))).toEqual(
      {},
    );
    // The second layer's rooms (EG2) are no boss rooms
    expect(decode(game({ room: 0x190, sprites: [[BLIND, 0x09]] }))).toEqual({});
    // A slot whose state is 0 holds no sprite, whatever its type says
    expect(decode(game({ sprites: [[BLIND, 0x00]] }))).toEqual({});
    // Two bosses' sprites: no guess
    expect(
      decode(
        game({
          sprites: [
            [BLIND, 0x09],
            [VITREOUS, 0x09],
          ],
        }),
      ),
    ).toEqual({});
    // A boss the slot cannot hold: Trinexx in Tower of Hera
    expect(decode(game({ room: 0x07, sprites: [[0xcb, 0x09]] }))).toEqual({});
  });

  it("reads nothing in Race Mode, nor without its ranges", () => {
    const ranges = game({ sprites: [[BLIND, 0x09]] });
    expect(decodeBosses(view(ranges), { race: true })).toBe("race-mode");
    const { "boss-sprites": _, ...noSprites } = ranges;
    expect(decode(noSprites)).toBe("not-read");
    // Neither range is one a race reads: they say which room Link is in
    for (const id of ["boss-sprites", "room"] as const) {
      const { category } = MEMORY_RANGE[id];
      expect(ALTTPR_RACE_PROFILE.categories[category]?.permitted, id).toBe(
        false,
      );
    }
    expect(MEMORY_RANGES.some(({ id }) => id === "boss-sprites")).toBe(true);
  });
});
