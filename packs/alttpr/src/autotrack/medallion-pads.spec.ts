import { describe, expect, it } from "vitest";
import type { MemoryView } from "./decode";
import { decodeMedallions } from "./medallion-pads";
import { GAME_MODES, MEMORY_RANGE, type MemoryRangeId } from "./memory";
import { ALTTPR_RACE_PROFILE } from "./race-profile";

/** Ranges' bytes, by id; a range left out was not read. */
const view = (
  ranges: Partial<Record<MemoryRangeId, number[]>>,
): MemoryView => ({
  bytes: (id) => Uint8Array.from(ranges[id as MemoryRangeId] ?? []),
  has: (id) => id in ranges,
});

/** Every seed's CrystalPendantFlags_2: three pendants, seven crystals. */
const KINDS = [
  0x00, 0x40, 0x00, 0x40, 0x00, 0x40, 0x40, 0x40, 0x00, 0x40, 0x40,
];

const MIRE_SCREEN = 0x70;
const ROCK_SCREEN = 0x47;
const OPENED = 0x20;

/** A game in play on `screen`, asking `mire` and `rock` ($00 Bombos, $01 Ether, $02 Quake). */
const game = ({
  mire = 0x01,
  mode = GAME_MODES.overworld,
  opened = [],
  rock = 0x02,
  screen = 0x30,
}: {
  mire?: number;
  mode?: number;
  opened?: readonly number[];
  rock?: number;
  screen?: number;
} = {}) => {
  const events = Array<number>(MEMORY_RANGE.overworld.size).fill(0);
  for (const at of opened) events[at] |= OPENED;
  return {
    "game-mode": [mode],
    medallions: [mire, rock],
    overworld: events,
    "overworld-screen": [screen],
    "prize-kinds": KINDS,
  } satisfies Partial<Record<MemoryRangeId, number[]>>;
};

const decode = (ranges: Partial<Record<MemoryRangeId, number[]>>) =>
  decodeMedallions(view(ranges), { race: false });

describe("decodeMedallions", () => {
  it("decodes $00 Bombos, $01 Ether and $02 Quake for each pad", () => {
    const at = (mire: number, rock: number) =>
      decode(game({ mire, opened: [MIRE_SCREEN, ROCK_SCREEN], rock }));
    expect(at(0, 1)).toEqual({
      mire: { medallion: "bombos", shownBy: "opened" },
      turtleRock: { medallion: "ether", shownBy: "opened" },
    });
    expect(at(2, 0)).toEqual({
      mire: { medallion: "quake", shownBy: "opened" },
      turtleRock: { medallion: "bombos", shownBy: "opened" },
    });
  });

  it("shows a pad's medallion while its screen is in view, and no other", () => {
    expect(decode(game({ screen: MIRE_SCREEN }))).toEqual({
      mire: { medallion: "ether", shownBy: "on-screen" },
    });
    expect(decode(game({ screen: ROCK_SCREEN }))).toEqual({
      turtleRock: { medallion: "quake", shownBy: "on-screen" },
    });
  });

  it("shows a pad's medallion once its entrance is open, wherever Link is", () => {
    expect(decode(game({ opened: [ROCK_SCREEN], screen: 0x00 }))).toEqual({
      turtleRock: { medallion: "quake", shownBy: "opened" },
    });
    // The opened bit is read from the pad's own screen only
    expect(
      decode(game({ opened: [ROCK_SCREEN - 1, MIRE_SCREEN + 1] })),
    ).toEqual({});
  });

  it("shows nothing before the player could know it", () => {
    // Anywhere else on the overworld, both worlds' screens beside the pads
    for (const screen of [0x00, 0x30, 0x40, 0x46, 0x48, 0x6f, 0x71, 0x80]) {
      expect(decode(game({ screen }))).toEqual({});
    }
    // A cave or a dungeon, where OverworldIndex keeps the screen Link left
    for (const mode of [0x07, 0x0b, 0x0e, 0x19]) {
      expect(decode(game({ mode, screen: MIRE_SCREEN }))).toEqual({});
      expect(decode(game({ mode, screen: ROCK_SCREEN }))).toEqual({});
    }
    // The entrance of the other pad opens nothing here
    expect(decode(game({ opened: [0x30, 0x3f, 0x5b] }))).toEqual({});
  });

  it("takes a condition whose range is not read as not met", () => {
    const { "game-mode": _mode, ...noMode } = game({ screen: MIRE_SCREEN });
    expect(decode(noMode)).toEqual({});
    const { "overworld-screen": _screen, ...noScreen } = game({
      screen: MIRE_SCREEN,
    });
    expect(decode(noScreen)).toEqual({});
    const { overworld: _events, ...noEvents } = game({ screen: MIRE_SCREEN });
    expect(decode(noEvents)).toEqual({
      mire: { medallion: "ether", shownBy: "on-screen" },
    });
    const { overworld: _gone, ...noneOpened } = game({ screen: 0x00 });
    expect(decode(noneOpened)).toEqual({});
  });

  it("names no medallion a seed's table cannot hold", () => {
    expect(decode(game({ mire: 3, rock: 0xff, screen: MIRE_SCREEN }))).toEqual(
      {},
    );
    expect(decode(game({ mire: 3, rock: 0, screen: ROCK_SCREEN }))).toEqual({
      turtleRock: { medallion: "bombos", shownBy: "on-screen" },
    });
  });

  it("tells nothing without the ROM's tables, or from a zero-filled ROM", () => {
    const { medallions: _table, ...noTable } = game({ screen: MIRE_SCREEN });
    expect(decode(noTable)).toBe("not-read");
    const { "prize-kinds": _kinds, ...noKinds } = game({ screen: MIRE_SCREEN });
    expect(decode(noKinds)).toBe("not-read");
    // Zeros would read as Bombos for both pads
    expect(
      decode({
        ...game({ screen: MIRE_SCREEN }),
        medallions: [0, 0],
        "prize-kinds": Array(11).fill(0),
      }),
    ).toBe("not-read");
    // Bytes that are not a seed's table: not seven crystals
    expect(
      decode({
        ...game({ screen: MIRE_SCREEN }),
        "prize-kinds": Array(11).fill(0x40),
      }),
    ).toBe("not-read");
  });

  it("reads nothing in Race Mode, whose profile forbids every range it reads", () => {
    const asked: string[] = [];
    const memory: MemoryView = {
      bytes: (id) => {
        asked.push(id);
        return new Uint8Array(0x100);
      },
      has: (id) => {
        asked.push(id);
        return true;
      },
    };
    expect(decodeMedallions(memory, { race: true })).toBe("race-mode");
    expect(asked).toEqual([]);
    for (const id of [
      "medallions",
      "overworld-screen",
      "prize-kinds",
    ] as const) {
      expect(
        ALTTPR_RACE_PROFILE.categories[MEMORY_RANGE[id].category]?.permitted,
      ).toBe(false);
    }
  });

  it("asks for the pad screens' ROM byte at $30:8022 and the screen at $7E:008A", () => {
    expect(MEMORY_RANGE.medallions.bus).toBe(0x30_8022);
    expect(MEMORY_RANGE.medallions.size).toBe(2);
    expect(MEMORY_RANGE["overworld-screen"].bus).toBe(0x7e_008a);
  });
});
