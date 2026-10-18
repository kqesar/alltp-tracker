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
import {
  DEFAULT_PRESET_ID,
  getPreset,
  type HiddenSetting,
  type RunSettings,
  type TunableSetting,
  wildItems,
} from "@/data/presets";
import {
  COUNTER_INDICES,
  counterMax,
  SMALL_KEYS_MAX,
  smallKeysMax,
} from "@/logic/settings";
import { type Stamp, stampOf, stampTimeline } from "@/logic/timeline";
import {
  finishTimer,
  IDLE_TIMER,
  pauseTimer,
  type RunTimer,
  restoreTimer,
  startTimer,
} from "@/logic/timer";
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
    /**
     * The run's timer: kept apart from the run's history, so undoing a
     * change never moves it and starting it is no undo step.
     */
    timer: RunTimer;
    /** Start the run timer, or go on from its pause, at `at` (now). */
    startTimer: (at?: number) => void;
    /** Pause the run timer at `at` (now). */
    pauseTimer: (at?: number) => void;
    /** Stop the run timer for good, the goal reached, at `at` (now). */
    finishTimer: (at?: number) => void;
    /** Set the run timer back to 0, stopped. */
    resetTimer: () => void;
    setAutoTimer: (on: boolean) => void;

    // Actions
    applyPreset: (presetId: string) => void;
    /**
     * Start a new run of a run type with these settings, as one undo step:
     * the fresh run, then what `lay` sets on it (the game, while
     * autotracking). Key cells follow the run when its dungeon items start
     * or stop leaving their dungeons.
     */
    applyRun: (
      presetId: string,
      settings: RunSettings,
      lay?: (fresh: Progress) => Partial<Progress> | null,
      /**
       * Keep the timer: autotracking switching to the seed's run type as
       * the game starts. A run type the player picks starts it over.
       */
      keepTimer?: boolean,
    ) => void;
    /** Step an item by one: forward on click, back (`-1`) on right-click */
    handleItemClick: (item: string, direction?: Direction) => void;
    handleSmallKeyClick: (dungeonIndex: number, direction?: Direction) => void;
    handleMedallionChange: (bossNumber: number, newValue: number) => void;
    /**
     * Set an item to a value, as one undo step: what a voice command does,
     * which says a find rather than a click. Nothing when it holds it
     * already, or for a value outside the item's range.
     */
    setItem: (item: string, value: boolean | number) => void;
    /** Set a key dungeon's small keys, as one undo step; nothing if equal. */
    setSmallKeys: (dungeonIndex: number, count: number) => void;
    /** Step a dungeon's medallion through unknown, Bombos, Ether, Quake */
    stepMedallion: (dungeonIndex: number, direction?: Direction) => void;
    /**
     * Check locations together, as a map marker stands for them: all of
     * them once any is left, none once all are checked.
     */
    toggleChecks: (locations: readonly string[]) => void;
    /**
     * Note where a shuffled entrance leads, or that it is not known
     * (`null`): one undo step. A target leads from one entrance only, so
     * noting it at one forgets it at another.
     */
    noteEntrance: (entrance: string, target: string | null) => void;
    /**
     * Note several entrances as one step: a hole and its cave's door, which
     * the same cave settles.
     */
    noteEntrances: (notes: Readonly<Record<string, string | null>>) => void;
    /**
     * Change settings in the run going, its progress kept (`retune`): what
     * a Mystery run discovers, and the dungeon items, whose counters keep
     * the items found. A setting changed is no longer hidden. One undo
     * step; none when nothing changes.
     */
    updateSettings: (
      change: Partial<Pick<RunSettings, TunableSetting>>,
    ) => void;
    /** Hide a setting again, as not known yet: one undo step. */
    hideSetting: (setting: HiddenSetting) => void;
    /**
     * Lay settings the game revealed (a seed's, read by autotracking) on
     * the run, its progress kept, as no step: on every snapshot of the
     * history too, like the game's other news.
     */
    revealSettings: (
      change: Partial<Pick<RunSettings, TunableSetting>>,
    ) => void;
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
    COUNTER_INDICES.map((index) => [`chest${index}`, counterMax(index, run)]),
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
  entrances: {},
  items: { ...initialItems, ...fullCounters(settings) } as ItemState,
  medallions: Array(10).fill(0) as number[],
  presetId: getPreset(presetId).id,
  settings,
  // One per key dungeon (KEY_DUNGEONS), none found yet
  smallKeys: Array(SMALL_KEYS_MAX.length).fill(0) as number[],
  timeline: {},
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
    Object.keys(progress.entrances).length === 0 &&
    Object.entries(fresh.items).every(
      ([id, value]) => progress.items[id] === value,
    )
  );
};

/** Display preferences for a first visit. */
const createPrefs = (presetId: string = DEFAULT_PRESET_ID): Prefs => ({
  autoTimer: true,
  bigKeysVisible: wildItems(getPreset(presetId).settings).mapsAndCompasses,
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
    entrances: saved.entrances ?? base.entrances,
    items,
    medallions: saved.medallions ?? base.medallions,
    presetId: saved.presetId ?? base.presetId,
    settings,
    smallKeys: saved.smallKeys ?? base.smallKeys,
    timeline: saved.timeline ?? base.timeline,
  };
};

