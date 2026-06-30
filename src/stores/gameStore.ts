import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { DUNGEON_INDICES, SMALL_KEYS_MAX_BY_INDEX } from "@/constants";
import {
  buildDungeonCaption,
  type ChestItem,
  type DungeonItem,
  type ItemState,
  chests as initialChests,
  dungeons as initialDungeons,
} from "@/data/chests";
import { items as initialItems, itemsMax, itemsMin } from "@/data/items";
import { DEFAULT_PRESET_ID, getPreset, type RunSettings } from "@/data/presets";

/**
 * Serializable snapshot of the tracker progress.
 * Chest/dungeon objects carry functions (isAvailable, isBeatable, ...) that
 * cannot be persisted, so only their boolean flags are stored and re-applied
 * onto the fresh game data when loading.
 */
type PersistedState = {
  items: ItemState;
  medallions: number[];
  smallKeys: number[];
  bigKeysVisible: boolean;
  chestsOpened: boolean[];
  dungeonsBeaten: boolean[];
  presetId: string;
  settings: RunSettings;
};

interface GameState {
  // State
  items: ItemState;
  chestsState: ChestItem[];
  dungeonsState: DungeonItem[];
  medallions: number[];
  caption: string;
  mapOrientation: boolean;
  bigKeysVisible: boolean;
  smallKeys: number[]; // Array of 10 dungeons (0-9) with small key counts

  // Run-type preset
  presetId: string;
  settings: RunSettings;

  // Actions
  applyPreset: (presetId: string) => void;
  setCaption: (caption: string) => void;
  handleItemClick: (item: string) => void;
  handleSmallKeyClick: (dungeonIndex: number) => void;
  handleMedallionChange: (bossNumber: number, newValue: number) => void;
  toggleChest: (chestIndex: number) => void;
  toggleDungeonBoss: (dungeonIndex: number) => void;
  setChestsState: (chests: ChestItem[]) => void;
  setDungeonsState: (dungeons: DungeonItem[]) => void;
  setBigKeysVisible: (visible: boolean) => void;

  // Persistence helpers
  exportState: () => string;
  importState: (json: string) => boolean;

  // Reset function for testing or new game
  reset: () => void;
}

/**
 * Build a fresh game state. Chests and dungeons are cloned so their mutable
 * flags (isOpened / isBeaten) are independent from the source data — this is
 * what prevents the previous reset() bug where toggling mutated the defaults.
 */
const createInitialState = (presetId: string = DEFAULT_PRESET_ID) => {
  const preset = getPreset(presetId);
  return {
    bigKeysVisible: preset.settings.keysanity,
    caption: "",
    chestsState: initialChests.map((chest) => ({ ...chest })),
    dungeonsState: initialDungeons.map((dungeon) => ({ ...dungeon })),
    items: { ...initialItems } as ItemState,
    mapOrientation: false,
    medallions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    presetId: preset.id,
    settings: preset.settings,
    smallKeys: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 10 dungeons, all start at 0
  };
};

/** Project the current progress into its serializable form. */
const toPersisted = (state: GameState): PersistedState => ({
  bigKeysVisible: state.bigKeysVisible,
  chestsOpened: state.chestsState.map((chest) => chest.isOpened),
  dungeonsBeaten: state.dungeonsState.map((dungeon) => dungeon.isBeaten),
  items: state.items,
  medallions: state.medallions,
  presetId: state.presetId,
  settings: state.settings,
  smallKeys: state.smallKeys,
});

/** Re-apply a persisted/imported snapshot onto a fresh state (functions intact). */
const applyPersisted = <T extends ReturnType<typeof createInitialState>>(
  base: T,
  persisted: Partial<PersistedState>,
): T => ({
  ...base,
  bigKeysVisible:
    typeof persisted.bigKeysVisible === "boolean"
      ? persisted.bigKeysVisible
      : base.bigKeysVisible,
  chestsState: base.chestsState.map((chest, index) => ({
    ...chest,
    isOpened: persisted.chestsOpened?.[index] ?? chest.isOpened,
  })),
  dungeonsState: base.dungeonsState.map((dungeon, index) => ({
    ...dungeon,
    isBeaten: persisted.dungeonsBeaten?.[index] ?? dungeon.isBeaten,
  })),
  items: persisted.items
    ? ({ ...base.items, ...persisted.items } as ItemState)
    : base.items,
  medallions: persisted.medallions ?? base.medallions,
  presetId: persisted.presetId ?? base.presetId,
  settings: persisted.settings ?? base.settings,
  smallKeys: persisted.smallKeys ?? base.smallKeys,
});

