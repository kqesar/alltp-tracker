import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fixture, packetsFrom } from "../test/fixtures";
import {
  checkFrame,
  checkPacket,
  GuardError,
  guardSocket,
  isReadableKey,
} from "./guard";
import type { WebSocketLike } from "./platform";

/** A socket that records what reaches the wire. */
function recorder() {
  const wire: string[] = [];
  const socket = {
    addEventListener: () => {},
    close: () => {},
    onclose: null,
    onerror: null,
    onmessage: null,
    onopen: null,
    readyState: 1,
    send: (data: string) => {
      wire.push(data);
    },
    url: "ws://127.0.0.1:38281",
  } satisfies WebSocketLike;
  return { socket, wire };
}

/**
 * The read-only rule, written apart from the guard as the property's
 * oracle: what may reach the server (README, "Read-only guarantee").
 */
function readOnly(packet: Record<string, unknown>): boolean {
  const readKey = (key: unknown) =>
    typeof key === "string" &&
    (/^_read_(hints|client_status)_\d+_\d+$/.test(key) ||
      /^_read_slot_data_\d+$/.test(key) ||
      key === "_read_race_mode" ||
      /^_read_location_name_groups_./.test(key));
  switch (packet.cmd) {
    case "Connect":
      return (
        packet.game === "" &&
        JSON.stringify(packet.tags) === '["Tracker"]' &&
        Number.isInteger(packet.items_handling)
      );
    case "Get":
    case "SetNotify":
      return (
        Array.isArray(packet.keys) &&
        packet.keys.length > 0 &&
        packet.keys.every(readKey)
      );
    case "GetDataPackage":
    case "Sync":
      return true;
    default:
      return false;
  }
}

const COMMANDS = [
  "Connect",
  "ConnectUpdate",
  "Sync",
  "LocationChecks",
  "LocationScouts",
  "CreateHints",
  "UpdateHint",
  "StatusUpdate",
  "Say",
  "GetDataPackage",
  "Bounce",
  "Get",
  "Set",
  "SetNotify",
];

const key = fc.oneof(
  fc.constantFrom(
    "_read_race_mode",
    "_read_hints_0_1",
    "_read_client_status_0_4",
    "_read_slot_data_2",
    "_read_location_name_groups_A Link to the Past",
    "_read_hints_x_1",
    "hints",
    "_read_",
    "EnergyLink0",
    "_read_race_mode\n",
  ),
  fc.string(),
);

const packet = fc.record(
  {
    cmd: fc.oneof(fc.constantFrom(...COMMANDS), fc.string()),
    data: fc.jsonValue(),
    game: fc.constantFrom("", "A Link to the Past"),
    games: fc.array(fc.string(), { maxLength: 2 }),
    items_handling: fc.oneof(fc.integer({ max: 9, min: -1 }), fc.string()),
    keys: fc.array(key, { maxLength: 3 }),
    locations: fc.array(fc.integer(), { maxLength: 3 }),
    name: fc.string(),
    status: fc.integer(),
    tags: fc.oneof(
      fc.constant(["Tracker"]),
      fc.subarray(["Tracker", "DeathLink", "TextOnly", "HintGame"]),
    ),
    text: fc.string(),
    uuid: fc.oneof(fc.string(), fc.integer()),
  },
  { requiredKeys: ["cmd"] },
);

/** Packets shaped like the ones a tracker sends, keys and tags still drawn at random. */
const wellFormed = fc.oneof(
  fc.constant({ cmd: "Sync" }),
  fc.record({
    cmd: fc.constantFrom("Get", "SetNotify"),
    keys: fc.array(key, { maxLength: 2, minLength: 1 }),
  }),
  fc.record({
    cmd: fc.constant("Get"),
    keys: fc.array(key, { minLength: 1 }),
    uuid: fc.string(),
  }),
  fc.record({
    cmd: fc.constant("GetDataPackage"),
    games: fc.array(fc.string()),
  }),
  fc.record({
    cmd: fc.constant("Connect"),
    game: fc.constantFrom("", "", "SMZ3"),
    items_handling: fc.integer({ max: 8, min: 0 }),
    name: fc.string(),
    password: fc.string(),
    slot_data: fc.boolean(),
    tags: fc.oneof(
      fc.constant(["Tracker"]),
      fc.subarray(["Tracker", "DeathLink", "TextOnly"]),
    ),
    uuid: fc.string(),
    version: fc.constant({ build: 3, class: "Version", major: 0, minor: 6 }),
  }),
);

