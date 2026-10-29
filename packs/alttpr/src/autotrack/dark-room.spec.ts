import {
  assertRaceSafe,
  definePack,
  planReads,
  USB2SNES_LIMITS,
} from "@alltp/autotrack";
import { describe, expect, it } from "vitest";
import links from "../../test/dark-room/links-house.json" with { type: "json" };
import passage from "../../test/dark-room/secret-passage.json" with {
  type: "json",
};
import {
  decodeDarkRoom,
  linkTile,
  ROOM_TILES,
  TILE,
  tileKind,
} from "./dark-room";
import {
  DARK,
  darkRoomHeld,
  darkRoomWanted,
  INDOORS,
  LAMP,
  MODE,
  SUBMODE,
} from "./dark-room-gate";
import { MEMORY_RANGE, MEMORY_RANGES } from "./memory";
import { ALTTPR_AUTOTRACK } from "./pack";
import { ALTTPR_RACE_PROFILE } from "./race-profile";

/** A memory view over ranges' bytes, as the session's snapshot is. */
class View {
  private readonly held = new Map<string, Uint8Array>();
  constructor(ranges: Record<string, Uint8Array>) {
    for (const [id, bytes] of Object.entries(ranges)) this.held.set(id, bytes);
  }
  has(id: string) {
    return this.held.has(id);
  }
  bytes(id: string) {
    const bytes = this.held.get(id);
    if (bytes === undefined) throw new Error(`unread ${id}`);
    return bytes;
  }
  set(id: string, offset: number, ...values: number[]) {
    this.bytes(id).set(values, offset);
    return this;
  }
}

const hex = (text: string) =>
  Uint8Array.from(text.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));

/** Link's House, dark and without the Lamp, as the real game held it. */
const viewOf = (recording: { ranges: Record<string, string> }) =>
  new View(
    Object.fromEntries(
      Object.entries(recording.ranges).map(([id, text]) => [id, hex(text)]),
    ),
  );
const house = () => viewOf(links);
/** The Secret Passage, dark, with its chest, its torch and its pots. */
const secretPassage = () => viewOf(passage);

const OPTIONS = { race: false };

