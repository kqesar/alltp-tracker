import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MEMORY_RANGE } from "./autotrack/memory";
import { LOCATION_KEYS, LOCATIONS } from "./locations";

const fixture = JSON.parse(
  readFileSync(
    new URL("../test/spoilers/dsjF6gGsH.json", import.meta.url),
    "utf8",
  ),
) as {
  all_items: { location: { room_id: number; node_id: number } }[];
};

describe("LOCATIONS", () => {
  it("holds Map Rando's 100 item locations", () => {
    expect(LOCATIONS).toHaveLength(100);
    expect(LOCATION_KEYS).toHaveLength(100);
  });

  it("is a bijection between locations and bits, all inside the array", () => {
    const bits = LOCATIONS.map(({ bit }) => bit);
    expect(new Set(bits).size).toBe(100);
    expect(new Set(LOCATION_KEYS).size).toBe(100);
    expect(Math.min(...bits)).toBe(0);
    expect(Math.max(...bits)).toBe(154);
    // The array the memory map reads holds all of them: 20 bytes, 160 bits
    const last = Math.max(...bits) >> 3;
    expect(last).toBeLessThan(MEMORY_RANGE.collected.size);
    expect(MEMORY_RANGE["nothing-mask"].size).toBe(MEMORY_RANGE.collected.size);
  });

  it("is sorted by room, then node, like the log's locations", () => {
    const ids = LOCATION_KEYS.map((key) => key.split(":").map(Number));
    expect(ids).toEqual([...ids].sort((a, b) => a[0] - b[0] || a[1] - b[1]));
  });

  it("covers every location of a real seed's log, and no other", () => {
    const logged = fixture.all_items.map(
      ({ location }) => `${location.room_id}:${location.node_id}`,
    );
    expect(logged).toHaveLength(100);
    expect([...logged].sort()).toEqual([...LOCATION_KEYS].sort());
  });

  it("pins a few bits read in a running game", () => {
    // Read on a rig: picking up Brinstar Reserve Tank Room's middle item set
    // $D872 bit 3, 230 Missile Room's $D871 bit 4, Crateria Power Bomb
    // Room's $D870 bit 0
    const bit = (key: string) => LOCATIONS.find((l) => l.key === key)?.bit;
    expect(bit("46:3")).toBe(19);
    expect(bit("17:2")).toBe(12);
    expect(bit("28:2")).toBe(0);
  });
});
