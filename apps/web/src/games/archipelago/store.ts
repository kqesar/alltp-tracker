// The Archipelago board's run: the slot as the room's server last stated it,
// names resolved, persisted under its own key. It is what live follow, the
// stream view and the overlay read (the game module's `store`), so it never
// holds the address, the port or the password: those live in the connection's
// own key (connection.ts), which nothing publishes. No undo, no manual change:
// the board is the server's, and only the runtime writes it, at most once per
// 250 ms (runtime.ts). The player sets the prefs and the run timer alone.

import * as z from "zod/mini";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  finishTimer,
  IDLE_TIMER,
  isIdle,
  isRunning,
  pauseTimer,
  type RunTimer,
  startTimer,
} from "@/utils/runTimer";

/** Where the run is saved: apart from every other game's. */
export const AP_STORAGE_KEY = "alltp-tracker-archipelago";

/**
 * Bumped when the run changes shape, with a step in `migrate`. Version 2
 * adds the feed, the hints, what the checked locations held, the players'
 * status, the slot data, the run timer and their prefs.
 */
export const AP_SAVE_VERSION = 2;

/** How many feed lines the run keeps (and publishes). */
export const FEED_KEPT = 100;

const int = () => z.number().check(z.int(), z.gte(0));

/** Which run of which room the board shows: never where the room is. */
const roomSchema = z.object({
  /** The game's name-data checksum, to read names back from the cache. */
  checksum: z.nullable(z.string()),
  game: z.string(),
  generatorVersion: z.string(),
  seedName: z.string(),
  slot: int(),
  slotName: z.string(),
  team: int(),
});

/** An item the slot received, by name, with how many and AP's flags. */
const itemSchema = z.object({
  count: z.number().check(z.int(), z.gte(1)),
  /** AP's classification bits, OR-ed over the copies: 1 progression, 2 useful, 4 trap. */
  flags: int(),
  name: z.string(),
});

const playerSchema = z.object({
  game: z.string(),
  name: z.string(),
  slot: int(),
  /** `_read_client_status`: 0 unknown, 5 connected, 10 ready, 20 playing, 30 goal; null until read. */
  status: z.nullable(int()),
});

/** A piece of a feed line (the package's `FeedPart`), names resolved. */
const partSchema = z.object({
  flags: z.optional(int()),
  kind: z.enum(["text", "player", "item", "location", "status"]),
  me: z.optional(z.boolean()),
  text: z.string(),
});

/** A feed line written out (the package's `FeedEntry`). */
const feedEntrySchema = z.object({
  flags: int(),
  kind: z.enum([
    "item",
    "hint",
    "goal",
    "release",
    "collect",
    "presence",
    "countdown",
  ]),
  mine: z.boolean(),
  parts: z.array(partSchema),
  received: z.boolean(),
  seq: int(),
});

/** A hint involving the slot, names resolved. */
const hintSchema = z.object({
  /** The entrance leading there, in entrance-shuffled worlds. */
  entrance: z.string(),
  finder: z.string(),
  flags: int(),
  /** An item for the slot (else one for another, in the slot's world). */
  forMe: z.boolean(),
  item: z.string(),
  location: z.string(),
  receiver: z.string(),
  status: z.enum(["found", "priority", "unspecified", "no-priority", "avoid"]),
});

/** What one of the slot's checked locations held, and for whom. */
const sentSchema = z.object({
  flags: int(),
  item: z.string(),
  location: int(),
  /** The receiving slot. */
  to: int(),
});

const timerSchema = z.object({
  elapsedMs: z.number().check(z.gte(0)),
  finished: z.boolean(),
  startedAt: z.nullable(z.number()),
});

const prefsSchema = z.object({
  /** Say each progression item the slot receives (a polite live region). */
  announce: z.boolean(),
  /** The room's countdown starts the run timer at 0, the slot's goal stops it. */
  countdownTimer: z.boolean(),
  /** The feed's filter: the lines involving the slot, or the whole room's. */
  feedScope: z.enum(["mine", "room"]),
  hideChecked: z.boolean(),
  /** The panel beside the items: the checks, the hints or the players. */
  side: z.enum(["checks", "hints", "players"]),
});

/**
 * A run's shape, the source of its type: the saved run is data from outside
 * the page (another tab, an older version, a hand edit), so it is checked
 * against this schema as it is restored, and dropped when it does not hold.
 */
const runSchema = z.object({
  checked: z.array(int()),
  /** The room's feed, the last FEED_KEPT lines, names resolved. */
  feed: z.array(feedEntrySchema),
  /** What a hint costs the slot, in points; null until known. */
  hintCost: z.nullable(int()),
  hintPoints: z.nullable(z.number().check(z.int())),
  hints: z.array(hintSchema),
  items: z.array(itemSchema),
  missing: z.array(int()),
  players: z.array(playerSchema),
  prefs: prefsSchema,
  /** `_read_race_mode`: null until read. */
  raceMode: z.nullable(z.boolean()),
  /** How many items the slot received: the server's next index. */
  received: int(),
  room: z.nullable(roomSchema),
  sent: z.array(sentSchema),
  /** The slot data's plain values, kept outside races only: information. */
  slotData: z.nullable(
    z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  ),
  timer: timerSchema,
  /** When the server's data last changed the run, ms since the epoch. */
  updatedAt: z.nullable(z.number()),
});