describe("the dark room's ranges", () => {
  it("are all `navigation`, which the race profile forbids", () => {
    const ids = MEMORY_RANGES.filter((r) => r.id.startsWith("dark-room-"));
    expect(ids.length).toBeGreaterThan(8);
    for (const range of ids) {
      expect(range.category, range.id).toBe("navigation");
      // The picture's ranges wait for their own switch, which the app turns
      // on only with the map's
      expect(range.optIn, range.id).toBe(
        range.id.startsWith("dark-room-art-") ? "dark-room-art" : "dark-room",
      );
    }
    expect(ALTTPR_RACE_PROFILE.categories.navigation?.permitted).toBe(false);
  });

  it("lie outside every window Race Mode reads, and no race plan carries one", () => {
    const ids = MEMORY_RANGES.filter((r) => r.id.startsWith("dark-room-"));
    for (const id of ids) {
      // Race Mode's barriers keep its merges away from every one of them
      expect(ALTTPR_AUTOTRACK.forbiddenBytes).toContainEqual({
        address: id.address,
        size: id.size,
      });
    }
    const raceRanges = MEMORY_RANGES.filter(
      (r) =>
        "everyMs" in r &&
        ALTTPR_RACE_PROFILE.categories[r.category]?.permitted === true,
    );
    const plan = planReads(raceRanges, {
      barriers: ALTTPR_AUTOTRACK.raceBarriers[0],
      gap: ALTTPR_AUTOTRACK.gap,
      limits: USB2SNES_LIMITS,
    });
    expect(() =>
      assertRaceSafe(
        plan,
        ALTTPR_RACE_PROFILE,
        ALTTPR_AUTOTRACK.permittedBytes,
      ),
    ).not.toThrow();
    // The race plan's pieces touch none of the dark room's bytes
    for (let i = 0; i < plan.requests.length; i++) {
      const { pieces } = plan.requests[i];
      for (let k = 0; k < pieces.length; k += 2) {
        for (const id of ids) {
          const touches =
            pieces[k] < id.address + id.size &&
            id.address < pieces[k] + pieces[k + 1];
          // A piece may share the game mode's byte $10 with the first range,
          // which is a permitted range of its own
          if (id.id === "dark-room-mode") continue;
          expect(touches, id.id).toBe(false);
        }
      }
    }
  });

  it("refuses to define a pack that would let a race read the map", () => {
    const map = MEMORY_RANGE["dark-room-map"];
    expect(() =>
      definePack({
        id: "bad",
        profile: ALTTPR_RACE_PROFILE,
        ranges: [{ ...map, category: "items" }],
      }),
    ).toThrow(/permits/);
  });

  it("read the map as one range of its own, whole, behind a gate", () => {
    expect(MEMORY_RANGE["dark-room-map"]).toMatchObject({
      address: 0xf6_2000,
      alone: true,
      refreshOn: ["dark-room-room"],
      size: 0x2000,
    });
    // Alone: no plan of the tick carries it, and its own is one 8 KiB piece
    const plan = planReads([MEMORY_RANGE["dark-room-map"]], {
      gap: ALTTPR_AUTOTRACK.gap,
      limits: USB2SNES_LIMITS,
    });
    expect(plan.requests).toHaveLength(1);
    expect(plan.requests[0].size).toBe(0x2000);
    expect(
      ALTTPR_AUTOTRACK.isAlone[
        ALTTPR_AUTOTRACK.indexOf.get("dark-room-map") ?? -1
      ],
    ).toBe(true);
  });

  it("are all in each recording, at the map's size and no other", () => {
    // The picture's ranges hold the game's own tilemaps and palettes: never
    // recorded. Link's stance came after these two recordings, which decode
    // without it (no facing, no charge); a recording made since holds it.
    const stance = ["dark-room-stance"];
    for (const recording of [links, passage]) {
      const ids = Object.keys(recording.ranges);
      const wanted = [
        ...MEMORY_RANGES.filter(
          (r) =>
            r.id.startsWith("dark-room-") &&
            !r.id.startsWith("dark-room-art-") &&
            (!stance.includes(r.id) || ids.includes(r.id)),
        ),
        MEMORY_RANGE["equipment-b"],
      ];
      expect(ids.sort()).toEqual(wanted.map((r) => r.id).sort());
      for (const range of wanted) {
        expect(
          hex(recording.ranges[range.id as keyof typeof recording.ranges])
            .length,
          range.id,
        ).toBe(range.size);
      }
    }
  });

  it("keep the gate's addresses in step with the memory map", () => {
    for (const place of [MODE, SUBMODE, INDOORS, DARK, LAMP]) {
      const range = MEMORY_RANGE[place.range as keyof typeof MEMORY_RANGE];
      expect(range.bus, place.range).toBe(place.base);
      expect(place.at - place.base, place.range).toBeLessThan(range.size);
    }
  });
});

describe("darkRoomWanted and darkRoomHeld", () => {
  it("both hold for the real dark house without the Lamp", () => {
    expect(darkRoomWanted(house())).toBe(true);
    expect(darkRoomHeld(house())).toBe(true);
  });

  it.each([
    ["the Lamp is held", (v: View) => v.set("equipment-b", 6, 1)],
    ["the room is lit", (v: View) => v.set("dark-room-dark", 0, 0)],
    ["Link is outdoors", (v: View) => v.set("dark-room-indoors", 0, 0)],
    [
      "the game is over (mode 12)",
      (v: View) => v.set("dark-room-mode", 0, 0x12),
    ],
  ])("neither holds when %s", (_why, change) => {
    const view = change(house());
    expect(darkRoomWanted(view)).toBe(false);
    expect(darkRoomHeld(view)).toBe(false);
  });

  it.each([
    [
      "a menu or a text box is open (mode 0E)",
      (v: View) => v.set("dark-room-mode", 0, 0x0e),
    ],
    [
      "a transition runs (submode)",
      (v: View) => v.set("dark-room-mode", 1, 0x02),
    ],
  ])("the room is held, not read, when %s", (_why, change) => {
    const view = change(house());
    expect(darkRoomHeld(view)).toBe(true);
    expect(darkRoomWanted(view)).toBe(false);
  });

  it("do not hold while a range is unread", () => {
    expect(darkRoomWanted(new View({}))).toBe(false);
    expect(darkRoomHeld(new View({}))).toBe(false);
    const view = house();
    const without = new View({
      "dark-room-dark": view.bytes("dark-room-dark"),
      "dark-room-mode": view.bytes("dark-room-mode"),
    });
    expect(darkRoomHeld(without)).toBe(false);
  });
});

