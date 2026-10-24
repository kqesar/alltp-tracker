// The room's feed: what AP's own text client prints, read from PrintJSON's
// typed fields (never its text), folded into lines a board shows, then
// resolved into names. Three steps, all pure:
//
// 1. `feedEvent` reads one PrintJSON: an item sent, a hint, a goal, a
//    release or collect, a client joining or leaving, a countdown. Chat,
//    server chat, the tutorial, command results, tag changes and the
//    rare admin's item cheat are dropped: noise for a tracker, and no chat.
// 2. `foldFeed` lays an event on the lines, by ids: a release or collect
//    takes the item sends that follow it into one line ("Quester released
//    143 items, 12 for you"), joins and parts in a row collapse into one,
//    and a countdown counts down on its own line. The tail is capped.
// 3. `resolveLine` writes a line in parts (players, items, locations by
//    name) through the name data of the games it needs (`lineGames`), which
//    the app loads lazily, only for lines that need them.

/** One event of the room, by ids, as a PrintJSON states it. */
export type FeedEvent =
  | {
      readonly kind: "item";
      readonly finder: number;
      readonly receiver: number;
      readonly item: number;
      readonly location: number;
      readonly flags: number;
    }
  | {
      readonly kind: "hint";
      readonly finder: number;
      readonly receiver: number;
      readonly item: number;
      readonly location: number;
      readonly flags: number;
      readonly found: boolean;
    }
  | {
      readonly kind: "goal" | "release" | "collect";
      readonly slot: number;
    }
  | { readonly kind: "join" | "part"; readonly slot: number }
  | { readonly kind: "countdown"; readonly value: number };

/** A line of the feed, by ids. `seq` orders the lines and keys them. */
export type FeedLine =
  | (Extract<FeedEvent, { kind: "item" | "hint" }> & { readonly seq: number })
  | {
      readonly kind: "goal";
      readonly seq: number;
      readonly slot: number;
    }
  | {
      readonly kind: "release" | "collect";
      readonly seq: number;
      readonly slot: number;
      /** The item sends the burst took. */
      readonly count: number;
      /** Of them, those for `me` (release) or from `me`'s world (collect). */
      readonly mine: number;
    }
  | {
      readonly kind: "presence";
      readonly seq: number;
      readonly joined: readonly number[];
      readonly left: readonly number[];
    }
  | {
      readonly kind: "countdown";
      readonly seq: number;
      readonly from: number;
      readonly left: number;
    };

export interface FeedState {
  readonly lines: readonly FeedLine[];
  /** The next line's `seq`. */
  readonly next: number;
}

/** How many lines the feed keeps: its tail. */
export const FEED_CAP = 200;

export const emptyFeed = (next = 0): FeedState => ({ lines: [], next });

type Record_ = Record<string, unknown>;
const isRecord = (value: unknown): value is Record_ =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isInt = (value: unknown): value is number => Number.isInteger(value);

/** The NetworkItem a PrintJSON carries; `player` is the finder. */
function sentItem(packet: Record_) {
  const { item: entry, receiving } = packet;
  if (!isRecord(entry) || !isInt(receiving)) return null;
  const { flags, item, location, player } = entry;
  return isInt(item) && isInt(location) && isInt(player) && isInt(flags)
    ? { finder: player, flags, item, location, receiver: receiving }
    : null;
}

/** The PrintJSON types the feed shows; every other is dropped. */
export const FEED_TYPES = [
  "ItemSend",
  "Hint",
  "Goal",
  "Release",
  "Collect",
  "Join",
  "Part",
  "Countdown",
] as const;

/**
 * One server packet as a feed event, or null: not a PrintJSON, a type the
 * feed drops (Chat, ServerChat, Tutorial, CommandResult, AdminCommandResult,
 * TagsChanged, ItemCheat, an untyped message), or fields that do not hold.
 */
export function feedEvent(packet: unknown): FeedEvent | null {
  if (!isRecord(packet) || packet.cmd !== "PrintJSON") return null;
  const { slot } = packet;
  switch (packet.type) {
    case "ItemSend": {
      const sent = sentItem(packet);
      return sent === null ? null : { kind: "item", ...sent };
    }
    case "Hint": {
      const sent = sentItem(packet);
      return sent === null || typeof packet.found !== "boolean"
        ? null
        : { found: packet.found, kind: "hint", ...sent };
    }
    case "Goal":
    case "Release":
    case "Collect":
    case "Part": {
      if (!isInt(slot)) return null;
      const kind = (
        {
          Collect: "collect",
          Goal: "goal",
          Part: "part",
          Release: "release",
        } as const
      )[packet.type];
      return { kind, slot };
    }
    case "Join":
      return isInt(slot) ? { kind: "join", slot } : null;
    case "Countdown":
      return isInt(packet.countdown) && packet.countdown >= 0
        ? { kind: "countdown", value: packet.countdown }
        : null;
    default:
      return null;
  }
}

