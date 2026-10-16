import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { MEDALLION_VALUES, SMALL_KEYS_MAX_BY_INDEX } from "@/constants";
import { chests } from "@/data/chests";
import { items as initialItems, itemsMax, itemsMin } from "@/data/items";
import type { ItemState } from "@/data/logic";
import { DEFAULT_PRESET_ID, getPreset } from "@/data/presets";
import {
  migrate,
  PERSIST_VERSION,
  type PersistedState,
  type Prefs,
  type Progress,
  toSaveFile,
  validateProgress,
} from "@/stores/persistence";
import type { MapLayout } from "@/utils";

/** Which way a click moves a counter or a progressive item. */
export type Direction = 1 | -1;

type GameState = Progress &
  Prefs & {
    // Actions
    applyPreset: (presetId: string) => void;
    /** Step an item by one: forward on click, back (`-1`) on right-click */
    handleItemClick: (item: string, direction?: Direction) => void;
    handleSmallKeyClick: (dungeonIndex: number, direction?: Direction) => void;
    handleMedallionChange: (bossNumber: number, newValue: number) => void;
    /** Step a dungeon's medallion through unknown, Bombos, Ether, Quake */
    stepMedallion: (dungeonIndex: number, direction?: Direction) => void;
    toggleChest: (chestIndex: number) => void;
    setBigKeysVisible: (visible: boolean) => void;
    setMapLayout: (layout: MapLayout) => void;

    // Persistence helpers
    /** The run as the text of a save file */
    exportState: () => string;
    /** Replace the run with a save already read by `parseSave`; display prefs are kept */
    loadProgress: (progress: Partial<Progress>) => void;

    /** Start a new game with the current preset; display prefs are kept */
    reset: () => void;

    /** Earlier states of the run, most recent last; never persisted */
    past: Progress[];
    /** States undone and not yet redone, next first */
    future: Progress[];
    /** Step the run back to before its last change */
    undo: () => void;
    /** Re-apply the change most recently undone */
    redo: () => void;
  };

/** Undo depth: far more than a run needs, and each step is a few KB. */
const HISTORY_LIMIT = 200;

/** Medallion states: unknown, then Bombos, Ether and Quake. */
const MEDALLION_STATES = MEDALLION_VALUES.QUAKE + 1;

/** A fresh run of the given preset: nothing found, nothing opened. */
const createProgress = (presetId: string = DEFAULT_PRESET_ID): Progress => {
  const preset = getPreset(presetId);
  return {
    chestsOpened: chests.map(() => false),
    items: { ...initialItems } as ItemState,
    medallions: Array(10).fill(0) as number[],
    presetId: preset.id,
    settings: preset.settings,
    smallKeys: Array(10).fill(0) as number[], // 10 dungeons, all start at 0
  };
};

/** Display preferences for a first visit. */
const createPrefs = (presetId: string = DEFAULT_PRESET_ID): Prefs => ({
  bigKeysVisible: getPreset(presetId).settings.keysanity,
  mapLayout: "auto",
});

/** Lay saved progress over fresh progress; a missing field keeps its fresh value. */
const restoreProgress = (
  base: Progress,
  saved: Partial<Progress>,
): Progress => ({
  chestsOpened: base.chestsOpened.map(
    (opened, index) => saved.chestsOpened?.[index] ?? opened,
  ),
  items: saved.items
    ? ({ ...base.items, ...saved.items } as ItemState)
    : base.items,
  medallions: saved.medallions ?? base.medallions,
  presetId: saved.presetId ?? base.presetId,
  settings: saved.settings ?? base.settings,
  smallKeys: saved.smallKeys ?? base.smallKeys,
});

/** Lay saved display preferences over the current ones. */
const restorePrefs = (base: Prefs, saved: Partial<Prefs>): Prefs => ({
  bigKeysVisible:
    typeof saved.bigKeysVisible === "boolean"
      ? saved.bigKeysVisible
      : base.bigKeysVisible,
  mapLayout:
    saved.mapLayout === "auto" ||
    saved.mapLayout === "side-by-side" ||
    saved.mapLayout === "stacked"
      ? saved.mapLayout
      : base.mapLayout,
});

/** The run alone, as a save file carries it. */
const progressOf = (state: GameState): Progress => ({
  chestsOpened: state.chestsOpened,
  items: state.items,
  medallions: state.medallions,
  presetId: state.presetId,
  settings: state.settings,
  smallKeys: state.smallKeys,
});

/**
 * A progress change that can be undone: remember the run it replaces and drop
 * the redo stack, as any editor does once a new change is made.
 */
const record = (state: GameState, next: Partial<Progress>) => ({
  ...next,
  future: [],
  past: [...state.past, progressOf(state)].slice(-HISTORY_LIMIT),
});

