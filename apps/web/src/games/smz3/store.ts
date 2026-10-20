// The SMZ3 run: what the player holds in both games, the locations checked,
// the run's settings and what the player knows of the medallion pads. One
// Zustand store, saved under its own key (each game keeps its run), with
// undo and redo, as Super Metroid's (games/sm/store.ts).

import {
  DEFAULT_SETTINGS,
  ITEMS,
  MEDALLIONS,
  REGION_MODULES,
  type Smz3Settings,
} from "@alltp/pack-smz3";
import * as z from "zod/mini";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Where the run is saved: apart from the other games', so each keeps its own. */
export const SMZ3_STORAGE_KEY = "alltp-tracker-smz3";

/** Bumped when Smz3Progress changes shape. */
export const SMZ3_SAVE_VERSION = 1;

const ITEM_IDS = ITEMS.map((item) => item.id) as [string, ...string[]];
const MAX = new Map(ITEMS.map((item) => [item.id, item.max]));
export const LOCATION_IDS = REGION_MODULES.flatMap((m) =>
  m.region.locations.map((l) => l.id),
) as [string, ...string[]];

const pad = z.enum(["unknown", ...MEDALLIONS]);
const count = (max: number) => z.number().check(z.int(), z.gte(0), z.lte(max));

/**
 * A run's shape, the source of its type: a save file is data from outside
 * the page, and TypeScript's types vanish at runtime, so an import is
 * checked against this schema before it reaches the store. Without it, a
 * file of another game or a hand-edited count would land as is and break
 * the board or the logic.
 */
const progressSchema = z.object({
  checked: z.array(z.enum(LOCATION_IDS)),
  items: z.partialRecord(z.enum(ITEM_IDS), count(40)),
  pads: z.object({ mire: pad, turtleRock: pad }),
  settings: z.object({
    ganonCrystals: count(7),
    keysanity: z.boolean(),
    smLogic: z.enum(["normal", "hard"]),
    tourianBosses: count(4),
    towerCrystals: count(7),
  }),
});

export type Smz3Progress = z.infer<typeof progressSchema>;
export type Smz3Pads = Smz3Progress["pads"];

/** A fresh run of a run type: nothing held or checked, the pads unknown. */
export const freshProgress = (
  settings: Smz3Settings = DEFAULT_SETTINGS,
): Smz3Progress => ({
  checked: [],
  items: Object.fromEntries(ITEM_IDS.map((id) => [id, 0])),
  pads: { mire: "unknown", turtleRock: "unknown" },
  settings,
});

/**
 * A run whose items the save left out, from an older pool, held at 0.
 * Declared before the store, which restores a saved run as it is created.
 */
const completed = (progress: Smz3Progress): Smz3Progress => ({
  ...progress,
  items: { ...freshProgress().items, ...progress.items },
});

/** Whether every count is within its item's pool. */
const withinPools = (items: Smz3Progress["items"]) =>
  Object.entries(items).every(
    ([id, value]) => (value ?? 0) <= (MAX.get(id) ?? 0),
  );

/** Undo depth, as the other games'. */
const HISTORY_LIMIT = 200;

type Smz3State = Smz3Progress & {
  past: Smz3Progress[];
  future: Smz3Progress[];
  /** Step an item: +1 or -1, wrapping within 0 and its pool. */
  step: (id: string, direction: 1 | -1) => void;
  /** Check the locations, or none of them once all are. */
  toggleChecks: (ids: readonly string[]) => void;
  /** Change the run's settings; what it holds and checked stays. */
  setSettings: (change: Partial<Smz3Settings>) => void;
  /** What the player knows a medallion pad wants. */
  setPad: (which: keyof Smz3Pads, medallion: Smz3Pads["mire"]) => void;
  /** A new game: nothing held or checked, the settings kept, the pads unknown. */
  reset: () => void;
  undo: () => void;
  redo: () => void;
  /** Replace the run with a save's: one undo step. */
  load: (progress: Smz3Progress) => void;
  /**
   * Lay what the game says on the run and on every snapshot of its history:
   * no step, so undoing the player's change never undoes the game's.
   */
  applyGameNews: (
    change: (run: Smz3Progress) => Partial<Smz3Progress> | null,
  ) => void;
};

const progressOf = (state: Smz3Progress): Smz3Progress => ({
  checked: state.checked,
  items: state.items,
  pads: state.pads,
  settings: state.settings,
});

