import { describe, expect, it } from "vitest";
import { DR_DATA } from "./data";
import {
  type DoorShuffleSettings,
  doorById,
  doorId,
  doorNotesFromSpoiler,
  doorTargets,
  isShuffledDoor,
  kindShuffled,
  lobbyDoors,
  PARTITIONS,
  poolOf,
  portalById,
  portalId,
  shuffledDoors,
  vanillaKind,
} from "./doors";

const door = (name: string) => {
  const found = DR_DATA.doorByName.get(name);
  if (found === undefined) throw new RangeError(name);
  return found;
};

const shuffle = (
  more: Partial<DoorShuffleSettings> = {},
): DoorShuffleSettings => ({
  decoupled: false,
  intensity: 2,
  shuffle: "basic",
  trapMode: "optional",
  ...more,
});

describe("the door shuffle's model (doors.ts)", () => {
  it("gives every door and portal an id of its own, read back", () => {
    const ids = DR_DATA.doors.map((d) => doorId(d.name));
    expect(new Set(ids).size).toBe(DR_DATA.doors.length);
    expect(doorId("GT Warp Maze (Rails) WS")).toBe("gt-warp-maze-rails-ws");
    expect(doorById("eastern-lobby-nw")?.name).toBe("Eastern Lobby NW");
    expect(portalId("Hyrule Castle South")).toBe("hyrule-castle-south");
    expect(portalById("turtle-rock-lazy-eyes")?.door).toBe("TR Lazy Eyes SE");
    expect(doorById("nowhere")).toBeUndefined();
  });

  it("relinks a dungeon's doors of the types each intensity shuffles", () => {
    // create_door_spoiler (DoorShuffle.py:180-182): normal doors and
    // spiral stairs; open edges, straight stairs and ladders from 2; the
    // portals' own doors from 3
    expect(shuffledDoors(shuffle({ intensity: 1 }))).toHaveLength(398);
    expect(shuffledDoors(shuffle({ intensity: 2 }))).toHaveLength(456);
    expect(shuffledDoors(shuffle({ intensity: 3 }))).toHaveLength(481);
    const edge = door("Desert Main Lobby NE Edge");
    expect(isShuffledDoor(edge, shuffle({ intensity: 1 }))).toBe(false);
    expect(isShuffledDoor(edge, shuffle({ intensity: 2 }))).toBe(true);
    const lobby = door("Eastern Lobby S");
    expect(isShuffledDoor(lobby, shuffle({ intensity: 2 }))).toBe(false);
    expect(isShuffledDoor(lobby, shuffle({ intensity: 3 }))).toBe(true);
    // An interior door: never
    expect(isShuffledDoor(door("Eastern Lobby NW"), shuffle())).toBe(false);
  });

  it("pairs a door with one facing it back in its pool", () => {
    const north = door("Eastern Lobby Bridge N");
    const basic = doorTargets(north, shuffle()).map((d) => d.name);
    expect(basic).toContain("Eastern Cannonball S");
    expect(
      basic.every(
        (name) => DR_DATA.doorByName.get(name)?.direction === "South",
      ),
    ).toBe(true);
    expect(basic).not.toContain("PoD Lobby S");
    expect(
      doorTargets(north, shuffle({ shuffle: "crossed" })).map((d) => d.name),
    ).toContain("GT Big Chest SW");
    // Stairs to stairs
    const stairs = doorTargets(
      door("Hyrule Castle Back Hall Down Stairs"),
      shuffle(),
    );
    expect(stairs.length).toBeGreaterThan(0);
    expect(stairs.every((d) => d.type === "SpiralStairs")).toBe(true);
    // A door the shuffle leaves has none
    expect(doorTargets(door("Eastern Lobby S"), shuffle())).toEqual([]);
  });

  it("groups the dungeons as each shuffle pools them", () => {
    expect(poolOf("Ice Palace", "basic")).toEqual(["Ice Palace"]);
    expect(poolOf("Ice Palace", "partitioned")).toEqual(PARTITIONS[2]);
    expect(poolOf("Ice Palace", "crossed")).toHaveLength(13);
    expect(() => poolOf("Nowhere", "partitioned")).toThrow(RangeError);
    // A portal's lobbies: the doors of its pool that may be one
    const lobbies = lobbyDoors("Eastern", "basic").map((d) => d.name);
    expect(lobbies).toContain("Eastern Lobby S");
    expect(lobbies).not.toContain("PoD Lobby S");
    expect(lobbyDoors("Eastern", "crossed").map((d) => d.name)).toContain(
      "PoD Lobby S",
    );
    expect(() => lobbyDoors("Nowhere", "basic")).toThrow(RangeError);
  });

  it("knows which doors may change kind, and their room's kind", () => {
    const optional = shuffle({ trapMode: "optional" });
    // A key door of a room's list, a bombable wall, a stair key
    expect(
      kindShuffled(door("Eastern Dark Square Key Door WN"), optional),
    ).toBe(true);
    expect(vanillaKind(door("Eastern Dark Square Key Door WN"))).toBe("small");
    expect(vanillaKind(door("PoD Dark Maze E"))).toBe("bomb");
    expect(vanillaKind(door("Sewers Rat Path WS"))).toBe("dash");
    expect(vanillaKind(door("Hera Lobby Key Stairs"))).toBe("small");
    expect(vanillaKind(door("Eastern Big Key NE"))).toBe("big");
    expect(vanillaKind(door("Eastern Boss SE"))).toBe("trap");
    expect(vanillaKind(door("Eastern Cannonball S"))).toBe("normal");
    // A boss's trap stays in the vanilla and optional trap modes
    expect(kindShuffled(door("Eastern Boss SE"), optional)).toBe(false);
    expect(
      kindShuffled(door("Eastern Boss SE"), shuffle({ trapMode: "boss" })),
    ).toBe(true);
    // A lobby's door: fifth in its room's list
    expect(kindShuffled(door("Eastern Lobby S"), optional)).toBe(false);
    // From intensity 3 a lobby-able door's kind moves too
    expect(kindShuffled(door("Eastern Lobby S"), optional)).toBe(false);
    expect(
      kindShuffled(door("Eastern Lobby S"), shuffle({ intensity: 3 })),
    ).toBe(true);
  });

  it("reads a spoiler's links, lobbies and kinds as notes", () => {
    const settings = shuffle({ intensity: 3 });
    const notes = doorNotesFromSpoiler(
      {
        Doors: [
          {
            direction: "both",
            entrance: "Eastern Lobby Bridge N",
            exit: "GT Big Chest SW",
          },
          {
            direction: "entrance",
            entrance: "Desert Main Lobby NE Edge",
            exit: "Eastern Boss SE",
          },
        ],
        DoorTypes: [
          {
            doorNames:
              "GT Firesnake Room SW <-> GT Warp Maze (Rails) NW (Ganons Tower)",
            type: "Key Door",
          },
          { doorNames: "Ice Lobby SE (Hyrule Castle)", type: "Trap Door" },
        ],
        Lobbies: [{ door_name: "PoD Lobby S", lobby_name: "Eastern" }],
      },
      settings,
    );
    expect(notes.links).toEqual({
      "desert-main-lobby-ne-edge": "eastern-boss-se",
      "eastern-boss-se": "desert-main-lobby-ne-edge",
      "eastern-lobby-bridge-n": "gt-big-chest-sw",
      "gt-big-chest-sw": "eastern-lobby-bridge-n",
    });
    expect(notes.lobbies).toEqual({ eastern: "pod-lobby-s" });
    expect(notes.kinds?.["gt-firesnake-room-sw"]).toBe("small");
    expect(notes.kinds?.["gt-warp-maze-rails-nw"]).toBe("small");
    expect(notes.kinds?.["ice-lobby-se"]).toBe("trap");
    // Every other door that may change kind: plain
    expect(notes.kinds?.["eastern-dark-square-key-door-wn"]).toBe("normal");
    // A decoupled log's links one way
    const decoupled = doorNotesFromSpoiler(
      {
        Doors: [
          {
            direction: "entrance",
            entrance: "Eastern Lobby Bridge N",
            exit: "GT Big Chest SW",
          },
        ],
      },
      { ...settings, decoupled: true },
    );
    expect(decoupled.links).toEqual({
      "eastern-lobby-bridge-n": "gt-big-chest-sw",
    });
    expect(() =>
      doorNotesFromSpoiler(
        { Doors: [{ direction: "both", entrance: "Nope", exit: "No" }] },
        settings,
      ),
    ).toThrow(RangeError);
    expect(() =>
      doorNotesFromSpoiler(
        { Lobbies: [{ door_name: "PoD Lobby S", lobby_name: "Nope" }] },
        settings,
      ),
    ).toThrow(RangeError);
    expect(() =>
      doorNotesFromSpoiler(
        { DoorTypes: [{ doorNames: "PoD Lobby S (X)", type: "Odd Door" }] },
        settings,
      ),
    ).toThrow(RangeError);
    expect(() =>
      doorNotesFromSpoiler(
        { DoorTypes: [{ doorNames: "no dungeon", type: "Key Door" }] },
        settings,
      ),
    ).toThrow(RangeError);
  });

  it("offers each vanilla link among a door's targets", () => {
    // The vanilla layout is one DR may make: its pairs are choices
    const settings = shuffle({ intensity: 2 });
    for (const [a, b] of DR_DATA.pairsOf(
      "DoorShuffle.py",
      "default_door_connections",
    )) {
      const one = door(a);
      if (!isShuffledDoor(one, settings)) continue;
      expect(
        doorTargets(one, settings).map((d) => d.name),
        `${a} → ${b}`,
      ).toContain(b);
    }
  });
});
