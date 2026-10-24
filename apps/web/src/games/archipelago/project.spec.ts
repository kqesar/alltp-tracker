import { type ApSnapshot, EMPTY_SNAPSHOT } from "@alltp/archipelago";
import { describe, expect, it } from "vitest";
import { alttpNames } from "@/games/archipelago/fixtures";
import { kindOf, projectRun, unknownItem } from "@/games/archipelago/project";

const SNAPSHOT: ApSnapshot = {
  ...EMPTY_SNAPSHOT,
  checked: [1, 2],
  identity: {
    game: "A Link to the Past",
    generatorVersion: "0.6.8",
    seedName: "4242",
    slot: 1,
    team: 0,
  },
  items: [
    { flags: 1, item: 10, location: 1, player: 2 },
    { flags: 0, item: 23, location: 2, player: 1 },
    { flags: 2, item: 23, location: 3, player: 1 },
    { flags: 0, item: 99_999, location: 4, player: 1 },
  ],
  missing: [3],
  players: [
    {
      alias: "Link",
      game: "A Link to the Past",
      name: "Link",
      slot: 1,
      team: 0,
    },
    { alias: "Sam", game: "Super Metroid", name: "Samus", slot: 2, team: 0 },
    { alias: "Other", game: "SMZ3", name: "Other", slot: 1, team: 1 },
  ],
  raceMode: true,
  ready: true,
  room: {
    checksums: { "A Link to the Past": "abc" },
    games: ["A Link to the Past"],
    generatorVersion: "0.6.8",
    hintCost: 10,
    locationCheckPoints: 1,
    passwordRequired: false,
    seedName: "4242",
    serverVersion: "0.6.8",
  },
  slotName: "Link",
};

describe("projectRun", () => {
  it("names the items, one entry per name in the order they came", () => {
    const run = projectRun(SNAPSHOT, alttpNames(), null);
    expect(run?.items).toEqual([
      { count: 1, flags: 1, name: "Hookshot" },
      { count: 2, flags: 2, name: "Piece of Heart" },
      { count: 1, flags: 0, name: unknownItem(99_999) },
    ]);
    expect(run?.received).toBe(4);
    expect(run?.players).toEqual([
      { game: "A Link to the Past", name: "Link", slot: 1 },
      { game: "Super Metroid", name: "Sam", slot: 2 },
    ]);
    expect(run?.room).toEqual({
      checksum: "1858ba29ffb7bf55e9e71a76fc7aba1b5c0950e4",
      game: "A Link to the Past",
      generatorVersion: "0.6.8",
      seedName: "4242",
      slot: 1,
      slotName: "Link",
      team: 0,
    });
    expect(run).toMatchObject({
      checked: [1, 2],
      missing: [3],
      raceMode: true,
    });
  });

  it("keeps the checksum it knows until the room says one", () => {
    expect(projectRun(SNAPSHOT, null, "old")?.room?.checksum).toBe("abc");
    expect(
      projectRun({ ...SNAPSHOT, room: null, slotName: null }, null, "old")
        ?.room,
    ).toMatchObject({ checksum: "old", slotName: "" });
    expect(projectRun(SNAPSHOT, null, null)?.items[0]?.name).toBe(
      unknownItem(10),
    );
  });

  it("says nothing between connections", () => {
    expect(projectRun({ ...SNAPSHOT, ready: false }, null, null)).toBeNull();
    expect(projectRun(EMPTY_SNAPSHOT, null, null)).toBeNull();
  });
});

describe("kindOf", () => {
  it("ranks progression over useful over trap", () => {
    expect(kindOf(0)).toBe("filler");
    expect(kindOf(1)).toBe("progression");
    expect(kindOf(3)).toBe("progression");
    expect(kindOf(2)).toBe("useful");
    expect(kindOf(6)).toBe("useful");
    expect(kindOf(4)).toBe("trap");
  });
});