describe("decodeDarkRoom, over Link's House as the game held it", () => {
  const reading = decodeDarkRoom(house(), OPTIONS);

  it("reads the room and puts Link in the bed's room, on his 2 x 2 tiles", () => {
    expect(reading?.room).toBe(0x104);
    expect(reading?.layer).toBe(0);
    // Y then X, as the game holds them, absolute in the dungeon's grid
    const at = hex(links.ranges["dark-room-link"]);
    const y = at[0] | (at[1] << 8);
    const x = at[2] | (at[3] << 8);
    expect(reading?.link).toMatchObject(linkTile(x, y));
    expect(reading?.link).toEqual({
      // Recorded before the stance's ranges: neither is known
      charge: "none",
      facing: null,
      x: (x & 0x1ff) >> 3,
      y: ((y & 0x1ff) + 8) >> 3,
    });
  });

  it("reads which way Link faces and how charged his sword is", () => {
    const view = house();
    const stance = (facing: number, charge: number) =>
      decodeDarkRoom(
        new View({
          ...Object.fromEntries(
            Object.keys(links.ranges).map((id) => [id, view.bytes(id)]),
          ),
          // $2F, then $79 at the end
          "dark-room-stance": Uint8Array.from({ length: 0x4b }, (_, i) =>
            i === 0 ? facing : i === 0x4a ? charge : 0,
          ),
        }),
        OPTIONS,
      )?.link;
    expect(stance(0, 0)).toMatchObject({ charge: "none", facing: "up" });
    expect(stance(2, 1)).toMatchObject({ charge: "charging", facing: "down" });
    expect(stance(4, 47)).toMatchObject({ charge: "charging", facing: "left" });
    expect(stance(6, 48)).toMatchObject({ charge: "charged", facing: "right" });
    expect(stance(6, 64)).toMatchObject({ charge: "charged" });
    // A value the game never holds there
    expect(stance(3, 0)).toMatchObject({ facing: null });
    expect(stance(8, 0)).toMatchObject({ facing: null });
  });

  it("draws the walls, the floor, the pots, the exit, and nothing unknown", () => {
    if (reading === null) throw new Error("no reading");
    const count = (kind: number) =>
      reading.kinds.filter((k) => k === kind).length;
    expect(count(TILE.wall)).toBeGreaterThan(1000);
    expect(count(TILE.floor)).toBeGreaterThan(100);
    // Three pots, each 2 x 2 tiles; the exit doorway (8E) is 2 tiles
    expect(count(TILE.pot)).toBe(12);
    expect(count(TILE.exit)).toBeGreaterThan(0);
    expect(count(TILE.unknown)).toBe(0);
    // Every byte of the layer is kept as the game held it
    expect(reading.raw).toHaveLength(ROOM_TILES * ROOM_TILES);
  });

  it("crops to the room's quadrant, Link inside", () => {
    if (reading === null) throw new Error("no reading");
    const { bounds, link } = reading;
    expect(bounds.x1 - bounds.x0).toBeLessThan(40);
    expect(bounds.y1 - bounds.y0).toBeLessThan(40);
    expect(link.x).toBeGreaterThanOrEqual(bounds.x0);
    expect(link.x + 1).toBeLessThanOrEqual(bounds.x1);
    expect(link.y).toBeGreaterThanOrEqual(bounds.y0);
    expect(link.y + 1).toBeLessThanOrEqual(bounds.y1);
  });

  it("stays as it was under a menu or a text box, and goes with the room", () => {
    const view = house();
    const open = decodeDarkRoom(view, OPTIONS);
    // The menu opens: the room, the plan and the position are held
    view.set("dark-room-mode", 0, 0x0e);
    const menu = decodeDarkRoom(view, OPTIONS);
    expect(menu).not.toBeNull();
    expect(menu?.room).toBe(open?.room);
    expect(menu?.link).toEqual(open?.link);
    expect(menu?.kinds).toEqual(open?.kinds);
    // A scroll to another room holds it too, until the game is in play again
    view.set("dark-room-mode", 0, 0x07);
    view.set("dark-room-mode", 1, 0x02);
    expect(decodeDarkRoom(view, OPTIONS)).not.toBeNull();
    // What lets it go: the Lamp, a lit room, leaving the dungeon, Race Mode
    for (const [id, offset, value] of [
      ["equipment-b", 6, 1],
      ["dark-room-dark", 0, 0],
      ["dark-room-indoors", 0, 0],
    ] as const) {
      const other = house();
      other.set("dark-room-mode", 0, 0x0e);
      other.set(id, offset, value);
      expect(decodeDarkRoom(other, OPTIONS), id).toBeNull();
    }
    expect(decodeDarkRoom(view, { race: true })).toBeNull();
  });

  it("is null in Race Mode, whatever the memory holds", () => {
    expect(decodeDarkRoom(house(), { race: true })).toBeNull();
  });

  it("is null while the map is unread, or once the Lamp is held", () => {
    const view = house();
    const noMap = new View({
      ...Object.fromEntries(
        [
          "dark-room-mode",
          "dark-room-indoors",
          "dark-room-link",
          "dark-room-room",
          "dark-room-layer",
          "dark-room-lights",
          "dark-room-objects",
          "dark-room-chests",
          "dark-room-doors",
          "dark-room-dark",
          "equipment-b",
        ].map((id) => [id, view.bytes(id)]),
      ),
    });
    expect(decodeDarkRoom(noMap, OPTIONS)).toBeNull();
    expect(decodeDarkRoom(view.set("equipment-b", 6, 1), OPTIONS)).toBeNull();
  });
});