/** The line a burst's item send folds into, with the line changed; or null. */
function foldIntoBurst(
  last: FeedLine | undefined,
  event: FeedEvent,
  me: number,
): FeedLine | null {
  if (last === undefined || event.kind !== "item") return null;
  if (last.kind === "release" && event.finder === last.slot) {
    return {
      ...last,
      count: last.count + 1,
      mine: last.mine + (event.receiver === me ? 1 : 0),
    };
  }
  if (
    last.kind === "collect" &&
    event.receiver === last.slot &&
    event.finder !== last.slot
  ) {
    return {
      ...last,
      count: last.count + 1,
      mine: last.mine + (event.finder === me ? 1 : 0),
    };
  }
  return null;
}

const without = (list: readonly number[], slot: number) =>
  list.filter((entry) => entry !== slot);

/** Joins and parts in a row: one line, each player once, as they stand last. */
function foldPresence(
  last: FeedLine | undefined,
  event: Extract<FeedEvent, { kind: "join" | "part" }>,
): Extract<FeedLine, { kind: "presence" }> | null {
  if (last?.kind !== "presence") return null;
  return event.kind === "join"
    ? {
        ...last,
        joined: [...without(last.joined, event.slot), event.slot],
        left: without(last.left, event.slot),
      }
    : {
        ...last,
        joined: without(last.joined, event.slot),
        left: [...without(last.left, event.slot), event.slot],
      };
}

/**
 * Lays one event on the feed. `me` is the tracked slot (what a burst counts
 * as "for you"); the tail keeps the last `cap` lines.
 */
export function foldFeed(
  state: FeedState,
  event: FeedEvent,
  me: number,
  cap = FEED_CAP,
): FeedState {
  const last = state.lines.at(-1);
  const replaceLast = (line: FeedLine): FeedState => ({
    lines: [...state.lines.slice(0, -1), line],
    next: state.next,
  });
  const append = (line: FeedLine): FeedState => ({
    lines: [...state.lines, line].slice(-cap),
    next: state.next + 1,
  });
  const seq = state.next;

  const burst = foldIntoBurst(last, event, me);
  if (burst !== null) return replaceLast(burst);

  switch (event.kind) {
    case "item":
    case "hint":
      return append({ ...event, seq });
    case "goal":
      return append({ kind: "goal", seq, slot: event.slot });
    case "release":
    case "collect":
      return append({
        count: 0,
        kind: event.kind,
        mine: 0,
        seq,
        slot: event.slot,
      });
    case "join":
    case "part": {
      const merged = foldPresence(last, event);
      if (merged !== null) return replaceLast(merged);
      return append(
        event.kind === "join"
          ? { joined: [event.slot], kind: "presence", left: [], seq }
          : { joined: [], kind: "presence", left: [event.slot], seq },
      );
    }
    case "countdown": {
      // "Starting countdown of 10s", then 10, 9… 0: one line counting down
      if (
        last?.kind === "countdown" &&
        last.left > 0 &&
        event.value <= last.left
      ) {
        return replaceLast({ ...last, left: event.value });
      }
      return append({
        from: event.value,
        kind: "countdown",
        left: event.value,
        seq,
      });
    }
  }
}

/**
 * Whether a line involves the tracked slot: its items sent or received, its
 * hints, its goal, a release or collect by it or with items of its own, and
 * a countdown (everyone's start). Joins and parts are the room's.
 */
export function involves(line: FeedLine, me: number): boolean {
  switch (line.kind) {
    case "item":
    case "hint":
      return line.finder === me || line.receiver === me;
    case "goal":
      return line.slot === me;
    case "release":
    case "collect":
      return line.slot === me || line.mine > 0;
    case "presence":
      return false;
    case "countdown":
      return true;
  }
}

/**
 * The games whose names a line needs: an item is named by its receiver's
 * game, a location by its finder's.
 */
