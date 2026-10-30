import { GANONHUNT } from "@alltp/pack-alttpr";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { boardRestored, runReplaced } from "@/autotrack/raceMode";
import { requestResync } from "@/autotrack/resync";
import { MEDALLION_VALUES } from "@/games/alttpr/constants";
import {
  DOOR_OPTIONS,
  type DoorRunSettings,
  type DoorSetting,
} from "@/games/alttpr/data/doorRando";
import type { Hearts, ItemState } from "@/games/alttpr/data/items";
import {
  bottleAfter,
  bottleSlotOf,
  CAPACITIES,
  capacityAfter,
  heartsAfter,
  heartsOf,
  items as initialItems,
  itemsMax,
  PIECES_ITEM,
  TOGGLE_ITEMS,
  withBottleCount,
} from "@/games/alttpr/data/items";
import {
  DEFAULT_SHORTCUTS,
  type Keymap,
  restoreShortcuts,
} from "@/games/alttpr/data/keymap";
import {
  DEFAULT_PRESET_ID,
  getPreset,
  type HiddenSetting,
  type RunSettings,
  type SettingsChange,
  type TunableSetting,
  tunedOf,
  wildItems,
} from "@/games/alttpr/data/presets";
import {
  DEFAULT_TRICKS,
  restoreTricks,
  type TrickPrefs,
} from "@/games/alttpr/data/tricks";
import {
  type DoorNotesChange,
  withDoorNotes,
} from "@/games/alttpr/logic/doorNotes";
import {
  knownBossIndex,
  knownBossValues,
  stepKnownBoss,
} from "@/games/alttpr/logic/knownBosses";
import {
  type OverworldNotesChange,
  withOverworldNotes,
} from "@/games/alttpr/logic/overworldNotes";
import { withoutEscape } from "@/games/alttpr/logic/packItems";
import {
  COUNTER_INDICES,
  counterMax,
  SMALL_KEYS_MAX,
  smallKeysMax,
} from "@/games/alttpr/logic/settings";
import { stampTimeline } from "@/games/alttpr/logic/timeline";
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
} from "@/games/alttpr/stores/persistence";
import type { MapLayout, MapView } from "@/games/alttpr/utils";
import { HISTORY_LIMIT } from "@/games/runHistory";
import { type Stamp, stampOf } from "@/games/stamp";
import {
  alignTimer,
  finishTimer,
  type GameClock,
  IDLE_TIMER,
  pauseTimer,
  type RunTimer,
  restoreTimer,
  startTimer,
  type TimerClock,
} from "@/utils/runTimer";

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
    setTimerClock: (clock: TimerClock) => void;
    /**
     * Set the run timer on the game's clock as read at `at`; the timer is
     * left as it is, same object, when it is already there.
     */
    alignTimer: (clock: GameClock, at: number) => void;

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
    /**
     * Set Link's hearts and the quarters toward the next one together, as
     * one undo step (a voice command's find); nothing when unchanged.
     */
    setHearts: (hearts: Hearts) => void;
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
     * Note a Door Randomizer run's doors (`DoorNotes`): each entry of the
     * change set, or forgotten (`null`), as one undo step (none when nothing
     * changes). Its pieces come whole from `logic/doorNotes.ts`, which
     * keeps a coupled door's way back with it.
     */
    noteDoors: (change: DoorNotesChange) => void;
    /**
     * Note an Overworld Randomizer run's shuffled overworld
     * (`OverworldNotes`): whirlpools set or forgotten, each with its way
     * back, or the flute's spots, as one undo step (none when nothing
     * changes; `logic/overworldNotes.ts`).
     */
    noteOverworld: (change: OverworldNotesChange) => void;
    /**
     * Change settings in the run going, its progress kept (`retune`): what
     * a Mystery run discovers, and the dungeon items, whose counters keep
     * the items found. A setting changed is no longer hidden. One undo
     * step; none when nothing changes.
     */
    updateSettings: (change: SettingsChange) => void;
    /**
     * Change a Door Randomizer run's own settings in the run going, as
     * `updateSettings` does: the counters keep their items found as the
     * locations the settings make come and go. One undo step, its
     * entrance shuffle too (DR's own or alttpr.com's, `doorEntranceChange`).
     */
    updateDoorSettings: (
      change: Partial<DoorRunSettings> &
        Pick<SettingsChange, "entranceShuffle">,
    ) => void;
    /** Hide a setting again, as not known yet: one undo step. */
    hideSetting: (setting: HiddenSetting) => void;
    /**
     * Lay settings the game revealed (a seed's, read by autotracking) on
     * the run, its progress kept, as no step: on every snapshot of the
     * history too, like the game's other news.
     */
    revealSettings: (change: SettingsChange) => void;
    setBigKeysVisible: (visible: boolean) => void;
    setMapLayout: (layout: MapLayout) => void;
    setMapView: (view: MapView) => void;
    /** The keyboard shortcuts' master switch */
    setShortcutsEnabled: (enabled: boolean) => void;
    setKeymap: (keymap: Keymap) => void;
    /** The tricks the map marks checks for: a preference, no undo step */
    setTricks: (tricks: TrickPrefs) => void;

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

