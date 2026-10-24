import { describe, expect, it } from "vitest";
import { dataPackage, fixture, packetsTo } from "../test/fixtures";
import { type GamePackage, type NameData, nameData } from "./datapackage";
import {
  emptyFeed,
  entryText,
  type FeedEvent,
  type FeedLine,
  type FeedNames,
  type FeedState,
  feedEvent,
  foldFeed,
  involves,
  lineGames,
  resolveLine,
} from "./feed";

const normal = fixture("normal-session");
const tracker = packetsTo(normal, "tracker");

const LINK = 1;

function fold(packets: readonly unknown[], me = LINK, cap?: number) {
  let state: FeedState = emptyFeed();
  for (const packet of packets) {
    const event = feedEvent(packet);
    if (event !== null) state = foldFeed(state, event, me, cap);
  }
  return state;
}

const PLAYERS: Record<number, { name: string; game: string }> = {
  1: { game: "A Link to the Past", name: "Link" },
  2: { game: "Super Metroid", name: "Samus" },
  3: { game: "SMZ3", name: "Hybrid Hero" },
  4: { game: "APQuest", name: "Quester" },
};

const load = (game: string): NameData => {
  const { archipelago: _a, game: _g, ...pkg } = dataPackage(game);
  return nameData(game, pkg as unknown as GamePackage);
};

/** Names as a board has them once every game a line needs is loaded. */
function names(loaded: readonly string[]): FeedNames {
  const data = new Map(loaded.map((game) => [game, load(game)]));
  return {
    game: (slot) => PLAYERS[slot]?.game,
    item: (game, id) =>
      game === undefined ? undefined : data.get(game)?.items.get(id),
    location: (game, id) =>
      game === undefined ? undefined : data.get(game)?.locations.get(id),
    me: LINK,
    player: (slot) => PLAYERS[slot]?.name ?? `Player ${slot}`,
  };
}

const ALL = ["A Link to the Past", "Super Metroid", "SMZ3", "APQuest"];

describe("feedEvent", () => {
  it("reads the recorded PrintJSON types and drops chat and noise", () => {
    const types = new Map<string, number>();
    for (const packet of tracker) {
      if (packet.cmd !== "PrintJSON") continue;
      const kind = feedEvent(packet)?.kind ?? `dropped ${packet.type}`;
      types.set(kind, (types.get(kind) ?? 0) + 1);
    }
    expect(Object.fromEntries(types)).toEqual({
      collect: 1,
      countdown: 4,
      "dropped Chat": 2,
      "dropped TagsChanged": 1,
      "dropped Tutorial": 1,
      goal: 1,
      hint: 2,
      item: 15,
      join: 4,
      part: 3,
      release: 1,
    });
  });

  it.each([
    ["not a PrintJSON", { cmd: "RoomUpdate" }],
    [
      "an item without its receiver",
      { cmd: "PrintJSON", item: {}, type: "ItemSend" },
    ],
    [
      "an item of strings",
      { cmd: "PrintJSON", item: { item: "x" }, receiving: 1, type: "ItemSend" },
    ],
    [
      "a hint without found",
      {
        cmd: "PrintJSON",
        item: { flags: 0, item: 1, location: 1, player: 1 },
        receiving: 1,
        type: "Hint",
      },
    ],
    ["a goal without a slot", { cmd: "PrintJSON", type: "Goal" }],
    ["a join without a slot", { cmd: "PrintJSON", type: "Join" }],
    [
      "a countdown below 0",
      { cmd: "PrintJSON", countdown: -1, type: "Countdown" },
    ],
    ["an item cheat", { cmd: "PrintJSON", type: "ItemCheat" }],
    ["server chat", { cmd: "PrintJSON", type: "ServerChat" }],
    ["an untyped message", { cmd: "PrintJSON", data: [{ text: "hi" }] }],
    ["null", null],
  ])("drops %s", (_, packet) => {
    expect(feedEvent(packet)).toBeNull();
  });
});