/** Lay saved display preferences over the current ones. */
const restorePrefs = (base: Prefs, saved: Partial<Prefs>): Prefs => ({
  autoTimer:
    typeof saved.autoTimer === "boolean" ? saved.autoTimer : base.autoTimer,
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
    saved.mapView === "map" ||
    saved.mapView === "checks" ||
    saved.mapView === "entrances" ||
    saved.mapView === "run"
      ? saved.mapView
      : base.mapView,
  shortcuts: restoreShortcuts(saved.shortcuts, base.shortcuts),
});

/** The run alone, as a save file carries it. */
const progressOf = (state: GameState): Progress => ({
  checked: state.checked,
  entrances: state.entrances,
  items: state.items,
  medallions: state.medallions,
  presetId: state.presetId,
  settings: state.settings,
  smallKeys: state.smallKeys,
  timeline: state.timeline,
});

/**
 * `change` laid on `progress`, its finds stamped on the timeline: what a
 * change of the run's own items or checks sets. A change that brings a
 * timeline (a new run, an import) replaces it instead.
 */
const dated = (
  progress: Progress,
  change: Partial<Progress>,
  stamp: Stamp,
): Partial<Progress> =>
  change.timeline !== undefined || (!change.items && !change.checked)
    ? change
    : {
        ...change,
        timeline: stampTimeline(
          progress.timeline,
          progress,
          {
            checked: change.checked ?? progress.checked,
            items: change.items ?? progress.items,
          },
          stamp,
        ),
      };

/**
 * A run with some of its settings changed, its progress kept: a setting
 * changed is no longer hidden, and a change of dungeon items keeps each
 * counter's items found (its top less what it has left), counted again
 * against the new top. Null when nothing changes.
 */
export const retune = (
  progress: Progress,
  change: Partial<Pick<RunSettings, TunableSetting>>,
): { items?: ItemState; settings: RunSettings } | null => {
  const changed = (Object.keys(change) as TunableSetting[]).filter(
    (key) =>
      change[key] !== progress.settings[key] ||
      progress.settings.hidden?.includes(key as HiddenSetting),
  );
  if (changed.length === 0) return null;
  const hidden = progress.settings.hidden?.filter(
    (key) => !changed.includes(key),
  );
  const settings: RunSettings = {
    ...progress.settings,
    ...change,
    ...(hidden === undefined ? {} : { hidden }),
  };
  if (hidden?.length === 0) delete settings.hidden;
  if (settings.dungeonItems === progress.settings.dungeonItems) {
    return { settings };
  }
  const items = { ...progress.items } as Record<string, boolean | number>;
  for (const index of COUNTER_INDICES) {
    const id = `chest${index}`;
    const found =
      counterMax(index, progress.settings) - Number(progress.items[id] ?? 0);
    const max = counterMax(index, settings);
    items[id] = Math.min(max, Math.max(0, max - found));
  }
  return { items: items as ItemState, settings };
};

/**
 * The key cells, following the run when its dungeon items start or stop
 * leaving their dungeons; otherwise the player's own choice stands.
 */
const keyCellsFor = (state: GameState, settings: RunSettings) => ({
  bigKeysVisible:
    wildItems(settings).mapsAndCompasses ===
    wildItems(state.settings).mapsAndCompasses
      ? state.bigKeysVisible
      : wildItems(settings).mapsAndCompasses,
});

/**
 * A progress change that can be undone: remember the run it replaces and drop
 * the redo stack, as any editor does once a new change is made. What it
 * finds is stamped now.
 */
const record = (state: GameState, next: Partial<Progress>) => ({
  ...dated(progressOf(state), next, stampOf(state.timer, Date.now())),
  future: [],
  past: [...state.past, progressOf(state)].slice(-HISTORY_LIMIT),
});

/** Project the store onto what localStorage keeps. */
const toPersisted = (state: GameState): PersistedState => ({
  ...progressOf(state),
  autoTimer: state.autoTimer,
  bigKeysVisible: state.bigKeysVisible,
  game: GAME,
  mapLayout: state.mapLayout,
  mapView: state.mapView,
  shortcuts: state.shortcuts,
  timer: state.timer,
});

