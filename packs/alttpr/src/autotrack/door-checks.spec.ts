import { describe, expect, it } from "vitest";
import {
  DR_LOCATIONS,
  DR_TABLES,
  drLocationsOf,
} from "../door-rando/locations";
import type { MemoryView } from "./decode";
import { decodeDoorChecks, doorSwitches } from "./door-checks";
import { MEMORY_RANGE, type MemoryRangeId } from "./memory";

const TABLES = ["door-pots", "door-drops", "door-purchases"] as const;

/** The three tables as the session's snapshot holds them, all zero. */
const tables = () =>
  Object.fromEntries(
    TABLES.map((id) => [id, new Uint8Array(MEMORY_RANGE[id].size)]),
  ) as Record<(typeof TABLES)[number], Uint8Array>;

const view = (
  bytes: Partial<Record<MemoryRangeId, Uint8Array>>,
  unread: readonly MemoryRangeId[] = [],
): MemoryView => ({
  bytes: (id) => bytes[id as MemoryRangeId] ?? new Uint8Array(0),
  has: (id) =>
    bytes[id as MemoryRangeId] !== undefined &&
    !unread.includes(id as MemoryRangeId),
});

const byName = (name: string) => {
  const found = DR_LOCATIONS.find((location) => location.name === name);
  if (found === undefined) throw new Error(`No DR location ${name}`);
  return found;
};

/** Crosskeys' keydrop: the 33 key drops, keys and drops shuffled. */
const KEYDROP = drLocationsOf({
  bossShuffle: false,
  dropShuffle: "keys",
  enemyShuffle: false,
  potShuffle: false,
  pottery: "keys",
  shopsanity: true,
  takeAny: "none",
}).locations;

describe("decodeDoorChecks", () => {
  it("reads the three tables where the memory map reads them", () => {
    expect(MEMORY_RANGE["door-pots"]).toMatchObject({
      bus: DR_TABLES.pot.bus,
      size: DR_TABLES.pot.size,
    });
    expect(MEMORY_RANGE["door-drops"]).toMatchObject({
      bus: DR_TABLES.drop.bus,
      size: DR_TABLES.drop.size,
    });
    expect(MEMORY_RANGE["door-purchases"]).toMatchObject({
      bus: DR_TABLES.purchase.bus,
      size: DR_TABLES.purchase.size,
    });
  });

  it("checks a pot, an enemy drop and a shop slot by their bits", () => {
    const memory = tables();
    // Eastern Palace's dark square pot: room $BA, pot 4, bit $0800 of the
    // room's little-endian word (standing_items.asm:226-227, 571-573)
    memory["door-pots"][0xba * 2 + 1] = 0x08;
    // Hyrule Castle's map guard: room $72, slot 0, bit $8000
    memory["door-drops"][0x72 * 2 + 1] = 0x80;
    // Kakariko Shop's left slot, bought twice (shopkeeper.asm:479-480)
    memory["door-purchases"][21] = 2;
    const { checked, unsettled } = decodeDoorChecks(view(memory), KEYDROP, {
      race: false,
    });
    expect([...checked].sort()).toEqual([
      "eastern-palace/dark-square-pot-key",
      "hyrule-castle/map-guard-key-drop",
      "kakariko-shop/left",
    ]);
    expect(unsettled.size).toBe(0);
  });

  it("tells nothing of a bit that is no location of the run's", () => {
    const memory = tables();
    // Every bit of every table set: only the run's locations are told
    memory["door-pots"].fill(0xff);
    memory["door-drops"].fill(0xff);
    memory["door-purchases"].fill(0xff);
    const keysOnly = drLocationsOf({
      bossShuffle: false,
      dropShuffle: "none",
      enemyShuffle: false,
      potShuffle: false,
      pottery: "keys",
      shopsanity: false,
      takeAny: "none",
    }).locations;
    const { checked } = decodeDoorChecks(view(memory), keysOnly, {
      race: true,
    });
    expect(checked.size).toBe(19);
    expect([...checked].every((id) => byIdKind(id) === "keyDrop")).toBe(true);
    expect(doorSwitches(keysOnly)).toEqual(new Set(["door-pots"]));
  });

  it("leaves a table not read unsettled, never unchecked", () => {
    const memory = tables();
    const { checked, unsettled } = decodeDoorChecks(
      view(memory, ["door-drops"]),
      KEYDROP,
      { race: false },
    );
    expect(checked.size).toBe(0);
    expect(unsettled.get(byName("Ice Palace - Jelly Key Drop").id)).toBe(
      "not-read",
    );
    expect(unsettled.has(byName("Ice Palace - Many Pots Pot Key").id)).toBe(
      false,
    );
  });

  it("reads them in Race Mode, the profile permitting the three tables", () => {
    const memory = tables();
    memory["door-drops"][0x72 * 2 + 1] = 0x80;
    const { checked, unsettled } = decodeDoorChecks(view(memory), KEYDROP, {
      race: true,
    });
    expect(checked.has("hyrule-castle/map-guard-key-drop")).toBe(true);
    expect(unsettled.size).toBe(0);
  });

  it("leaves out what memory cannot tell", () => {
    const memory = tables();
    memory["door-pots"][0xba * 2 + 1] = 0x08;
    const id = "eastern-palace/dark-square-pot-key";
    const { checked, unsettled } = decodeDoorChecks(view(memory), KEYDROP, {
      race: false,
      unflagged: new Set([id]),
    });
    expect(checked.has(id)).toBe(false);
    expect(unsettled.has(id)).toBe(false);
  });
});

const byIdKind = (id: string) =>
  DR_LOCATIONS.find((location) => location.id === id)?.kind;