describe("guard", () => {
  it("lets through every packet archipelago.js sent as a tracker in the bench", () => {
    const data = fixture("normal-session");
    const sent = [
      ...packetsFrom(data, "tracker-refresh"),
      ...packetsFrom(fixture("slot-data-race"), "tracker:Link"),
    ];
    expect(sent.map((p) => p.cmd)).toEqual(
      expect.arrayContaining(["Connect", "SetNotify", "Get"]),
    );
    for (const p of sent) expect(() => checkPacket(p)).not.toThrow();
  });

  it.each(["LocationChecks", "StatusUpdate", "Bounce"])(
    "refuses %s, which the bench's tracker sent on purpose",
    (cmd) => {
      const p = packetsFrom(fixture("normal-session"), "tracker").find(
        (q) => q.cmd === cmd,
      );
      expect(p).toBeDefined();
      expect(() => checkPacket(p)).toThrow(GuardError);
    },
  );

  it.each([
    [{ cmd: "Say", text: "!hint Hookshot" }, /whitelist/],
    [{ cmd: "Set", key: "x", operations: [] }, /whitelist/],
    [{ cmd: "CreateHints", locations: [1] }, /whitelist/],
    [{ cmd: "UpdateHint", location: 1, player: 1 }, /whitelist/],
    [{ cmd: "ConnectUpdate", tags: ["Tracker"] }, /whitelist/],
    [{ cmd: "LocationScouts", create_as_hint: 0, locations: [1] }, /whitelist/],
    [{ cmd: "Get", keys: ["EnergyLink0"] }, /not read-only/],
    [{ cmd: "Get", keys: [] }, /no keys/],
    [{ cmd: "Get", keys: ["_read_race_mode"], uuid: 3 }, /uuid/],
    [{ cmd: "Get", extra: 1, keys: ["_read_race_mode"] }, /unexpected field/],
    [{ cmd: "SetNotify", keys: ["_read_hints_0_1"], uuid: "x" }, /unexpected/],
    [{ cmd: "GetDataPackage", games: [1] }, /strings/],
    [{ cmd: "GetDataPackage", games: "ALttP" }, /strings/],
    [{ cmd: "Sync", index: 0 }, /unexpected/],
    [
      {
        cmd: "Connect",
        game: "A Link to the Past",
        items_handling: 7,
        tags: ["Tracker"],
      },
      /no game/,
    ],
    [
      {
        cmd: "Connect",
        game: "",
        items_handling: 7,
        tags: ["Tracker", "DeathLink"],
      },
      /tags/,
    ],
    [{ cmd: "Connect", game: "", items_handling: 7, tags: "Tracker" }, /tags/],
    [
      { cmd: "Connect", game: "", items_handling: 8, tags: ["Tracker"] },
      /items_handling/,
    ],
    [
      { cmd: "Connect", game: "", items_handling: 7, tags: ["Tracker"], x: 1 },
      /unexpected/,
    ],
    [{ text: "no cmd" }, /whitelist/],
    [[], /not a packet/],
    [null, /not a packet/],
  ])("refuses %j", (p, why) => {
    expect(() => checkPacket(p)).toThrow(why);
  });

  it("refuses frames that are not lists of packets", () => {
    expect(() => checkFrame(42)).toThrow(/not text/);
    expect(() => checkFrame("{")).toThrow(/not JSON/);
    expect(() => checkFrame("[]")).toThrow(/list of packets/);
    expect(() => checkFrame('{"cmd":"Sync"}')).toThrow(/list of packets/);
    expect(() => checkFrame('[{"cmd":"Sync"},{"cmd":"Say"}]')).toThrow(
      GuardError,
    );
    expect(() => checkFrame('[{"cmd":"Sync"}]')).not.toThrow();
  });

  it("names the refused command", () => {
    try {
      checkPacket({ cmd: "Bounce" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(GuardError);
      expect((error as GuardError).cmd).toBe("Bounce");
      expect((error as GuardError).name).toBe("GuardError");
    }
  });

  it("reads keys strictly", () => {
    expect(isReadableKey("_read_hints_0_12")).toBe(true);
    expect(isReadableKey("_read_location_name_groups_SMZ3")).toBe(true);
    expect(isReadableKey("_read_race_mode_x")).toBe(false);
    expect(isReadableKey(7)).toBe(false);
  });

  it("puts only read-only packets on the wire, whatever is sent (property)", () => {
    let accepted = 0;
    let refusedFrames = 0;
    fc.assert(
      fc.property(
        fc.array(fc.oneof(packet, wellFormed), { maxLength: 3, minLength: 1 }),
        (packets) => {
          const { socket, wire } = recorder();
          const refused: GuardError[] = [];
          const guarded = guardSocket(socket, (error) => refused.push(error));
          let threw = false;
          try {
            guarded.send(JSON.stringify(packets));
          } catch (error) {
            threw = true;
            expect(error).toBeInstanceOf(GuardError);
          }
          // Thrown means told, and nothing sent.
          expect(refused.length).toBe(threw ? 1 : 0);
          for (const frame of wire) {
            for (const p of JSON.parse(frame) as Record<string, unknown>[]) {
              expect(readOnly(p)).toBe(true);
            }
          }
          expect(wire).toHaveLength(threw ? 0 : 1);
          if (threw) refusedFrames++;
          else accepted++;
        },
      ),
      { numRuns: 3000 },
    );
    // Not vacuous: both outcomes were met many times.
    expect(accepted).toBeGreaterThan(100);
    expect(refusedFrames).toBeGreaterThan(100);
  });

  it("passes other errors through to the caller", () => {
    const { socket } = recorder();
    socket.send = () => {
      throw new Error("socket not open");
    };
    const refused: unknown[] = [];
    const guarded = guardSocket(socket, (e) => refused.push(e));
    expect(() => guarded.send('[{"cmd":"Sync"}]')).toThrow("socket not open");
    expect(refused).toEqual([]);
    // No listener: still refused.
    expect(() =>
      guardSocket(recorder().socket).send('[{"cmd":"Say"}]'),
    ).toThrow(GuardError);
  });
});