describe("foldFeed, over the recorded session", () => {
  const state = fold(tracker);
  const text = (lines: readonly FeedLine[], loaded = ALL) =>
    lines.map((line) => entryText(resolveLine(line, names(loaded))));

  it("writes the room as AP's text client does, bursts and presence folded", () => {
    expect(text(state.lines)).toEqual([
      "Joined: Link, Quester",
      "Quester sent Bombs (3) to Link (Top Middle Chest)",
      "Quester sent Missile to Hybrid Hero (Top Left Room Chest)",
      "Joined: Link",
      "Link found their Small Key (Ice Palace) (Ice Palace - Jelly Key Drop)",
      "Link found their Small Key (Turtle Rock) (Turtle Rock - Pokey 2 Key Drop)",
      "Link sent ETank to Hybrid Hero (Old Man)",
      "Link's Piece of Heart is at Bottom Left Chest in Quester's world",
      "Hybrid Hero's Firerod is at Swamp Palace - Waterway Pot Key in Link's world",
      "Countdown from 2: GO",
      "Quester completed their goal",
      "Quester collected 6 items, 1 from your world",
      "Quester released 4 items, 2 for you",
      "Left: Quester, Link",
    ]);
    expect(state.next).toBe(14);
  });

  it("keeps the lines that involve the slot for the default filter", () => {
    const mine = state.lines.filter((line) => involves(line, LINK));
    expect(mine.map((line) => line.kind)).toEqual([
      "item",
      "item",
      "item",
      "item",
      "hint",
      "hint",
      "countdown",
      "collect",
      "release",
    ]);
    // Another slot sees its own
    expect(
      fold(tracker, 2)
        .lines.filter((line) => involves(line, 2))
        .map((line) => line.kind),
    ).toEqual(["countdown", "collect", "release"]);
  });

  it("names a line's items by the receiver's game and its locations by the finder's", () => {
    const sent = state.lines[2];
    expect(lineGames(sent as FeedLine, (slot) => PLAYERS[slot]?.game)).toEqual([
      "SMZ3",
      "APQuest",
    ]);
    expect(text([sent as FeedLine], ["SMZ3", "APQuest"]).join("")).not.toMatch(
      /Item|Location/,
    );
    expect(lineGames(state.lines[0] as FeedLine, () => "x")).toEqual([]);
    expect(lineGames(sent as FeedLine, () => undefined)).toEqual([]);
  });

  it("marks what the slot received, for the announcer", () => {
    const entries = state.lines.map((line) => resolveLine(line, names(ALL)));
    expect(entries.filter((e) => e.received).map((e) => e.seq)).toEqual([
      1, 4, 5,
    ]);
    expect(entries[4]).toMatchObject({ flags: 1, kind: "item", mine: true });
    // Names of the slot itself are marked
    expect(entries[4]?.parts[0]).toEqual({
      kind: "player",
      me: true,
      text: "Link",
    });
  });

  it("keeps a capped tail", () => {
    const capped = fold(tracker, LINK, 3);
    expect(capped.lines.map((line) => line.seq)).toEqual([11, 12, 13]);
    expect(capped.next).toBe(14);
  });
});

describe("foldFeed, edges", () => {
  const item = (finder: number, receiver: number): FeedEvent => ({
    finder,
    flags: 0,
    item: 1,
    kind: "item",
    location: 1,
    receiver,
  });
  const run = (events: FeedEvent[], me = 1) =>
    events.reduce((state, event) => foldFeed(state, event, me), emptyFeed());

  it("ends a burst at the first send that is not part of it", () => {
    const state = run([
      { kind: "release", slot: 2 },
      item(2, 1),
      item(3, 1),
      item(2, 1),
    ]);
    expect(state.lines.map((line) => line.kind)).toEqual([
      "release",
      "item",
      "item",
    ]);
    expect(state.lines[0]).toMatchObject({ count: 1, mine: 1 });
  });

  it("says a release or collect of nothing, and one of one", () => {
    const state = run([
      { kind: "collect", slot: 2 },
      { kind: "release", slot: 1 },
      item(1, 3),
    ]);
    expect(
      state.lines.map((line) => entryText(resolveLine(line, names([])))),
    ).toEqual(["Samus collected 0 items", "Link released 1 item"]);
    expect(involves(state.lines[1] as FeedLine, 1)).toBe(true);
  });

  it("collapses joins and parts in a row, each player as they stand last", () => {
    const state = run([
      { kind: "join", slot: 2 },
      { kind: "part", slot: 2 },
      { kind: "join", slot: 3 },
      { kind: "join", slot: 2 },
    ]);
    expect(state.lines).toEqual([
      { joined: [3, 2], kind: "presence", left: [], seq: 0 },
    ]);
    expect(run([{ kind: "part", slot: 2 }]).lines[0]).toMatchObject({
      joined: [],
      left: [2],
    });
  });

  it("starts a new countdown line when one is restarted or the last ended", () => {
    const state = run([
      { kind: "countdown", value: 10 },
      { kind: "countdown", value: 9 },
      { kind: "countdown", value: 20 },
      { kind: "countdown", value: 0 },
      { kind: "countdown", value: 3 },
    ]);
    expect(
      state.lines.map((line) => entryText(resolveLine(line, names([])))),
    ).toEqual(["Countdown: 9…", "Countdown from 20: GO", "Countdown: 3…"]);
  });

  it("names the server, and a found hint", () => {
    const state = run([
      item(0, 1),
      {
        finder: 2,
        flags: 1,
        found: true,
        item: 5,
        kind: "hint",
        location: 7,
        receiver: 1,
      },
      { kind: "goal", slot: 1 },
    ]);
    expect(
      state.lines.map((line) => entryText(resolveLine(line, names([])))),
    ).toEqual([
      "the server sent Item 1 to Link (Location 1)",
      "Link's Item 5 is at Location 7 in Samus's world — found",
      "Link completed their goal",
    ]);
    expect(involves(state.lines[2] as FeedLine, 1)).toBe(true);
  });
});
