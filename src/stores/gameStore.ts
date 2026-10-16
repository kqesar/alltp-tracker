import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { DUNGEON_INDICES, SMALL_KEYS_MAX_BY_INDEX } from "@/constants";
import { chests } from "@/data/chests";
import { dungeons } from "@/data/dungeons";
import { items as initialItems, itemsMax, itemsMin } from "@/data/items";
import { buildDungeonCaption, type ItemState } from "@/data/logic";
import { DEFAULT_PRESET_ID, getPreset } from "@/data/presets";
import {
  migrate,
  PERSIST_VERSION,
  type PersistedState,
  type Prefs,
  type Progress,
} from "@/stores/persistence";
import type { MapLayout } from "@/utils";

type GameState = Progress &
  Prefs & {
    /** What the pointer rests on; transient, never saved */
    caption: string;

    // Actions
    applyPreset: (presetId: string) => void;
    setCaption: (caption: string) => void;
    handleItemClick: (item: string) => void;
    handleSmallKeyClick: (dungeonIndex: number) => void;
    handleMedallionChange: (bossNumber: number, newValue: number) => void;
    toggleChest: (chestIndex: number) => void;
    setBigKeysVisible: (visible: boolean) => void;
    setMapLayout: (layout: MapLayout) => void;

    // Persistence helpers
    exportState: () => string;
    importState: (json: string) => boolean;

    /** Start a new game with the current preset; display prefs are kept */
    reset: () => void;
  };

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
  mapLayout: "side-by-side",
});

/** Lay saved progress over fresh progress; a missing field keeps its fresh value. */
const restoreProgress = (
  base: Progress,
  saved: Partial<PersistedState>,
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
const restorePrefs = (base: Prefs, saved: Partial<PersistedState>): Prefs => ({
  bigKeysVisible:
    typeof saved.bigKeysVisible === "boolean"
      ? saved.bigKeysVisible
      : base.bigKeysVisible,
  mapLayout: saved.mapLayout ?? base.mapLayout,
});

/** Project the store onto its serializable form. */
const toPersisted = (state: GameState): PersistedState => ({
  bigKeysVisible: state.bigKeysVisible,
  chestsOpened: state.chestsOpened,
  items: state.items,
  mapLayout: state.mapLayout,
  medallions: state.medallions,
  presetId: state.presetId,
  settings: state.settings,
  smallKeys: state.smallKeys,
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
              ...progress,
              // Key cells follow the run type when it turns keysanity on or
              // off; otherwise the player's own choice stands.
              bigKeysVisible:
                progress.settings.keysanity === state.settings.keysanity
                  ? state.bigKeysVisible
                  : progress.settings.keysanity,
            };
          }),
        caption: "",

        exportState: () => JSON.stringify(toPersisted(get()), null, 2),

        handleItemClick: (item: string) => {
          if (!item || item === "blank") return;

          const { items } = get();
          const current = items[item];

          if (typeof current === "boolean") {
            set({ items: { ...items, [item]: !current } });
            return;
          }

          // Chest counters count down as chests are emptied; everything else
          // counts up. Both wrap round to the far end of their range.
          const step = item.startsWith("chest") ? -1 : 1;
          const min = itemsMin[item];
          const max = itemsMax[item];
          const next = current + step;

          set({
            items: {
              ...items,
              [item]: next < min ? max : next > max ? min : next,
            },
          });
        },

        handleMedallionChange: (bossNumber: number, newValue: number) => {
          const { medallions, caption } = get();
          const newMedallions = [...medallions];
          newMedallions[bossNumber] = newValue;

          // If the caption currently shows this dungeon, rebuild it so the
          // medallion icon stays in sync (no fragile string replace).
          let updatedCaption = caption;
          const dungeon = dungeons[bossNumber];
          if (
            (bossNumber === DUNGEON_INDICES.MISERY_MIRE ||
              bossNumber === DUNGEON_INDICES.TURTLE_ROCK) &&
            dungeon &&
            caption.startsWith(dungeon.name)
          ) {
            updatedCaption = buildDungeonCaption(
              dungeon,
              bossNumber,
              newMedallions,
            );
          }

          set({
            caption: updatedCaption,
            medallions: newMedallions,
          });
        },

        handleSmallKeyClick: (dungeonIndex: number) => {
          const { smallKeys } = get();
          const newSmallKeys = [...smallKeys];

          // Maximum small keys per dungeon, indexed 0-9
          const maxForDungeon = SMALL_KEYS_MAX_BY_INDEX[dungeonIndex] ?? 0;

          // Increment count, reset to 0 if exceeding max
          newSmallKeys[dungeonIndex] =
            newSmallKeys[dungeonIndex] + 1 > maxForDungeon
              ? 0
              : newSmallKeys[dungeonIndex] + 1;

          set({ smallKeys: newSmallKeys });
        },

        importState: (json: string) => {
          try {
            const parsed = JSON.parse(json);
            if (typeof parsed !== "object" || parsed === null) return false;
            // Exports written before version 2 carry `dungeonsBeaten`
            const version = "dungeonsBeaten" in parsed ? 1 : PERSIST_VERSION;
            set(restoreProgress(createProgress(), migrate(parsed, version)));
            return true;
          } catch {
            return false;
          }
        },

        reset: () => set(createProgress(get().presetId)),

        setBigKeysVisible: (visible: boolean) =>
          set({ bigKeysVisible: visible }),

        setCaption: (caption: string) => set({ caption }),

        setMapLayout: (layout: MapLayout) => set({ mapLayout: layout }),

        toggleChest: (chestIndex: number) =>
          set((state) => ({
            chestsOpened: state.chestsOpened.map((opened, index) =>
              index === chestIndex ? !opened : opened,
            ),
          })),
      }),
      {
        merge: (persisted, current) => {
          const saved = (persisted ?? {}) as Partial<PersistedState>;
          return {
            ...current,
            ...restoreProgress(current, saved),
            ...restorePrefs(current, saved),
          };
        },
        migrate: (persisted, version) =>
          migrate(persisted, version) as PersistedState,
        name: "alltp-tracker-state",
        // Only persist progress and prefs; the caption is transient.
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