/** Project the store onto what localStorage keeps. */
const toPersisted = (state: GameState): PersistedState => ({
  ...progressOf(state),
  bigKeysVisible: state.bigKeysVisible,
  mapLayout: state.mapLayout,
});

export const useGameStore = create<GameState>()(
  devtools(
    persist(
      (set, get) => ({
        ...createProgress(),
        ...createPrefs(),

        applyPreset: (presetId: string) =>
          set((state) => {
            const progress = createProgress(presetId);
            return {
              ...record(state, progress),
              // Key cells follow the run type when it turns keysanity on or
              // off; otherwise the player's own choice stands.
              bigKeysVisible:
                progress.settings.keysanity === state.settings.keysanity
                  ? state.bigKeysVisible
                  : progress.settings.keysanity,
            };
          }),

        exportState: () =>
          JSON.stringify(toSaveFile(progressOf(get())), null, 2),
        future: [],

        handleItemClick: (item: string, direction: Direction = 1) => {
          if (!item || item === "blank") return;

          set((state) => {
            const current = state.items[item];
            if (typeof current === "boolean") {
              return record(state, {
                items: { ...state.items, [item]: !current },
              });
            }

            // Chest counters count down as chests are emptied; everything
            // else counts up. Both wrap round to the far end of their range.
            const step = (item.startsWith("chest") ? -1 : 1) * direction;
            const min = itemsMin[item];
            const max = itemsMax[item];
            const next = current + step;
            return record(state, {
              items: {
                ...state.items,
                [item]: next < min ? max : next > max ? min : next,
              },
            });
          });
        },

        handleMedallionChange: (bossNumber: number, newValue: number) => {
          const state = get();
          const newMedallions = [...state.medallions];
          newMedallions[bossNumber] = newValue;
          set(record(state, { medallions: newMedallions }));
        },

        handleSmallKeyClick: (
          dungeonIndex: number,
          direction: Direction = 1,
        ) => {
          const state = get();
          const newSmallKeys = [...state.smallKeys];

          // Maximum small keys per dungeon, indexed 0-9
          const maxForDungeon = SMALL_KEYS_MAX_BY_INDEX[dungeonIndex] ?? 0;

          // Step the count, wrapping between 0 and the dungeon's maximum
          const next = newSmallKeys[dungeonIndex] + direction;
          newSmallKeys[dungeonIndex] =
            next > maxForDungeon ? 0 : next < 0 ? maxForDungeon : next;

          set(record(state, { smallKeys: newSmallKeys }));
        },

        loadProgress: (progress: Partial<Progress>) =>
          set((state) =>
            record(state, restoreProgress(createProgress(), progress)),
          ),
        past: [],

        redo: () =>
          set((state) => {
            const [next, ...later] = state.future;
            if (!next) return state;
            return {
              ...next,
              future: later,
              past: [...state.past, progressOf(state)],
            };
          }),

        reset: () =>
          set((state) => record(state, createProgress(state.presetId))),

        setBigKeysVisible: (visible: boolean) =>
          set({ bigKeysVisible: visible }),

        setMapLayout: (layout: MapLayout) => set({ mapLayout: layout }),

        stepMedallion: (dungeonIndex: number, direction: Direction = 1) => {
          // Modulo keeps a malformed stored value inside the four states
          const current = get().medallions[dungeonIndex] % MEDALLION_STATES;
          get().handleMedallionChange(
            dungeonIndex,
            (current + direction + MEDALLION_STATES) % MEDALLION_STATES,
          );
        },

        toggleChest: (chestIndex: number) =>
          set((state) =>
            record(state, {
              chestsOpened: state.chestsOpened.map((opened, index) =>
                index === chestIndex ? !opened : opened,
              ),
            }),
          ),

        undo: () =>
          set((state) => {
            const previous = state.past.at(-1);
            if (!previous) return state;
            return {
              ...previous,
              future: [progressOf(state), ...state.future],
              past: state.past.slice(0, -1),
            };
          }),
      }),
      {
        merge: (persisted, current) => {
          const saved = (persisted ?? {}) as Record<string, unknown>;
          // Lenient: a field that fails validation keeps its fresh value
          // instead of discarding the whole save.
          return {
            ...current,
            ...restoreProgress(current, validateProgress(saved).value),
            ...restorePrefs(current, saved as Partial<Prefs>),
            // The run was replaced from outside (first load, another tab):
            // undoing would now rewind someone else's changes.
            future: [],
            past: [],
          };
        },
        migrate: (persisted, version) =>
          migrate(persisted, version) as PersistedState,
        name: "alltp-tracker-state",
        // Only persist progress and prefs; the history is transient.
        partialize: (state) => toPersisted(state),
        version: PERSIST_VERSION,
      },
    ),
    {
      // Devtools only in development: no store snapshot in production builds
      enabled: import.meta.env.DEV,
      name: "game-storage",
    },
  ),
);