export const useGameStore = create<GameState>()(
  devtools(
    persist(
      (set, get) => ({
        ...createInitialState(),

        applyPreset: (presetId: string) => set(createInitialState(presetId)),

        exportState: () => JSON.stringify(toPersisted(get()), null, 2),

        handleItemClick: (item: string) => {
          if (!item || item === "blank") return;

          const { items } = get();
          const newItems = { ...items };

          if (typeof items[item] === "boolean") {
            newItems[item] = !newItems[item];
          } else {
            // Special logic for chest items - decrement instead of increment
            if (item.startsWith("chest")) {
              newItems[item] = (newItems[item] as number) - 1;
              const maxValue = itemsMax[item];
              const minValue = itemsMin[item];
              if (newItems[item] < minValue) {
                newItems[item] = maxValue;
              }
            } else {
              // Normal increment logic for other items
              newItems[item] = (newItems[item] as number) + 1;
              const maxValue = itemsMax[item];
              const minValue = itemsMin[item];
              if (newItems[item] > maxValue) {
                newItems[item] = minValue;
              }
            }
          }

          set({ items: newItems });
        },

        handleMedallionChange: (bossNumber: number, newValue: number) => {
          const { medallions, caption, dungeonsState } = get();
          const newMedallions = [...medallions];
          newMedallions[bossNumber] = newValue;

          // If the caption currently shows this dungeon, rebuild it so the
          // medallion icon stays in sync (no fragile string replace).
          let updatedCaption = caption;
          const dungeon = dungeonsState[bossNumber];
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
            set(applyPersisted(createInitialState(), parsed as PersistedState));
            return true;
          } catch {
            return false;
          }
        },

        reset: () => set(createInitialState(get().presetId)),

        setBigKeysVisible: (visible: boolean) =>
          set({ bigKeysVisible: visible }),

        setCaption: (caption: string) => set({ caption }),

        setChestsState: (chests: ChestItem[]) => set({ chestsState: chests }),

        setDungeonsState: (dungeons: DungeonItem[]) =>
          set({ dungeonsState: dungeons }),

        toggleChest: (chestIndex: number) =>
          set((state) => ({
            chestsState: state.chestsState.map((chest, index) =>
              index === chestIndex
                ? { ...chest, isOpened: !chest.isOpened }
                : chest,
            ),
          })),

        toggleDungeonBoss: (dungeonIndex: number) =>
          set((state) => ({
            dungeonsState: state.dungeonsState.map((dungeon, index) =>
              index === dungeonIndex
                ? { ...dungeon, isBeaten: !dungeon.isBeaten }
                : dungeon,
            ),
          })),
      }),
      {
        // Rebuild chest/dungeon objects (with their functions) from saved flags.
        merge: (persisted, current) =>
          applyPersisted(current, (persisted ?? {}) as Partial<PersistedState>),
        name: "alltp-tracker-state",
        // Only persist serializable progress; caption is transient.
        partialize: (state) => toPersisted(state),
        version: 1,
      },
    ),
    {
      name: "game-storage", // For the devtools
    },
  ),
);

// Selectors to optimize re-renders
export const useItems = () => useGameStore((state) => state.items);
export const useChests = () => useGameStore((state) => state.chestsState);
export const useDungeons = () => useGameStore((state) => state.dungeonsState);
export const useMedallions = () => useGameStore((state) => state.medallions);
export const useCaption = () => useGameStore((state) => state.caption);
export const useGameActions = () =>
  useGameStore(
    useShallow((state) => ({
      handleItemClick: state.handleItemClick,
      handleMedallionChange: state.handleMedallionChange,
      setCaption: state.setCaption,
      toggleChest: state.toggleChest,
      toggleDungeonBoss: state.toggleDungeonBoss,
    })),
  );