/** Medallion states: unknown, then Bombos, Ether and Quake. */
const MEDALLION_STATES = MEDALLION_VALUES.QUAKE + 1;

/** Every dungeon counter full, for a run of these settings. */
const fullCounters = (run: RunSettings): Record<string, number> =>
  Object.fromEntries(
    COUNTER_INDICES.map((index) => [`chest${index}`, counterMax(index, run)]),
  );

/**
 * Where entrances lead once `notes` are noted (a target, or null to forget
 * one), or null when they change nothing. A target leads from one entrance
 * only: noted at one, it is forgotten at another. The player's notes and
 * the game's go through it alike.
 */
export const withNotes = (
  entrances: Readonly<Record<string, string>>,
  notes: Readonly<Record<string, string | null>>,
): Record<string, string> | null => {
  const changes = Object.entries(notes).filter(
    ([entrance, target]) => (entrances[entrance] ?? null) !== target,
  );
  if (changes.length === 0) return null;
  const taken = new Set(changes.map(([, target]) => target));
  const next = Object.fromEntries(
    Object.entries(entrances).filter(
      ([id, to]) => !(id in notes) && !taken.has(to),
    ),
  );
  for (const [entrance, target] of changes) {
    if (target !== null) next[entrance] = target;
  }
  // An unchanged note of a call keeps its target
  for (const [entrance, target] of Object.entries(notes)) {
    if (target !== null && next[entrance] === undefined)
      next[entrance] = target;
  }
  return next;
};

/**
 * A fresh run of the given preset, under its settings or others: nothing
 * found, nothing checked.
 */
export const createProgress = (
  presetId: string = DEFAULT_PRESET_ID,
  settings: RunSettings = getPreset(presetId).settings,
): Progress => ({
  checked: {},
  doors: {},
  entrances: {},
  items: {
    ...initialItems,
    ...fullCounters(settings),
    // A ganonhunt asks for its own count of pieces (the pack's GANONHUNT)
    ...(settings.goal === "ganonhunt"
      ? { goalpieces: GANONHUNT.required }
      : {}),
  } as ItemState,
  medallions: Array(10).fill(0) as number[],
  overworld: {},
  presetId: getPreset(presetId).id,
  seed: null,
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
    Object.values(progress.doors).every(
      (notes) => Object.keys(notes ?? {}).length === 0,
    ) &&
    Object.keys(progress.overworld).length === 0 &&
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
  timerClock: "real",
  tricks: DEFAULT_TRICKS,
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
    doors: saved.doors ?? base.doors,
    entrances: saved.entrances ?? base.entrances,
    items,
    medallions: saved.medallions ?? base.medallions,
    overworld: saved.overworld ?? base.overworld,
    presetId: saved.presetId ?? base.presetId,
    seed: saved.seed === undefined ? base.seed : saved.seed,
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
    saved.mapView === "doors" ||
    saved.mapView === "overworld" ||
    saved.mapView === "run"
      ? saved.mapView
      : base.mapView,
  shortcuts: restoreShortcuts(saved.shortcuts, base.shortcuts),
  timerClock:
    saved.timerClock === "game" || saved.timerClock === "real"
      ? saved.timerClock
      : base.timerClock,
  tricks: restoreTricks(saved.tricks, base.tricks),
});