describe("decodeDarkRoom, over the Secret Passage as the game held it", () => {
  const reading = decodeDarkRoom(secretPassage(), OPTIONS);

  it("finds its chest, its torch not lit, its stairs and its exit", () => {
    if (reading === null) throw new Error("no reading");
    expect(reading.room).toBe(0x55);
    // One chest of 2 x 2 tiles
    expect(reading.chests).toHaveLength(1);
    const [chest] = reading.chests;
    expect(chest.big).toBe(false);
    expect(chest.x1 - chest.x0).toBe(1);
    expect(chest.y1 - chest.y0).toBe(1);
    // Its torch is not lit: the word at $0540 + $0478 has no bit $8000
    expect(reading.torches).toEqual({ total: 1, unlit: 1 });
    const count = (kind: number) =>
      reading.kinds.filter((k) => k === kind).length;
    expect(count(TILE.stairs)).toBeGreaterThan(0);
    expect(count(TILE.exit)).toBeGreaterThan(0);
    expect(count(TILE.chest)).toBe(4);
    expect(count(TILE.unknown)).toBe(0);
  });

  it("lights the torch when the game does", () => {
    const view = secretPassage();
    // The torch's word: $0540 + $0478 (4) + slot 0 * 2, its high byte
    view.set("dark-room-objects", 0x40 + 4 + 1, 0x98);
    expect(decodeDarkRoom(view, OPTIONS)?.torches).toEqual({
      total: 1,
      unlit: 0,
    });
  });

  it("holds its whole plan, which spans two rooms' height", () => {
    if (reading === null) throw new Error("no reading");
    expect(reading.bounds.y1 - reading.bounds.y0).toBeGreaterThan(40);
  });
});

