import { describe, expect, it } from "vitest";
import { fixture, packetsTo } from "../test/fixtures";
import {
  type ApSnapshot,
  beginConnection,
  EMPTY_SNAPSHOT,
  reduce,
  sameIdentity,
} from "./snapshot";

function fold(packets: readonly unknown[], from: ApSnapshot = EMPTY_SNAPSHOT) {
  let snapshot = from;
  let syncs = 0;
  let resets = 0;
  for (const packet of packets) {
    const result = reduce(snapshot, packet);
    snapshot = result.snapshot;
    if (result.sync) syncs++;
    if (result.reset) resets++;
  }
  return { resets, snapshot, syncs };
}

const normal = fixture("normal-session");
const tracker = packetsTo(normal, "tracker");
const refresh = packetsTo(normal, "tracker-refresh");

describe("reduce, over the recorded session", () => {
  it("is ready on Connected alone, before any item", () => {
    const [roomInfo, connected] = tracker;
    const { snapshot } = fold([roomInfo, connected]);
    expect(snapshot.ready).toBe(true);
    expect(snapshot.items).toEqual([]);
    expect(snapshot.slotName).toBe("Link");
    expect(
      snapshot.players.map((p) => `${p.slot}:${p.name}:${p.game}`),
    ).toEqual([
      "1:Link:A Link to the Past",
      "2:Samus:Super Metroid",
      "3:Hybrid Hero:SMZ3",
      "4:Quester:APQuest",
    ]);
    expect(snapshot.room).toMatchObject({
      generatorVersion: "0.6.8",
      hintCost: 10,
      locationCheckPoints: 1,
      passwordRequired: false,
      serverVersion: "0.6.8",
    });
    expect(snapshot.room?.checksums["A Link to the Past"]).toBe(
      "1858ba29ffb7bf55e9e71a76fc7aba1b5c0950e4",
    );
    expect(snapshot.checked).toEqual([]);
    expect(snapshot.missing).toHaveLength(249);
    expect(snapshot.slotData).toMatchObject({ mm_medalion: "Ether" });
  });

  it("follows every ReceivedItems and RoomUpdate the tracker got", () => {
    const { resets, snapshot, syncs } = fold(tracker);
    // Index 0 (first item), 1, then 3 after Collect and Release; then Sync's index 0.
    expect(snapshot.items.map((i) => [i.item, i.player, i.flags])).toEqual([
      [40, 4, 0],
      [169, 1, 1],
      [172, 1, 1],
      [23, 4, 2],
      [23, 4, 2],
    ]);
    expect(syncs).toBe(0);
    expect(resets).toBe(0);
    // A union: the Collect burst repeated ids already checked.
    expect(snapshot.checked).toEqual([1010170, 1310724, 1310727, 1572867]);
    expect(snapshot.missing).toHaveLength(245);
    expect(snapshot.missing).not.toContain(1310724);
    expect(snapshot.hintPoints).toBe(4);
    expect(snapshot.raceMode).toBe(false);
  });

  it("rebuilds the same state from a fresh connection (a refresh)", () => {
    const { snapshot } = fold(refresh);
    const whole = fold(tracker).snapshot;
    expect(snapshot.items).toEqual(whole.items);
    expect(snapshot.checked).toEqual(whole.checked);
    expect(snapshot.missing).toEqual(whole.missing);
  });

  it("keeps the items through a reconnection to the same run", () => {
    const before = fold(tracker).snapshot;
    const again = beginConnection(before);
    expect(again.ready).toBe(false);
    expect(again.room).toBeNull();
    expect(again.items).toBe(before.items);
    const [roomInfo, connected] = refresh;
    const { resets, snapshot } = fold([roomInfo, connected], again);
    expect(resets).toBe(0);
    expect(snapshot.items).toBe(before.items);
    expect(beginConnection(EMPTY_SNAPSHOT)).toBe(EMPTY_SNAPSHOT);
  });

  it("follows the slot's hints and the players' status as the server changes them", () => {
    const { snapshot } = fold(tracker);
    // The last SetReply: one hint found (status 40), one in Link's world
    expect(
      snapshot.hints?.map((h) => [h.receiver, h.finder, h.item, h.status]),
    ).toEqual([
      [3, 1, 84007, 0],
      [1, 4, 23, 40],
    ]);
    expect(snapshot.hints?.[1]?.found).toBe(true);
    // Link connected (5); Quester reached its goal (30), by SetReply
    expect(snapshot.clientStatus).toEqual({ 1: 5, 4: 30 });
  });

  it("reads every player's status and what the checked locations held, on a refresh", () => {
    const { snapshot } = fold(refresh);
    expect(snapshot.clientStatus).toEqual({ 1: 5, 2: 0, 3: 0, 4: 30 });
    // LocationInfo: the receiver of each item in Link's checked locations
    expect(snapshot.sent.map((i) => [i.location, i.item, i.player])).toEqual([
      [1010170, 84192, 3],
      [1310724, 169, 1],
      [1310727, 172, 1],
      [1572867, 7, 4],
    ]);
    // Asked again, nothing changes
    const info = refresh.find((p) => p.cmd === "LocationInfo");
    expect(reduce(snapshot, info).snapshot).toBe(snapshot);
    // Another run forgets them
    const samus = packetsTo(fixture("slot-data-normal"), "tracker:Samus");
    const other = fold(samus, beginConnection(snapshot)).snapshot;
    expect(other.sent).toEqual([]);
    expect(other.hints).not.toEqual(snapshot.hints);
  });

  it("asks for Sync on a gap and changes nothing", () => {
    const connectedAt = fold(tracker.slice(0, 2)).snapshot;
    const result = reduce(connectedAt, {
      cmd: "ReceivedItems",
      index: 2,
      items: [{ flags: 0, item: 1, location: 1, player: 1 }],
    });
    expect(result.sync).toBe(true);
    expect(result.snapshot).toBe(connectedAt);
  });

  it("drops the snapshot of another slot or run", () => {
    const link = fold(tracker).snapshot;
    const samus = packetsTo(fixture("slot-data-normal"), "tracker:Samus");
    const { resets, snapshot } = fold(samus, beginConnection(link));
    expect(resets).toBe(1);
    expect(snapshot.identity).toMatchObject({ game: "Super Metroid", slot: 2 });
    // Samus's own: the item Quester's release sent, none of Link's.
    expect(snapshot.items.map((i) => i.item)).toEqual([83002]);
    expect(snapshot.checked).not.toContain(1310724);
  });

  it("reads the race flag of a race multiworld", () => {
    const race = packetsTo(fixture("slot-data-race"), "tracker:Link");
    const { snapshot } = fold(race);
    expect(snapshot.raceMode).toBe(true);
    // ALttP sends no slot data in a race.
    expect(snapshot.slotData).toEqual({});
    const reply = reduce(snapshot, {
      cmd: "SetReply",
      key: "_read_race_mode",
      value: 0,
    });
    expect(reply.snapshot.raceMode).toBe(false);
    const same = reduce(snapshot, {
      cmd: "SetReply",
      key: "_read_race_mode",
      value: 1,
    });
    expect(same.snapshot).toBe(snapshot);
  });

  it("compares identities field by field", () => {
    const a = fold(tracker).snapshot.identity;
    if (a === null) throw new Error("no identity");
    expect(sameIdentity(a, { ...a })).toBe(true);
    for (const change of [
      { seedName: "x" },
      { generatorVersion: "0.6.7" },
      { team: 1 },
      { slot: 2 },
      { game: "SMZ3" },
    ]) {
      expect(sameIdentity(a, { ...a, ...change })).toBe(false);
    }
  });
});