export const useGameStore = create<GameState>()(
  devtools(
    persist(
      (set, get) => ({
        ...createProgress(),
        ...createPrefs(),

        applyGameNews: (change) => {
          const state = get();
          // The game's finds are stamped now, on the run and on every step
          // of its history alike
          const stamp = stampOf(state.timer, Date.now());
          const current = progressOf(state);
          const now = change(current);
          let moved = false;
          const rebase = (history: Progress[]) =>
            history.map((progress) => {
              const changed = change(progress);
              if (changed === null) return progress;
              moved = true;
              return { ...progress, ...dated(progress, changed, stamp) };
            });
          const past = rebase(state.past);
          const future = rebase(state.future);
          if (now === null && !moved) return;
          set({
            ...(now === null ? {} : dated(current, now, stamp)),
            ...(moved ? { future, past } : {}),
          });
        },

        applyPreset: (presetId: string) =>
          get().applyRun(presetId, getPreset(presetId).settings),

        applyRun: (presetId, settings, lay, keepTimer = false) =>
          set((state) => {
            const fresh = createProgress(presetId, settings);
            return {
              ...record(state, { ...fresh, ...lay?.(fresh) }),
              ...keyCellsFor(state, settings),
              timer: keepTimer ? state.timer : IDLE_TIMER,
            };
          }),

        exportState: () =>
          JSON.stringify(toSaveFile(progressOf(get())), null, 2),

        finishTimer: (at = Date.now()) =>
          set((state) => ({ timer: finishTimer(state.timer, at) })),
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
          const next = (newSmallKeys[dungeonIndex] ?? 0) + direction;
          newSmallKeys[dungeonIndex] =
            next > maxForDungeon ? 0 : next < 0 ? maxForDungeon : next;

          set(record(state, { smallKeys: newSmallKeys }));
        },

        hideSetting: (setting) =>
          set((state) => {
            if (state.settings.hidden?.includes(setting)) return state;
            const hidden = [...(state.settings.hidden ?? []), setting];
            return record(state, { settings: { ...state.settings, hidden } });
          }),

        loadProgress: (progress: Partial<Progress>) =>
          set((state) => ({
            ...record(state, restoreProgress(createProgress(), progress)),
            timer: IDLE_TIMER,
          })),

        noteEntrance: (entrance: string, target: string | null) =>
          get().noteEntrances({ [entrance]: target }),

        noteEntrances: (notes: Readonly<Record<string, string | null>>) =>
          set((state) => {
            const changes = Object.entries(notes).filter(
              ([entrance, target]) =>
                (state.entrances[entrance] ?? null) !== target,
            );
            if (changes.length === 0) return state;
            // A target leads from one entrance only: noted here, gone there
            const taken = new Set(changes.map(([, target]) => target));
            const entrances = Object.fromEntries(
              Object.entries(state.entrances).filter(
                ([id, to]) => !(id in notes) && !taken.has(to),
              ),
            );
            for (const [entrance, target] of changes) {
              if (target !== null) entrances[entrance] = target;
            }
            // An unchanged note of a call keeps its target
            for (const [entrance, target] of Object.entries(notes)) {
              if (target !== null && entrances[entrance] === undefined)
                entrances[entrance] = target;
            }
            return record(state, { entrances });
          }),
        past: [],
        pauseTimer: (at = Date.now()) =>
          set((state) => ({ timer: pauseTimer(state.timer, at) })),

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
          set((state) => ({
            ...record(state, createProgress(state.presetId, state.settings)),
            timer: IDLE_TIMER,
          })),
        resetTimer: () => set({ timer: IDLE_TIMER }),
        revealSettings: (change) => {
          const settings = retune(progressOf(get()), change)?.settings;
          get().applyGameNews((progress) => retune(progress, change));
          if (settings) set((state) => keyCellsFor(state, settings));
        },
        setAutoTimer: (on: boolean) => set({ autoTimer: on }),

        setBigKeysVisible: (visible: boolean) =>
          set({ bigKeysVisible: visible }),

        setItem: (item: string, value: boolean | number) =>
          set((state) => {
            const current = state.items[item];
            if (current === undefined || current === value) return state;
            if (typeof current !== typeof value) return state;
            if (typeof value === "number") {
              const [min, max] = itemRange(item, state.settings);
              if (value < min || value > max) return state;
            }
            return record(state, { items: { ...state.items, [item]: value } });
          }),

        setKeymap: (keymap: Keymap) =>
          set((state) => ({ shortcuts: { ...state.shortcuts, keymap } })),

        setMapLayout: (layout: MapLayout) => set({ mapLayout: layout }),

        setMapView: (view: MapView) => set({ mapView: view }),

        setShortcutsEnabled: (enabled: boolean) =>
          set((state) => ({ shortcuts: { ...state.shortcuts, enabled } })),
        setSmallKeys: (dungeonIndex: number, count: number) =>
          set((state) => {
            if (state.smallKeys[dungeonIndex] === count) return state;
            if (count < 0 || count > smallKeysMax(dungeonIndex)) return state;
            const smallKeys = [...state.smallKeys];
            smallKeys[dungeonIndex] = count;
            return record(state, { smallKeys });
          }),
        startTimer: (at = Date.now()) =>
          set((state) => ({ timer: startTimer(state.timer, at) })),

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
        timer: IDLE_TIMER,

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

        updateSettings: (change) =>
          set((state) => {
            const next = retune(progressOf(state), change);
            if (next === null) return state;
            return {
              ...record(state, next),
              ...keyCellsFor(state, next.settings),
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
            timer: restoreTimer(saved.timer),
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
