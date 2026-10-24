// The Archipelago board's run: the slot as the room's server last stated it,
// names resolved, persisted under its own key. It is what live follow, the
// stream view and the overlay read (the game module's `store`), so it never
// holds the address, the port or the password: those live in the connection's
// own key (connection.ts), which nothing publishes. No undo, no manual change:
// the board is the server's, and only the runtime writes it, at most once per
// 250 ms (runtime.ts).

import * as z from "zod/mini";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Where the run is saved: apart from every other game's. */
export const AP_STORAGE_KEY = "alltp-tracker-archipelago";

/** Bumped when the run changes shape. */
export const AP_SAVE_VERSION = 1;

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
});

/**
 * A run's shape, the source of its type: the saved run is data from outside
 * the page (another tab, an older version, a hand edit), so it is checked
 * against this schema as it is restored, and dropped when it does not hold.
 */
const runSchema = z.object({
  checked: z.array(int()),
  items: z.array(itemSchema),
  missing: z.array(int()),
  players: z.array(playerSchema),
  prefs: z.object({ hideChecked: z.boolean() }),
  /** `_read_race_mode`: null until read. */
  raceMode: z.nullable(z.boolean()),
  /** How many items the slot received: the server's next index. */
  received: int(),
  room: z.nullable(roomSchema),
  /** When the server's data last changed the run, ms since the epoch. */
  updatedAt: z.nullable(z.number()),
});

export type ApRun = z.infer<typeof runSchema>;
export type ApRoom = NonNullable<ApRun["room"]>;
export type ApItem = ApRun["items"][number];

/** What the server states, as the runtime lays it on the run. */
export type ApServerRun = Omit<ApRun, "prefs">;

export const freshRun = (): ApRun => ({
  checked: [],
  items: [],
  missing: [],
  players: [],
  prefs: { hideChecked: false },
  raceMode: null,
  received: 0,
  room: null,
  updatedAt: null,
});

type ApState = ApRun & {
  /** Lay what the server states: the prefs stay. */
  apply: (run: ApServerRun) => void;
  /** Hide the checks done in the list, or show them again. */
  setHideChecked: (hide: boolean) => void;
};

const runOf = (state: ApRun): ApRun => ({
  checked: state.checked,
  items: state.items,
  missing: state.missing,
  players: state.players,
  prefs: state.prefs,
  raceMode: state.raceMode,
  received: state.received,
  room: state.room,
  updatedAt: state.updatedAt,
});

export const useArchipelagoStore = create<ApState>()(
  persist<ApState, [], [], ApRun>(
    (set, get) => ({
      ...freshRun(),
      apply: (run) => set({ ...run, prefs: get().prefs }),
      setHideChecked: (hideChecked) => {
        if (get().prefs.hideChecked !== hideChecked) {
          set({ prefs: { ...get().prefs, hideChecked } });
        }
      },
    }),
    {
      // A saved run that is not one is dropped for an empty board: the next
      // connection fills it again from the server
      merge: (saved, current) => {
        const parsed = runSchema.safeParse(saved);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
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