export const useSmz3Store = create<Smz3State>()(
  persist<Smz3State, [], [], Smz3Progress>(
    (set, get) => {
      /** A change of the player's: one step of the history. */
      const record = (change: Partial<Smz3Progress>) =>
        set((state) => ({
          ...change,
          future: [],
          past: [...state.past, progressOf(state)].slice(-HISTORY_LIMIT),
        }));
      return {
        ...freshProgress(),
        applyGameNews: (change) => {
          const state = get();
          const now = change(progressOf(state));
          const rebase = (history: Smz3Progress[]) =>
            history.map((run) => {
              const changed = change(run);
              return changed === null ? run : { ...run, ...changed };
            });
          set({
            ...(now ?? {}),
            future: rebase(state.future),
            past: rebase(state.past),
          });
        },
        future: [],
        load: (progress) => record(progress),
        past: [],
        redo: () =>
          set((state) => {
            const [next, ...future] = state.future;
            if (next === undefined) return state;
            return {
              ...next,
              future,
              past: [...state.past, progressOf(state)],
            };
          }),
        reset: () => record(freshProgress(get().settings)),
        setPad: (which, medallion) => {
          if (get().pads[which] !== medallion) {
            record({ pads: { ...get().pads, [which]: medallion } });
          }
        },
        setSettings: (change) => {
          const settings = { ...get().settings, ...change };
          const same = (Object.keys(settings) as (keyof Smz3Settings)[]).every(
            (key) => settings[key] === get().settings[key],
          );
          if (!same) record({ settings });
        },
        step: (id, direction) => {
          const max = MAX.get(id) ?? 1;
          const value = get().items[id] ?? 0;
          const next = (value + direction + max + 1) % (max + 1);
          record({ items: { ...get().items, [id]: next } });
        },
        toggleChecks: (ids) => {
          const checked = new Set(get().checked);
          const all = ids.every((id) => checked.has(id));
          for (const id of ids) {
            if (all) checked.delete(id);
            else checked.add(id);
          }
          record({ checked: [...checked] });
        },
        undo: () =>
          set((state) => {
            const previous = state.past.at(-1);
            if (previous === undefined) return state;
            return {
              ...previous,
              future: [progressOf(state), ...state.future],
              past: state.past.slice(0, -1),
            };
          }),
      };
    },
    {
      // A saved run that is not one (another version's, a damaged one) is
      // dropped for a fresh run rather than half restored
      merge: (saved, current) => {
        const parsed = progressSchema.safeParse(saved);
        return parsed.success && withinPools(parsed.data.items)
          ? { ...current, ...completed(parsed.data) }
          : current;
      },
      name: SMZ3_STORAGE_KEY,
      partialize: (state) => progressOf(state),
      storage: createJSONStorage(() => localStorage),
      version: SMZ3_SAVE_VERSION,
    },
  ),
);

/**
 * The file an export writes: the run alone. It takes the store's state as it
 * is, so the run is picked out of it, never the undo history beside it.
 */
export const exportSave = (progress: Smz3Progress): string =>
  `${JSON.stringify(
    {
      format: "alltp-tracker-save",
      game: "smz3",
      progress: progressOf(progress),
      version: SMZ3_SAVE_VERSION,
    },
    null,
    2,
  )}\n`;

const saveSchema = z.object({
  format: z.literal("alltp-tracker-save"),
  game: z.string(),
  progress: z.unknown(),
  version: z.number(),
});

/** Why a file cannot be imported, in words the player can act on. */
export type ImportError =
  | "not-json"
  | "not-a-save"
  | "other-game"
  | "newer-version"
  | "invalid";

/** What each reason says to the player. */
export const IMPORT_ERRORS: Readonly<Record<ImportError, string>> = {
  invalid: "This save's run is not one the tracker can read.",
  "newer-version": "This save comes from a newer version of the tracker.",
  "not-a-save": "This file is not a tracker save.",
  "not-json": "This file is not a tracker save.",
  "other-game":
    "This save is for another game: switch game to import it there.",
};

/**
 * A save file's run, or why not: not JSON, not a tracker save, another
 * game's (each game imports its own), a version this one does not know, or
 * a run that is not one.
 */
export const parseSave = (
  text: string,
): { ok: true; progress: Smz3Progress } | { ok: false; error: ImportError } => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { error: "not-json", ok: false };
  }
  const save = saveSchema.safeParse(json);
  if (!save.success) return { error: "not-a-save", ok: false };
  if (save.data.game !== "smz3") return { error: "other-game", ok: false };
  if (save.data.version > SMZ3_SAVE_VERSION) {
    return { error: "newer-version", ok: false };
  }
  const progress = progressSchema.safeParse(save.data.progress);
  if (!progress.success || !withinPools(progress.data.items)) {
    return { error: "invalid", ok: false };
  }
  return { ok: true, progress: completed(progress.data) };
};