export type ApRun = z.infer<typeof runSchema>;
export type ApRoom = NonNullable<ApRun["room"]>;
export type ApItem = ApRun["items"][number];
export type ApPlayer = ApRun["players"][number];
export type ApFeedEntry = ApRun["feed"][number];
export type ApHint = ApRun["hints"][number];
export type ApSent = ApRun["sent"][number];
export type ApPrefs = ApRun["prefs"];

/** What the server states, as the runtime lays it on the run. */
export type ApServerRun = Omit<ApRun, "prefs" | "timer">;

const freshPrefs = (): ApPrefs => ({
  announce: false,
  countdownTimer: true,
  feedScope: "mine",
  hideChecked: false,
  side: "checks",
});

export const freshRun = (): ApRun => ({
  checked: [],
  feed: [],
  hintCost: null,
  hintPoints: null,
  hints: [],
  items: [],
  missing: [],
  players: [],
  prefs: freshPrefs(),
  raceMode: null,
  received: 0,
  room: null,
  sent: [],
  slotData: null,
  timer: IDLE_TIMER,
  updatedAt: null,
});

type ApState = ApRun & {
  /** Lay what the server states: the prefs and the timer stay. */
  apply: (run: ApServerRun) => void;
  /** Change one pref; nothing is written when it does not change. */
  setPref: <K extends keyof ApPrefs>(key: K, value: ApPrefs[K]) => void;
  /** Hide the checks done in the list, or show them again. */
  setHideChecked: (hide: boolean) => void;
  startTimer: (at?: number) => void;
  pauseTimer: (at?: number) => void;
  resetTimer: () => void;
  /** The room's countdown reached 0: start an idle timer, if the player lets it. */
  countdownEnded: (at: number) => void;
  /** The slot reached its goal: stop a running timer there, if the player lets it. */
  goalReached: (at: number) => void;
};

const runOf = (state: ApRun): ApRun => ({
  checked: state.checked,
  feed: state.feed,
  hintCost: state.hintCost,
  hintPoints: state.hintPoints,
  hints: state.hints,
  items: state.items,
  missing: state.missing,
  players: state.players,
  prefs: state.prefs,
  raceMode: state.raceMode,
  received: state.received,
  room: state.room,
  sent: state.sent,
  slotData: state.slotData,
  timer: state.timer,
  updatedAt: state.updatedAt,
});

/**
 * A version 1 run, as version 2 holds it: the new fields empty, the timer
 * idle, the prefs at their defaults, each player's status not read yet.
 */
export const migrateRun = (saved: unknown, version: number): unknown => {
  if (version >= AP_SAVE_VERSION) return saved;
  if (typeof saved !== "object" || saved === null) return saved;
  const v1 = saved as Record<string, unknown>;
  const fresh = freshRun();
  const players = Array.isArray(v1.players)
    ? v1.players.map((player) =>
        typeof player === "object" && player !== null
          ? { ...player, status: null }
          : player,
      )
    : v1.players;
  const prefs =
    typeof v1.prefs === "object" && v1.prefs !== null
      ? { ...fresh.prefs, ...v1.prefs }
      : v1.prefs;
  return {
    ...v1,
    feed: fresh.feed,
    hintCost: fresh.hintCost,
    hintPoints: fresh.hintPoints,
    hints: fresh.hints,
    players,
    prefs,
    sent: fresh.sent,
    slotData: fresh.slotData,
    timer: fresh.timer,
  };
};

export const useArchipelagoStore = create<ApState>()(
  persist<ApState, [], [], ApRun>(
    (set, get) => {
      const setTimer = (timer: RunTimer) => {
        if (timer !== get().timer) set({ timer });
      };
      return {
        ...freshRun(),
        apply: (run) => set({ ...run, prefs: get().prefs, timer: get().timer }),
        countdownEnded: (at) => {
          const { prefs, timer } = get();
          // Only a timer that has counted nothing: a countdown mid-run
          // (another !countdown) never restarts one
          if (prefs.countdownTimer && isIdle(timer)) {
            setTimer(startTimer(timer, at));
          }
        },
        // The run's time, kept (and saved) as the run's own: a reload shows it
        goalReached: (at) => {
          const { prefs, timer } = get();
          if (prefs.countdownTimer && isRunning(timer)) {
            setTimer(finishTimer(timer, at));
          }
        },
        pauseTimer: (at = Date.now()) => setTimer(pauseTimer(get().timer, at)),
        resetTimer: () => setTimer(IDLE_TIMER),
        setHideChecked: (hideChecked) =>
          get().setPref("hideChecked", hideChecked),
        setPref: (key, value) => {
          if (get().prefs[key] !== value) {
            set({ prefs: { ...get().prefs, [key]: value } });
          }
        },
        startTimer: (at = Date.now()) => setTimer(startTimer(get().timer, at)),
      };
    },
    {
      // A saved run that is not one is dropped for an empty board: the next
      // connection fills it again from the server
      merge: (saved, current) => {
        const parsed = runSchema.safeParse(saved);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
      migrate: (saved, version) => migrateRun(saved, version) as ApRun,
      name: AP_STORAGE_KEY,
      partialize: runOf,
      storage: createJSONStorage(() => localStorage),
      version: AP_SAVE_VERSION,
    },
  ),
);

/** Whether two rooms are the same run of the same slot. */
export const sameRun = (a: ApRoom, b: ApRoom) =>
  a.seedName === b.seedName &&
  a.generatorVersion === b.generatorVersion &&
  a.team === b.team &&
  a.slot === b.slot &&
  a.game === b.game;
