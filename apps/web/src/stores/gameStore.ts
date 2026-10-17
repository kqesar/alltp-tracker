import { LEGACY_DUNGEONS } from "@alltp/pack-alttpr";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { MEDALLION_VALUES } from "@/constants";
import type { ItemState } from "@/data/items";
import { items as initialItems } from "@/data/items";
import {
  DEFAULT_SHORTCUTS,
  type Keymap,
  restoreShortcuts,
} from "@/data/keymap";
import { DEFAULT_PRESET_ID, getPreset, type RunSettings } from "@/data/presets";
import { counterMax, smallKeysMax } from "@/logic/settings";
import {
  GAME,
  itemRange,
  migrate,
  PERSIST_VERSION,
  type PersistedState,
  type Prefs,
  type Progress,
  toSaveFile,
  validateProgress,
} from "@/stores/persistence";
import type { MapLayout, MapView } from "@/utils";

/** Which way a click moves a counter or a progressive item. */
export type Direction = 1 | -1;

type GameState = Progress &
  Prefs & {
    // Actions
    applyPreset: (presetId: string) => void;
    /**
     * Start a new run of a run type with these settings, as one undo step:
     * the fresh run, then what `lay` sets on it (the game, while
     * autotracking). Key cells follow the run when its keysanity changes.
     */
    applyRun: (
      presetId: string,
      settings: RunSettings,
      lay?: (fresh: Progress) => Partial<Progress> | null,
    ) => void;
    /** Step an item by one: forward on click, back (`-1`) on right-click */
    handleItemClick: (item: string, direction?: Direction) => void;
    handleSmallKeyClick: (dungeonIndex: number, direction?: Direction) => void;
    handleMedallionChange: (bossNumber: number, newValue: number) => void;
    /** Step a dungeon's medallion through unknown, Bombos, Ether, Quake */
    stepMedallion: (dungeonIndex: number, direction?: Direction) => void;
    /**
     * Check locations together, as a map marker stands for them: all of
     * them once any is left, none once all are checked.
     */
    toggleChecks: (locations: readonly string[]) => void;
    setBigKeysVisible: (visible: boolean) => void;
    setMapLayout: (layout: MapLayout) => void;
    setMapView: (view: MapView) => void;
    /** The keyboard shortcuts' master switch */
    setShortcutsEnabled: (enabled: boolean) => void;
    setKeymap: (keymap: Keymap) => void;

    // Persistence helpers
    /** The run as the text of a save file */
    exportState: () => string;
    /** Replace the run with a save already read by `parseSave`; display prefs are kept */
    loadProgress: (progress: Partial<Progress>) => void;

    /** Start a new game of the same run type and settings; display prefs are kept */
    reset: () => void;

    /** Earlier states of the run, most recent last; never persisted */
    past: Progress[];
    /** States undone and not yet redone, next first */
    future: Progress[];
    /** Step the run back to before its last change */
    undo: () => void;
    /** Re-apply the change most recently undone */
    redo: () => void;

    /**
     * Lay what the game says on the run, outside the history: no undo
     * step, and every step of the history gets it too, so undoing a change
     * of the player's never undoes the game's. Nothing is set, and nothing
     * re-renders, when it changes nothing.
     * @param change - The slices it changes in a run, or null for none
     */
    applyGameNews: (
      change: (progress: Progress) => Partial<Progress> | null,
    ) => void;
    /** Set the run to what the game holds: one undo step, as the player's. */
    syncWithGame: (next: Partial<Progress>) => void;
  };

/** Undo depth: far more than a run needs, and each step is a few KB. */
const HISTORY_LIMIT = 200;

/** Medallion states: unknown, then Bombos, Ether and Quake. */
const MEDALLION_STATES = MEDALLION_VALUES.QUAKE + 1;

/** Every dungeon counter full, for a run of these settings. */
const fullCounters = (run: RunSettings): Record<string, number> =>
  Object.fromEntries(
    LEGACY_DUNGEONS.map((_, index) => [
      `chest${index}`,
      counterMax(index, run),
    ]),
  );

/**
 * A fresh run of the given preset, under its settings or others: nothing
 * found, nothing checked.
 */
export const createProgress = (
  presetId: string = DEFAULT_PRESET_ID,
  settings: RunSettings = getPreset(presetId).settings,
): Progress => ({
  checked: {},
  items: { ...initialItems, ...fullCounters(settings) } as ItemState,
  medallions: Array(10).fill(0) as number[],
  presetId: getPreset(presetId).id,
  settings,
  smallKeys: Array(10).fill(0) as number[], // 10 dungeons, all start at 0
});

/**
 * Whether a run is as it started: nothing found, nothing checked, nothing
 * noted. Switching its run type then loses nothing.
 */