describe("reduce, on packets that do not hold together", () => {
  const ready = fold(tracker.slice(0, 2)).snapshot;
  const [roomInfo, connected] = tracker as Record<string, unknown>[];

  it.each([
    ["not an object", null],
    ["an array", []],
    ["an unknown command", { cmd: "Bounced" }],
    ["RoomInfo without versions", { ...roomInfo, version: null }],
    ["RoomInfo with bad games", { ...roomInfo, games: [1] }],
    ["Connected without a slot", { ...connected, slot: "1" }],
    ["Connected without lists", { ...connected, missing_locations: null }],
    ["Connected for an unknown slot", { ...connected, slot: 9 }],
    [
      "ReceivedItems with a bad item",
      { cmd: "ReceivedItems", index: 0, items: [{ item: "x" }] },
    ],
    ["ReceivedItems without an index", { cmd: "ReceivedItems", items: [] }],
    [
      "Retrieved without the race flag",
      { cmd: "Retrieved", keys: { other: 1 } },
    ],
    [
      "Retrieved with a bad race flag",
      { cmd: "Retrieved", keys: { _read_race_mode: "1" } },
    ],
    [
      "SetReply of another slot's hints",
      { cmd: "SetReply", key: "_read_hints_0_2", value: [] },
    ],
    [
      "SetReply of the slot's hints that are not hints",
      { cmd: "SetReply", key: "_read_hints_0_1", value: [{ item: "x" }] },
    ],
    [
      "SetReply of another team's client status",
      { cmd: "SetReply", key: "_read_client_status_1_2", value: 30 },
    ],
    [
      "LocationInfo of a location not checked",
      {
        cmd: "LocationInfo",
        locations: [{ flags: 0, item: 1, location: 59758, player: 2 }],
      },
    ],
    ["LocationInfo without locations", { cmd: "LocationInfo" }],
    ["RoomUpdate with nothing known", { cmd: "RoomUpdate", foo: 1 }],
    [
      "RoomUpdate with a player without a team",
      { cmd: "RoomUpdate", players: [{ name: "Link", slot: 1 }] },
    ],
    [
      "RoomInfo with a version of strings",
      { ...roomInfo, version: { build: "8", major: 0, minor: 6 } },
    ],
    [
      "ReceivedItems with a non-object item",
      { cmd: "ReceivedItems", index: 0, items: [7] },
    ],
  ])("ignores %s", (_, packet) => {
    expect(reduce(ready, packet)).toEqual({
      reset: false,
      snapshot: ready,
      sync: false,
    });
  });

  it("keeps a client status read for the same slot unchanged", () => {
    const once = reduce(ready, {
      cmd: "SetReply",
      key: "_read_client_status_0_2",
      value: 20,
    }).snapshot;
    expect(once.clientStatus).toEqual({ 2: 20 });
    expect(
      reduce(once, {
        cmd: "SetReply",
        key: "_read_client_status_0_2",
        value: 20,
      }).snapshot,
    ).toBe(once);
  });

  it("connects with no player list when the list is malformed", () => {
    const next = reduce(ready, { ...connected, players: [1] }).snapshot;
    expect(next.ready).toBe(true);
    expect(next.players).toEqual([]);
  });

  it("ignores items and updates before Connected", () => {
    const fresh = fold([roomInfo]).snapshot;
    expect(
      reduce(fresh, { cmd: "ReceivedItems", index: 0, items: [] }).snapshot,
    ).toBe(fresh);
    expect(
      reduce(fresh, { checked_locations: [1], cmd: "RoomUpdate" }).snapshot,
    ).toBe(fresh);
    expect(reduce(EMPTY_SNAPSHOT, connected).snapshot).toBe(EMPTY_SNAPSHOT);
  });

  it("takes RoomUpdate's room settings and players", () => {
    const next = reduce(ready, {
      cmd: "RoomUpdate",
      hint_cost: 5,
      location_check_points: 2,
      players: [
        { alias: "Linky", name: "Link", slot: 1, team: 0 },
        { name: "New", slot: 9, team: 0 },
      ],
    }).snapshot;
    expect(next.room).toMatchObject({ hintCost: 5, locationCheckPoints: 2 });
    expect(next.players).toEqual([
      {
        alias: "Linky",
        game: "A Link to the Past",
        name: "Link",
        slot: 1,
        team: 0,
      },
      { alias: "New", game: "", name: "New", slot: 9, team: 0 },
    ]);
  });

  it("reads RoomInfo without checksums or point settings", () => {
    const {
      datapackage_checksums: _sums,
      hint_cost: _cost,
      location_check_points: _points,
      ...rest
    } = roomInfo;
    const room = reduce(EMPTY_SNAPSHOT, { ...rest, password: true }).snapshot
      .room;
    expect(room).toMatchObject({
      checksums: {},
      hintCost: null,
      locationCheckPoints: null,
      passwordRequired: true,
    });
    const odd = reduce(EMPTY_SNAPSHOT, {
      ...roomInfo,
      datapackage_checksums: { A: 1, B: "b" },
    }).snapshot.room;
    expect(odd?.checksums).toEqual({ B: "b" });
  });

  it("keeps defaults for Connected without points, slot data or names", () => {
    const info = connected.slot_info as Record<string, Record<string, unknown>>;
    const fresh = fold([roomInfo]).snapshot;
    const next = reduce(fresh, {
      ...connected,
      hint_points: undefined,
      players: [
        { name: "Link", slot: 1, team: 0 },
        { name: "Ghost", slot: 7, team: 0 },
      ],
      slot_data: [],
      slot_info: { ...info, 1: { ...info["1"], name: 5 } },
    }).snapshot;
    expect(next.hintPoints).toBeNull();
    expect(next.slotData).toBeNull();
    expect(next.slotName).toBeNull();
    expect(next.players.map((p) => p.game)).toEqual(["A Link to the Past", ""]);
    const noGame = reduce(fresh, {
      ...connected,
      slot_info: { 1: { name: "Link" } },
    });
    expect(noGame.snapshot).toBe(fresh);
  });
});