export function lineGames(
  line: FeedLine,
  gameOf: (slot: number) => string | undefined,
): string[] {
  if (line.kind !== "item" && line.kind !== "hint") return [];
  const games = new Set<string>();
  for (const slot of [line.receiver, line.finder]) {
    const game = gameOf(slot);
    if (game !== undefined && game !== "") games.add(game);
  }
  return [...games];
}

/** A piece of a resolved line: words, or a name with what it names. */
export type FeedPart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "player"; readonly text: string; readonly me: boolean }
  | { readonly kind: "item"; readonly text: string; readonly flags: number }
  | { readonly kind: "location"; readonly text: string }
  | { readonly kind: "status"; readonly text: string };

/** A line written out: what a board, the stream view and a screen reader read. */
export interface FeedEntry {
  readonly seq: number;
  readonly kind: FeedLine["kind"];
  /** It involves the tracked slot (`involves`). */
  readonly mine: boolean;
  /** An item the tracked slot received (an item line to it): what may be announced. */
  readonly received: boolean;
  /** The item's AP flags, on item and hint lines; 0 otherwise. */
  readonly flags: number;
  readonly parts: readonly FeedPart[];
}

/** What resolving a line reads: names by slot, and by id within a game. */
export interface FeedNames {
  readonly me: number;
  player(slot: number): string;
  game(slot: number): string | undefined;
  item(game: string | undefined, id: number): string | undefined;
  location(game: string | undefined, id: number): string | undefined;
}

const text = (words: string): FeedPart => ({ kind: "text", text: words });

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** A line in parts, every id named (or "Item n" / "Location n" until its game's names load). */
export function resolveLine(line: FeedLine, names: FeedNames): FeedEntry {
  const player = (slot: number): FeedPart => ({
    kind: "player",
    me: slot === names.me,
    text: slot === 0 ? "the server" : names.player(slot),
  });
  const base = {
    flags: 0,
    kind: line.kind,
    mine: involves(line, names.me),
    received: false,
    seq: line.seq,
  };
  switch (line.kind) {
    case "item":
    case "hint": {
      const item: FeedPart = {
        flags: line.flags,
        kind: "item",
        text:
          names.item(names.game(line.receiver), line.item) ??
          `Item ${line.item}`,
      };
      const location: FeedPart = {
        kind: "location",
        text:
          names.location(names.game(line.finder), line.location) ??
          `Location ${line.location}`,
      };
      if (line.kind === "hint") {
        return {
          ...base,
          flags: line.flags,
          parts: [
            player(line.receiver),
            text("'s "),
            item,
            text(" is at "),
            location,
            text(" in "),
            player(line.finder),
            text("'s world"),
            ...(line.found
              ? [text(" — "), { kind: "status", text: "found" } as FeedPart]
              : []),
          ],
        };
      }
      return {
        ...base,
        flags: line.flags,
        parts:
          line.finder === line.receiver
            ? [
                player(line.finder),
                text(" found their "),
                item,
                text(" ("),
                location,
                text(")"),
              ]
            : [
                player(line.finder),
                text(" sent "),
                item,
                text(" to "),
                player(line.receiver),
                text(" ("),
                location,
                text(")"),
              ],
        received: line.receiver === names.me,
      };
    }
    case "goal":
      return {
        ...base,
        parts: [player(line.slot), text(" completed their goal")],
      };
    case "release":
    case "collect": {
      const verb = line.kind === "release" ? " released " : " collected ";
      const mine =
        line.mine === 0
          ? ""
          : line.kind === "release"
            ? `, ${line.mine} for you`
            : `, ${line.mine} from your world`;
      return {
        ...base,
        parts: [
          player(line.slot),
          text(`${verb}${plural(line.count, "item")}${mine}`),
        ],
      };
    }
    case "presence": {
      const parts: FeedPart[] = [];
      const list = (label: string, slots: readonly number[]) => {
        if (slots.length === 0) return;
        if (parts.length > 0) parts.push(text(" · "));
        parts.push(text(label));
        slots.forEach((slot, index) => {
          if (index > 0) parts.push(text(", "));
          parts.push(player(slot));
        });
      };
      list("Joined: ", line.joined);
      list("Left: ", line.left);
      return { ...base, parts };
    }
    case "countdown":
      return {
        ...base,
        parts: [
          text(
            line.left === 0
              ? `Countdown from ${line.from}: GO`
              : `Countdown: ${line.left}…`,
          ),
        ],
      };
  }
}

/** A resolved line as plain words: for a screen reader and the tests. */
export const entryText = (entry: Pick<FeedEntry, "parts">): string =>
  entry.parts.map((part) => part.text).join("");