describe("decodeDarkRoom, the pieces the real house does not show", () => {
  /** The house with a patch laid on its first layer. */
  function patched(
    edit: (map: Uint8Array, view: View) => void,
  ): ReturnType<typeof decodeDarkRoom> {
    const view = house();
    edit(view.bytes("dark-room-map"), view);
    return decodeDarkRoom(view, OPTIONS);
  }
  const at = (x: number, y: number) => y * ROOM_TILES + x;
  /** A 2 x 2 block of `value` at tile (x, y). */
  const block = (map: Uint8Array, x: number, y: number, value: number) => {
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      map[at(x + dx, y + dy)] = value;
    }
  };

  it("lists closed chests with their boxes, and not the opened one or a big key lock", () => {
    const found = patched((map, view) => {
      block(map, 30, 45, 0x58);
      block(map, 36, 45, 0x59);
      block(map, 36, 50, 0x27);
      // Chest 2 is a big key lock: its word has bit 0x8000
      block(map, 44, 45, 0x5a);
      view.set("dark-room-chests", 4, 0x00, 0x80);
    });
    expect(found?.chests).toEqual([
      { big: false, x0: 30, x1: 31, y0: 45, y1: 46 },
      { big: false, x0: 36, x1: 37, y0: 45, y1: 46 },
    ]);
    expect(found?.kinds[at(36, 50)]).toBe(TILE.chestOpen);
    expect(found?.kinds[at(44, 45)]).toBe(TILE.bigKeyLock);
  });

  it("tells a big chest by its width", () => {
    const found = patched((map) => {
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 4; dx++) map[at(30 + dx, 45 + dy)] = 0x58;
      }
    });
    expect(found?.chests).toEqual([
      { big: true, x0: 30, x1: 33, y0: 45, y1: 47 },
    ]);
  });

  it("counts torches, lit or not, by the bit the game sets in its array", () => {
    const found = patched((map, view) => {
      block(map, 30, 45, 0xc0);
      block(map, 34, 45, 0xc1);
      block(map, 38, 45, 0xc2);
      // The torches start at byte 6 of the arrays ($0478 = 6): slot n's word
      // is at $0540 + 6 + 2n, bit 0x8000 meaning lit
      view.set("dark-room-objects", 0x40 + 6 + 2, 0x00, 0x80);
    });
    expect(found?.torches).toEqual({ total: 3, unlit: 2 });
    expect(found?.kinds[at(30, 45)]).toBe(TILE.torchUnlit);
    expect(found?.kinds[at(34, 45)]).toBe(TILE.torchLit);
  });

  it("names closed doors by the type of their slot", () => {
    const found = patched((map, view) => {
      block(map, 20, 45, 0xf0);
      block(map, 24, 45, 0xf1);
      block(map, 28, 45, 0xf2);
      block(map, 32, 45, 0xf3);
      view.set("dark-room-doors", 0, 0x1c);
      view.set("dark-room-doors", 2, 0x28);
      view.set("dark-room-doors", 4, 0x44);
      view.set("dark-room-doors", 6, 0x00);
    });
    expect([20, 24, 28, 32].map((x) => found?.kinds[at(x, 45)])).toEqual([
      TILE.doorKey,
      TILE.doorBomb,
      TILE.doorShutter,
      TILE.door,
    ]);
  });

  it("draws Link's layer in a layered room, and the first in a single one", () => {
    const layered = (collision: number, layer: number) => {
      const view = house();
      const map = view.bytes("dark-room-map");
      map[at(10, 10)] = 0x00;
      map[0x1000 + at(10, 10)] = 0x08; // water on the second table
      view.set("dark-room-lights", 0x14, collision); // $046C
      view.set("dark-room-layer", 0, layer);
      return decodeDarkRoom(view, OPTIONS);
    };
    expect(layered(1, 1)?.layer).toBe(1);
    expect(layered(1, 1)?.kinds[at(10, 10)]).toBe(TILE.water);
    expect(layered(1, 0)?.layer).toBe(0);
    // Single layer: the second table is junk whatever $EE says
    expect(layered(0, 1)?.layer).toBe(0);
    expect(layered(0, 1)?.kinds[at(10, 10)]).toBe(TILE.floor);
  });
});

describe("tileKind", () => {
  const none = {
    door: () => TILE.door,
    lit: () => false,
    lock: () => false,
    object: () => TILE.object,
  };

  it("keeps a value no kind names as unknown", () => {
    for (const value of [0x4b, 0x05, 0xd0, 0xe7]) {
      expect(tileKind(value, none), value.toString(16)).toBe(TILE.unknown);
    }
  });

  it.each([
    [0x00, TILE.floor],
    [0x01, TILE.wall],
    [0x08, TILE.water],
    [0x0d, TILE.hazard],
    [0x12, TILE.slope],
    [0x1e, TILE.stairs],
    [0x20, TILE.pit],
    [0x2a, TILE.ledge],
    [0x38, TILE.stairs],
    [0x58, TILE.chest],
    [0x67, TILE.peg],
    [0x69, TILE.conveyor],
    [0x80, TILE.doorway],
    [0x8e, TILE.exit],
    [0xb3, TILE.pit],
  ])("reads %i as its kind", (value, kind) => {
    expect(tileKind(value, none)).toBe(kind);
  });
});

describe("linkTile", () => {
  it("is absolute pixels folded into the room, at the footprint's top left", () => {
    expect(linkTile(0x978, 0x2178)).toEqual({
      x: 0x178 >> 3,
      y: (0x178 + 8) >> 3,
    });
    // Never past the room's last two tiles
    expect(linkTile(0x1ff, 0x1ff)).toEqual({ x: 62, y: 62 });
  });
});
