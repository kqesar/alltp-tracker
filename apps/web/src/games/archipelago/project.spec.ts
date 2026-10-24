import { type ApSnapshot, EMPTY_SNAPSHOT } from "@alltp/archipelago";
import { describe, expect, it } from "vitest";
import { alttpNames } from "@/games/archipelago/fixtures";
import {
  awayItems,
  kindOf,
  type NameLookup,
  neededForRun,
  projectRun,
  unknownItem,
} from "@/games/archipelago/project";

const ALTTP = alttpNames();
/** The slot's own names alone, as a board has them first. */
const alttp: NameLookup = (game) => (game === ALTTP.game ? ALTTP : null);
const none: NameLookup = () => null;

const SNAPSHOT: ApSnapshot = {
  ...EMPTY_SNAPSHOT,
  checked: [1, 2],
  clientStatus: { 1: 5 },
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
    const run = projectRun(SNAPSHOT, alttp, null);
    expect(run?.items).toEqual([
      { count: 1, flags: 1, name: "Hookshot" },
      { count: 2, flags: 2, name: "Piece of Heart" },
      { count: 1, flags: 0, name: unknownItem(99_999) },
    ]);
    expect(run?.received).toBe(4);
    expect(run?.players).toEqual([
      { game: "A Link to the Past", name: "Link", slot: 1, status: 5 },
      { game: "Super Metroid", name: "Sam", slot: 2, status: null },
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
    expect(projectRun(SNAPSHOT, none, "old")?.room?.checksum).toBe("abc");
    expect(
      projectRun({ ...SNAPSHOT, room: null, slotName: null }, none, "old")
        ?.room,
    ).toMatchObject({ checksum: "old", slotName: "" });
    expect(projectRun(SNAPSHOT, none, null)?.items[0]?.name).toBe(
      unknownItem(10),
    );
  });

  it("lays the hints, what was sent, the hint cost and, outside races, the slot data", () => {
    const snapshot: ApSnapshot = {
      ...SNAPSHOT,
      hintPoints: 4,
      hints: [
        // For Link, in Sam's world
        {
          entrance: "",
          finder: 2,
          flags: 1,
          found: false,
          item: 10,
          location: 99,
          receiver: 1,
          status: 30,
        },
        // For Sam, in Link's world
        {
          entrance: "Old Man Cave",
          finder: 1,
          flags: 0,
          found: true,
          item: 5,
          location: 1_310_724,
          receiver: 2,
          status: 40,
        },
      ],
      raceMode: false,
      sent: [{ flags: 1, item: 7, location: 1, player: 2 }],
      slotData: { goal: 0, mode: "open", nan: Number.NaN, nested: { a: 1 } },
    };
    const run = projectRun(snapshot, alttp, null);
    expect(run?.hints).toEqual([
      {
        entrance: "",
        finder: "Sam",
        flags: 1,
        forMe: true,
        item: "Hookshot",
        location: "Location 99",
        receiver: "Link",
        status: "priority",
      },
      {
        entrance: "Old Man Cave",
        finder: "Link",
        flags: 0,
        forMe: false,
        item: unknownItem(5),
        location: "Ice Palace - Jelly Key Drop",
        receiver: "Sam",
        status: "found",
      },
    ]);
    expect(run?.sent).toEqual([
      { flags: 1, item: unknownItem(7), location: 1, to: 2 },
    ]);
    // 10 % of 3 locations, at least 1
    expect(run?.hintCost).toBe(1);
    expect(run?.hintPoints).toBe(4);
    expect(run?.slotData).toEqual({ goal: 0, mode: "open" });
    // A race (or not read yet) keeps none
    expect(
      projectRun({ ...snapshot, raceMode: true }, alttp, null)?.slotData,
    ).toBeNull();
    expect(neededForRun(snapshot, [])).toEqual([
      "Super Metroid",
      "A Link to the Past",
    ]);
  });

  it("names what arrived while away: the item, its sender and where it was", () => {
    expect(awayItems(SNAPSHOT, SNAPSHOT.items.slice(0, 2), alttp)).toEqual([
      { flags: 1, item: "Hookshot", location: "Location 1", sender: "Sam" },
      {
        flags: 0,
        item: "Piece of Heart",
        location: "Location 2",
        sender: "your world",
      },
    ]);
    expect(neededForRun(SNAPSHOT, SNAPSHOT.items)).toEqual([
      "Super Metroid",
      "A Link to the Past",
    ]);
  });

  it("says nothing between connections", () => {
    expect(projectRun({ ...SNAPSHOT, ready: false }, none, null)).toBeNull();
    expect(projectRun(EMPTY_SNAPSHOT, none, null)).toBeNull();
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
