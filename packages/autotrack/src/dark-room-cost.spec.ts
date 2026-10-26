// What the dark room map costs the ALttPR poller, in requests: nothing unless
// Link is in a dark room without the Lamp (pack and recordings are the ALttPR
// pack's, read as scheduler.spec.ts reads it).
import { describe, expect, it } from "vitest";
import {
  DARK_ROOM_SWITCH,
  MEMORY_RANGE,
  type MemoryRangeId,
} from "../../../packs/alttpr/src/autotrack/memory";
import { ALTTPR_AUTOTRACK } from "../../../packs/alttpr/src/autotrack/pack";
import links from "../../../packs/alttpr/test/dark-room/links-house.json";
import { MemoryTransport } from "../test/memory-transport";
import { Poller } from "./scheduler";

const RACE_FLAG = 0x18_0213;
const TICKS = 40; // ten seconds of 250 ms ticks, which holds the settings' read

/** Requests the poller sends over ten seconds, and the ranges they touched. */
async function measure(
  where: "overworld" | "dark room" | "menu",
  options: { assist: boolean; race: boolean },
) {
  const memory = new Uint8Array(0x100_0000);
  if (where === "overworld") {
    memory[MEMORY_RANGE["game-mode"].address] = 0x09;
  } else {
    for (const [id, text] of Object.entries(links.ranges)) {
      const { address } = MEMORY_RANGE[id as MemoryRangeId];
      for (let i = 0; i < text.length; i += 2) {
        memory[address + i / 2] = Number.parseInt(text.slice(i, i + 2), 16);
      }
    }
    if (where === "menu") memory[MEMORY_RANGE["dark-room-mode"].address] = 0x0e;
  }
  // The flag and its complement (vt app/Rom.php:908-920)
  memory.set(options.race ? [0x01, 0x00] : [0x00, 0x01], RACE_FLAG);
  const transport = new MemoryTransport(memory);
  const poller = new Poller(ALTTPR_AUTOTRACK, transport, {
    now: () => 0,
    optIn: new Set(options.assist ? [DARK_ROOM_SWITCH] : []),
    romReadable: true,
    setting: "auto",
  });
  let requests = 0;
  const read = transport.read.bind(transport);
  transport.read = (request, into, offset) => {
    requests++;
    return read(request, into, offset);
  };
  for (let i = 0; i < TICKS; i++) await poller.tick();
  const touched = (id: MemoryRangeId) => {
    const { address, size } = MEMORY_RANGE[id];
    return transport.pieces.filter(
      ([a, n]) => a < address + size && address < a + n,
    ).length;
  };
  return {
    map: touched("dark-room-map"),
    position: touched("dark-room-link"),
    race: poller.race.active,
    requests,
  };
}

describe("the dark room map's cost to the ALttPR poller", () => {
  // Before the gate was read in the casual plan and the rest gated, the same
  // ten seconds sent 40 requests with the option off and 80 on, anywhere (the
  // overworld, the Lamp in the bag): every 250 ms tick between the pack's own
  // sent the race flag and a casual request. In Race Mode, 20 and 40.
  it("is no request at all outside a dark room, with the option on or off", async () => {
    const off = await measure("overworld", { assist: false, race: false });
    const on = await measure("overworld", { assist: true, race: false });
    expect(off.race).toBe(false);
    expect(on.requests).toBe(off.requests);
    expect(on.map + on.position).toBe(0);
    // And nothing in Race Mode either: the same as with it off
    const raceOff = await measure("overworld", { assist: false, race: true });
    const raceOn = await measure("overworld", { assist: true, race: true });
    expect(raceOn.race).toBe(true);
    expect(raceOn.requests).toBe(raceOff.requests);
  });

  it("is never read in Race Mode, in a dark room or not", async () => {
    const off = await measure("dark room", { assist: false, race: true });
    const on = await measure("dark room", { assist: true, race: true });
    expect(on.race).toBe(true);
    expect(on.requests).toBe(off.requests);
    expect(on.map + on.position).toBe(0);
  });

  it("is a race flag and a position every 250 ms, and the map each second, in a dark room", async () => {
    const off = await measure("dark room", { assist: false, race: false });
    const on = await measure("dark room", { assist: true, race: false });
    expect(on.race).toBe(false);
    // The 250 ms ticks between the pack's own (20 in ten seconds) send the
    // race flag and the position, two requests each; the pack's own ticks (20)
    // one more for the position; the map goes once a second (10)
    expect(on.requests - off.requests).toBe(20 * 2 + 20 + 10);
    // Over ten seconds: 4 requests a second as it was, 11 with the room read
    expect({ off: off.requests, on: on.requests }).toEqual({
      off: 40,
      on: 110,
    });
    expect(on.map).toBe(10);
  });

  it("holds the room over a menu without reading any of it again", async () => {
    const off = await measure("menu", { assist: false, race: false });
    const on = await measure("menu", { assist: true, race: false });
    expect(on.requests).toBe(off.requests);
    expect(on.map + on.position).toBe(0);
  });
});