/** The run alone, as a save file carries it. */
const progressOf = (state: GameState): Progress => ({
  checked: state.checked,
  doors: state.doors,
  entrances: state.entrances,
  items: state.items,
  medallions: state.medallions,
  overworld: state.overworld,
  presetId: state.presetId,
  seed: state.seed,
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
  change: SettingsChange & Partial<Pick<RunSettings, DoorSetting>>,
): { items?: ItemState; settings: RunSettings } | null => {
  const changed = (
    Object.keys(change) as (TunableSetting | DoorSetting)[]
  ).filter(
    (key) =>
      change[key] !==
        (Object.hasOwn(DOOR_OPTIONS, key)
          ? progress.settings[key as DoorSetting]
          : tunedOf(progress.settings, key as TunableSetting)) ||
      progress.settings.hidden?.includes(key as HiddenSetting),
  );
  if (changed.length === 0) return null;
  const hidden = progress.settings.hidden?.filter(
    (key) => !changed.includes(key),
  );
  const { bossShuffle, enemyHealth, glitches, playGlitches, swords, ...rest } =
    change;
  const settings: RunSettings = {
    ...progress.settings,
    ...rest,
    ...(hidden === undefined ? {} : { hidden }),
  };
  if (hidden?.length === 0) delete settings.hidden;
  // A setting set back to unset (a DR run's `DOOR_UNSET`) is its absence
  for (const [key, value] of Object.entries(rest))
    if (value === undefined) delete settings[key as keyof RunSettings];
  // None is said by the glitches' absence, as every preset says it
  if (glitches === "none") delete settings.glitches;
  else if (glitches !== undefined) settings.glitches = glitches;
  if (playGlitches === "none") delete settings.playGlitches;
  else if (playGlitches !== undefined) settings.playGlitches = playGlitches;
  // Only a No Logic run is played with glitches of the player's choice
  if (settings.glitches !== "no_logic") delete settings.playGlitches;
  // As in every preset, no boss shuffle is its absence
  if (bossShuffle === "none") delete settings.bossShuffle;
  else if (bossShuffle !== undefined) settings.bossShuffle = bossShuffle;
  // Randomized swords and default health are said by their absence
  if (swords === "randomized") delete settings.swords;
  else if (swords !== undefined) settings.swords = swords;
  if (enemyHealth === "default") delete settings.enemyHealth;
  else if (enemyHealth !== undefined) settings.enemyHealth = enemyHealth;
  // A swordless run's swords are nowhere
  if (settings.swordless) delete settings.swords;
  // Each counter keeps its items found when its top moves: dungeon items
  // let out or kept, a Door Randomizer run's locations added or taken away
  if (
    COUNTER_INDICES.every(
      (index) =>
        counterMax(index, settings) === counterMax(index, progress.settings),
    )
  ) {
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

/**
 * The run with Link's hearts and quarters set to `next`, as one undo step,
 * or the same state when they do not change.
 */
const withHearts = (state: GameState, next: Hearts) => {
  const now = heartsOf(state.items);
  if (now.hearts === next.hearts && now.quarters === next.quarters) {
    return state;
  }
  return record(state, {
    items: {
      ...state.items,
      heartquarters: next.quarters,
      hearts: next.hearts,
    },
  });
};

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
  timerClock: state.timerClock,
  tricks: state.tricks,
});

export const useGameStore = create<GameState>()(
  devtools(
    persist(
      (set, get) => ({
        ...createProgress(),
        ...createPrefs(),

        alignTimer: (clock, at) =>
          set((state) => {
            const timer = alignTimer(state.timer, clock, at);
            return timer === state.timer ? state : { timer };
          }),

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

        applyRun: (presetId, settings, lay, keepTimer = false) => {
          set((state) => {
            const fresh = createProgress(presetId, settings);
            return {
              ...record(state, { ...fresh, ...lay?.(fresh) }),
              ...keyCellsFor(state, settings),
              timer: keepTimer ? state.timer : IDLE_TIMER,
            };
          });
          requestResync("alttpr");
        },

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
            // A toggle counting levels (the half magic): held, or not, a
            // quarter magic that autotracking read turned off as the half
            if (TOGGLE_ITEMS.has(item)) {
              return record(state, {
                items: { ...state.items, [item]: current > 0 ? 0 : 1 },
              });
            }

            // A dungeon's known boss steps through the bosses its slot can
            // hold, round from not known (logic/knownBosses.ts)
            const known = knownBossIndex(item);
            if (known !== null) {
              return record(state, {
                items: {
                  ...state.items,
                  [item]: stepKnownBoss(
                    known,
                    current,
                    state.settings,
                    direction,
                  ),
                },
              });
            }

            // Link's hearts step a quarter, the fourth making a heart, and
            // stop at not set and at 20 (heartsAfter)
            if (item === "hearts") {
              const change = direction > 0 ? "forward" : "back";
              return withHearts(
                state,
                heartsAfter(heartsOf(state.items), change),
              );
            }

            // The triforce pieces found stop at none and at the most a goal
            // holds: a stray right-click from none would say them all found
            if (item === PIECES_ITEM) {
              const next = Math.max(
                0,
                Math.min(itemsMax[item], current + direction),
              );
              if (next === current) return state;
              return record(state, { items: { ...state.items, [item]: next } });
            }

            // A bottle's cell steps what it holds, and finds or loses the
            // bottles in the game's order (bottleAfter)
            const slot = bottleSlotOf(item);
            if (slot !== null) {
              const change = bottleAfter(state.items, slot, direction);
              if (change === null) return state;
              return record(state, { items: { ...state.items, ...change } });
            }

            // A capacity steps 5 at a time between the start and the most a
            // seed gives (capacityAfter)
            if (Object.hasOwn(CAPACITIES, item)) {
              return record(state, {
                items: {
                  ...state.items,
                  [item]: capacityAfter(item, current, direction),
                },
              });
            }

            // Chest counters count down as chests are emptied; everything
            // else counts up. Both wrap round to the far end of their range.
            const step = (item.startsWith("chest") ? -1 : 1) * direction;
            const [min, max] = itemRange(item, state.settings);
            const raw = current + step;
            const next = raw < min ? max : raw > max ? min : raw;
            return record(state, {
              items: {
                ...state.items,
                ...(item === "bottle"
                  ? withBottleCount(state.items, next)
                  : { [item]: next }),
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
          const maxForDungeon = smallKeysMax(dungeonIndex, state.settings);
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

        loadProgress: (progress: Partial<Progress>) => {
          const loaded = restoreProgress(createProgress(), progress);
          set((state) => ({
            // The escape a file or a link says is another session's reading:
            // never this run's until autotracking reads it again
            ...record(state, {
              ...loaded,
              items: withoutEscape(loaded.items),
            }),
            timer: IDLE_TIMER,
          }));
          runReplaced("alttpr", get().past);
          requestResync("alttpr");
        },
        noteDoors: (change: DoorNotesChange) =>
          set((state) => {
            const doors = withDoorNotes(state.doors, change);
            return doors === state.doors ? state : record(state, { doors });
          }),

        noteEntrance: (entrance: string, target: string | null) =>
          get().noteEntrances({ [entrance]: target }),

        noteEntrances: (notes: Readonly<Record<string, string | null>>) =>
          set((state) => {
            const entrances = withNotes(state.entrances, notes);
            return entrances === null ? state : record(state, { entrances });
          }),
        noteOverworld: (change: OverworldNotesChange) =>
          set((state) => {
            const overworld = withOverworldNotes(state.overworld, change);
            return overworld === state.overworld
              ? state
              : record(state, { overworld });
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

        reset: () => {
          set((state) => ({
            ...record(state, createProgress(state.presetId, state.settings)),
            timer: IDLE_TIMER,
          }));
          runReplaced("alttpr", get().past);
          requestResync("alttpr");
        },
        resetTimer: () => set({ timer: IDLE_TIMER }),
        revealSettings: (change) => {
          const settings = retune(progressOf(get()), change)?.settings;
          get().applyGameNews((progress) => retune(progress, change));
          if (settings) set((state) => keyCellsFor(state, settings));
        },
        setAutoTimer: (on: boolean) => set({ autoTimer: on }),

        setBigKeysVisible: (visible: boolean) =>
          set({ bigKeysVisible: visible }),

        setHearts: (hearts: Hearts) =>
          set((state) => withHearts(state, hearts)),
        setItem: (item: string, value: boolean | number) =>
          set((state) => {
            const current = state.items[item];
            if (current === undefined || current === value) return state;
            if (typeof current !== typeof value) return state;
            if (typeof value === "number") {
              const [min, max] = itemRange(item, state.settings);
              if (value < min || value > max) return state;
              // A boss its dungeon cannot hold (a voice command misheard)
              const known = knownBossIndex(item);
              if (
                known !== null &&
                !knownBossValues(known, state.settings).includes(value)
              ) {
                return state;
              }
            }
            // The bottles' count keeps their contents within it
            const change =
              item === "bottle" && typeof value === "number"
                ? withBottleCount(state.items, value)
                : { [item]: value };
            return record(state, { items: { ...state.items, ...change } });
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
            if (count < 0 || count > smallKeysMax(dungeonIndex, state.settings))
              return state;
            const smallKeys = [...state.smallKeys];
            smallKeys[dungeonIndex] = count;
            return record(state, { smallKeys });
          }),
        setTimerClock: (timerClock: TimerClock) => set({ timerClock }),
        setTricks: (tricks: TrickPrefs) => set({ tricks }),
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

        undo: () => {
          const previous = get().past.at(-1);
          if (!previous) return;
          set((state) => ({
            ...previous,
            future: [progressOf(state), ...state.future],
            past: state.past.slice(0, -1),
          }));
          boardRestored("alttpr", previous);
        },

        updateDoorSettings: (change) =>
          set((state) => {
            const next = retune(progressOf(state), change);
            return next === null ? state : record(state, next);
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