export const isFreshRun = (progress: Progress): boolean => {
  const fresh = createProgress(progress.presetId, progress.settings);
  return (
    Object.keys(progress.checked).length === 0 &&
    progress.medallions.every((value) => value === 0) &&
    progress.smallKeys.every((value) => value === 0) &&
    Object.entries(fresh.items).every(
      ([id, value]) => progress.items[id] === value,
    )
  );
};

/** Display preferences for a first visit. */
const createPrefs = (presetId: string = DEFAULT_PRESET_ID): Prefs => ({
  bigKeysVisible: getPreset(presetId).settings.keysanity,
  mapLayout: "auto",
  mapView: "map",
  shortcuts: DEFAULT_SHORTCUTS,
});

/**
 * Lay saved progress over fresh progress; a missing field keeps its fresh
 * value. A dungeon counter the save lacks starts full for the run's
 * settings, which may not be the fresh run's.
 */
const restoreProgress = (
  base: Progress,
  saved: Partial<Progress>,
): Progress => {
  const settings = saved.settings ?? base.settings;
  const items =
    saved.items || settings !== base.settings
      ? ({
          ...base.items,
          ...(settings === base.settings ? {} : fullCounters(settings)),
          ...saved.items,
        } as ItemState)
      : base.items;
  return {
    checked: saved.checked ?? base.checked,
    items,
    medallions: saved.medallions ?? base.medallions,
    presetId: saved.presetId ?? base.presetId,
    settings,
    smallKeys: saved.smallKeys ?? base.smallKeys,
  };
};

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
  mapView:
    saved.mapView === "map" || saved.mapView === "checks"
      ? saved.mapView
      : base.mapView,
  shortcuts: restoreShortcuts(saved.shortcuts, base.shortcuts),
});

/** The run alone, as a save file carries it. */
const progressOf = (state: GameState): Progress => ({
  checked: state.checked,
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
  game: GAME,
  mapLayout: state.mapLayout,
  mapView: state.mapView,
  shortcuts: state.shortcuts,
});

export const useGameStore = create<GameState>()(
  devtools(
    persist(
      (set, get) => ({
        ...createProgress(),
        ...createPrefs(),

        applyGameNews: (change) => {
          const state = get();
          const now = change(progressOf(state));
          let moved = false;
          const rebase = (history: Progress[]) =>
            history.map((progress) => {
              const changed = change(progress);
              if (changed === null) return progress;
              moved = true;
              return { ...progress, ...changed };
            });
          const past = rebase(state.past);
          const future = rebase(state.future);
          if (now === null && !moved) return;
          set({ ...now, ...(moved ? { future, past } : {}) });
        },

        applyPreset: (presetId: string) =>
          get().applyRun(presetId, getPreset(presetId).settings),

        applyRun: (presetId, settings, lay) =>
          set((state) => {
            const fresh = createProgress(presetId, settings);
            return {
              ...record(state, { ...fresh, ...lay?.(fresh) }),
              // Key cells follow the run type when it turns keysanity on or
              // off; otherwise the player's own choice stands.
              bigKeysVisible:
                settings.keysanity === state.settings.keysanity
                  ? state.bigKeysVisible
                  : settings.keysanity,
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
            const [min, max] = itemRange(item, state.settings);
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
          // A dungeon without small keys (Eastern Palace) has nothing to step
          const maxForDungeon = smallKeysMax(dungeonIndex);
          if (maxForDungeon === 0) return;
          const newSmallKeys = [...state.smallKeys];

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
          set((state) =>
            record(state, createProgress(state.presetId, state.settings)),
          ),

        setBigKeysVisible: (visible: boolean) =>
          set({ bigKeysVisible: visible }),

        setKeymap: (keymap: Keymap) =>
          set((state) => ({ shortcuts: { ...state.shortcuts, keymap } })),

        setMapLayout: (layout: MapLayout) => set({ mapLayout: layout }),

        setMapView: (view: MapView) => set({ mapView: view }),

        setShortcutsEnabled: (enabled: boolean) =>
          set((state) => ({ shortcuts: { ...state.shortcuts, enabled } })),

        stepMedallion: (dungeonIndex: number, direction: Direction = 1) => {
          // Modulo keeps a malformed stored value inside the four states
          const current = get().medallions[dungeonIndex] % MEDALLION_STATES;
          get().handleMedallionChange(
            dungeonIndex,
            (current + direction + MEDALLION_STATES) % MEDALLION_STATES,
          );
        },

        syncWithGame: (next: Partial<Progress>) =>
          set((state) => record(state, next)),

        toggleChecks: (locations: readonly string[]) =>
          set((state) => {
            if (locations.length === 0) return state;
            const done = locations.every((id) => state.checked[id]);
            const checked = { ...state.checked };
            for (const id of locations) {
              if (done) delete checked[id];
              else checked[id] = true;
            }
            return record(state, { checked });
          }),

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
            ...restoreProgress(
              current,
              validateProgress(saved, current.settings).value,
            ),
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
