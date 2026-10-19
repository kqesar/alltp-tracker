// Where Link went, written into a memory image as the seed's ROM and the
// game hold it, for the specs and browser tests of entrance autotracking:
// the door and hole tables the entrance randomizer writes (Rom.py:533-539),
// the entrance the game loads ($7E:010E), the base patch's last door
// ($7F:5099, doorframefixes.asm:8-12) and the room Link left, in the FX Pak
// Pro space the bridges serve. The decoder's own spec builds its views byte
// by byte instead, so the two are checked against each other.

import tables from "../src/autotrack/entrance-tables.json" with {
  type: "json",
};
import { MEMORY_RANGE, type MemoryRangeId } from "../src/autotrack/memory";
import er from "../src/entrances/er.json" with { type: "json" };

type Door = { hole?: boolean; slot?: number; slots?: number[] };
const DOORS = er.doors.value as Readonly<Record<string, Door>>;
const EXITS = er.exits.value as Readonly<
  Record<string, { entrance: number | null }>
>;

const at = (id: MemoryRangeId) => MEMORY_RANGE[id].address;

const door = (name: string): Door => {
  const found = DOORS[name];
  if (found === undefined) throw new RangeError(`No door or hole "${name}"`);
  return found;
};

/** The entrance the game loads for a target, by the randomizer's name. */
const entranceOf = (target: string): number => {
  const loads = EXITS[target]?.entrance;
  if (typeof loads !== "number")
    throw new RangeError(`No entrance "${target}"`);
  return loads;
};

/**
 * The seed leads a door or a hole to `target`: its slot of the door table,
 * or its bytes of the hole table, load the target's entrance. ROM: the
 * session reads it as slowly as the seed's settings.
 * @param memory - A 16 MiB FX Pak Pro image
 * @param entrance - The door or hole, by the randomizer's name
 * @param target - Its target, by the randomizer's name
 */
export const leadTo = (
  memory: Uint8Array,
  entrance: string,
  target: string,
): Uint8Array => {
  const loads = entranceOf(target);
  const { hole, slot = -1, slots = [] } = door(entrance);
  if (hole) {
    for (const byte of slots) memory[at("hole-table") + byte] = loads;
  } else {
    memory[at("door-table") + slot] = loads;
  }
  return memory;
};

/**
 * Link goes in by a door or a hole, which the seed leads to `target`
 * (`leadTo`), and the game loads its entrance.
 * @param memory - A 16 MiB FX Pak Pro image
 * @param entrance - The door or hole, by the randomizer's name
 * @param target - Its target, by the randomizer's name
 */
export const goIn = (
  memory: Uint8Array,
  entrance: string,
  target: string,
): Uint8Array => {
  leadTo(memory, entrance, target);
  const { hole, slot = -1 } = door(entrance);
  if (!hole) memory[at("overworld-door")] = slot + 1;
  memory.set([entranceOf(target), 0], at("entrance"));
  memory[at("game-mode")] = 0x07;
  return memory;
};

/**
 * Link comes out by a door, which the seed couples with `exit` (`leadTo`):
 * back on the overworld, the exit's room the last he was in.
 * @param memory - A 16 MiB FX Pak Pro image
 * @param entrance - The door, by the randomizer's name
 * @param exit - The exit of a dungeon or a cave, by the randomizer's name
 */
export const comeOut = (
  memory: Uint8Array,
  entrance: string,
  exit: string,
): Uint8Array => {
  const loads = entranceOf(exit);
  const room = Object.entries(tables.exitRooms).find(([, e]) => e === loads);
  if (room === undefined) throw new RangeError(`No room leads out by ${exit}`);
  leadTo(memory, entrance, exit);
  memory.set([Number(room[0]) & 0xff, Number(room[0]) >> 8], at("room"));
  memory[at("game-mode")] = 0x09;
  return memory;
};
