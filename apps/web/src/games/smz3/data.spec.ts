import { ITEMS, KEYCARDS } from "@alltp/pack-smz3";
import { describe, expect, it } from "vitest";
import {
  gridOf,
  KEY_CELLS,
  KEYCARD_AREAS,
  keycardId,
  REWARD_CELLS,
  SM_CELLS,
  SMZ3_COLUMNS,
  ZELDA_CELLS,
} from "@/games/smz3/data";

describe("the SMZ3 board's cells", () => {
  it("give every key of the pools a dungeon's cell, and every keycard its area's", () => {
    const keys = KEY_CELLS.flatMap(({ bigKey, smallKey }) =>
      [bigKey, smallKey].filter((id) => id !== undefined),
    );
    const pooled = ITEMS.map(({ id }) => id).filter((id) =>
      /^(big)?[kK]ey[A-Z]/.test(id),
    );
    expect([...keys].sort()).toEqual([...pooled].sort());
    const cards = KEYCARD_AREAS.flatMap((area) =>
      area.levels.map((level) => keycardId(area.id, level)),
    );
    expect([...cards].sort()).toEqual([...KEYCARDS].sort());
  });

  it("lay the key cells' two rows only under keysanity", () => {
    const rows = (cells: readonly unknown[]) =>
      Math.ceil(cells.length / SMZ3_COLUMNS);
    const plain = rows(ZELDA_CELLS) + rows(SM_CELLS) + rows(REWARD_CELLS);
    expect(gridOf(false)).toHaveLength(plain);
    expect(gridOf(true)).toHaveLength(plain + rows(KEY_CELLS));
    for (const row of gridOf(true)) expect(row).toHaveLength(SMZ3_COLUMNS);
  });
});
