import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { STORAGE_KEYS } from "@/constants";
import {
  type ChestItem,
  type DungeonItem,
  type ItemState,
  chests as initialChests,
  dungeons as initialDungeons,
} from "@/data/chests";
import {
  defaultItemGrid,
  items as initialItems,
  itemsMax,
  itemsMin,
} from "@/data/items";

/**
 * Load item layout from localStorage
 * Returns the saved layout or null if none exists or if invalid
 */
const loadItemLayoutFromStorage = (): string[][] | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ITEM_LAYOUT);
    if (!stored) return null;

    const parsed = JSON.parse(stored);

    // Validate structure: must be array of arrays of strings
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (row) =>
          Array.isArray(row) && row.every((item) => typeof item === "string"),
      )
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

/**
 * Save item layout to localStorage
 */
const saveItemLayoutToStorage = (layout: string[][]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.ITEM_LAYOUT, JSON.stringify(layout));
  } catch {
    // Silently fail if localStorage is not available
  }
};

/**
 * Remove item layout from localStorage
 */
const clearItemLayoutFromStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.ITEM_LAYOUT);
  } catch {
    // Silently fail if localStorage is not available
  }
};

/**
 * Get initial item layout - from localStorage or default
 */
const getInitialItemLayout = (): string[][] => {
  const savedLayout = loadItemLayoutFromStorage();
  return savedLayout ?? defaultItemGrid.map((row) => [...row]);
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
  itemLayout: string[][]; // Customizable item grid layout

  // Actions
  setCaption: (caption: string) => void;
  handleItemClick: (item: string) => void;
  handleSmallKeyClick: (dungeonIndex: number) => void;
  handleMedallionChange: (bossNumber: number, newValue: number) => void;
  toggleChest: (chestIndex: number) => void;
  toggleDungeonBoss: (dungeonIndex: number) => void;
  setChestsState: (chests: ChestItem[]) => void;
  setDungeonsState: (dungeons: DungeonItem[]) => void;
  setBigKeysVisible: (visible: boolean) => void;
  setItemLayout: (layout: string[][]) => void;
  resetItemLayout: () => void;

  // Reset function for testing or new game
  reset: () => void;
}

const initialState = {
  bigKeysVisible: true,
  caption: "",
  chestsState: [...initialChests],
  dungeonsState: [...initialDungeons],
  itemLayout: getInitialItemLayout(),
  items: { ...initialItems } as ItemState,
  mapOrientation: false,
  medallions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  smallKeys: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 10 dungeons, all start at 0
};

export const useGameStore = create<GameState>()(
  devtools(
    (set, get) => ({
      ...initialState,

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

        // Update caption if it's currently showing a dungeon with medallion info
        let updatedCaption = caption;
        if ((bossNumber === 8 || bossNumber === 9) && caption !== "") {
          if (
            caption.includes("Misery Mire") ||
            caption.includes("Turtle Rock") ||
            caption.includes("medallion")
          ) {
            const dungeon = dungeonsState[bossNumber];
            if (dungeon) {
              updatedCaption = dungeon.name;

              let medallionName = "medallion0";
              switch (newValue) {
                case 1:
                  medallionName = "medallion1";
                  break;
                case 2:
                  medallionName = "medallion2";
                  break;
                case 3:
                  medallionName = "medallion3";
                  break;
              }

              updatedCaption = updatedCaption.replace(
                /<img src='\/assets\/medallion0\.png' class='mini'\/>/g,
                `<img src='/assets/${medallionName}.png' class='mini'/>`,
              );
            }
          }
        }

        set({
          caption: updatedCaption,
          medallions: newMedallions,
        });
      },

      handleSmallKeyClick: (dungeonIndex: number) => {
        const { smallKeys } = get();
        const newSmallKeys = [...smallKeys];

        // Get maximum for this dungeon
        const maxValues = [1, 1, 1, 6, 1, 3, 1, 2, 3, 4]; // Based on SMALL_KEYS_MAX
        const maxForDungeon = maxValues[dungeonIndex] || 0;

        // Increment count, reset to 0 if exceeding max
        newSmallKeys[dungeonIndex] =
          newSmallKeys[dungeonIndex] + 1 > maxForDungeon
            ? 0
            : newSmallKeys[dungeonIndex] + 1;

        set({ smallKeys: newSmallKeys });
      },

      reset: () => set(initialState),

      resetItemLayout: () => {
        clearItemLayoutFromStorage();
        set({ itemLayout: defaultItemGrid.map((row) => [...row]) });
      },

      setBigKeysVisible: (visible: boolean) => set({ bigKeysVisible: visible }),

      setCaption: (caption: string) => set({ caption }),

      setChestsState: (chests: ChestItem[]) => set({ chestsState: chests }),

      setDungeonsState: (dungeons: DungeonItem[]) =>
        set({ dungeonsState: dungeons }),

      setItemLayout: (layout: string[][]) => {
        const newLayout = layout.map((row) => [...row]);
        saveItemLayoutToStorage(newLayout);
        set({ itemLayout: newLayout });
      },

      toggleChest: (chestIndex: number) => {
        const { chestsState } = get();
        const newChests = [...chestsState];
        newChests[chestIndex].isOpened = !newChests[chestIndex].isOpened;
        set({ chestsState: newChests });
      },

      toggleDungeonBoss: (dungeonIndex: number) => {
        const { dungeonsState } = get();
        const newDungeons = [...dungeonsState];
        newDungeons[dungeonIndex].isBeaten =
          !newDungeons[dungeonIndex].isBeaten;
        set({ dungeonsState: newDungeons });
      },
    }),
    {
      name: "game-storage", // Pour le devtools
    },
  ),
);

// Selectors pour optimiser les re-renders
export const useItems = () => useGameStore((state) => state.items);
export const useChests = () => useGameStore((state) => state.chestsState);
export const useDungeons = () => useGameStore((state) => state.dungeonsState);
export const useMedallions = () => useGameStore((state) => state.medallions);
export const useCaption = () => useGameStore((state) => state.caption);
export const useItemLayout = () => useGameStore((state) => state.itemLayout);
export const useGameActions = () =>
  useGameStore((state) => ({
    handleItemClick: state.handleItemClick,
    handleMedallionChange: state.handleMedallionChange,
    setCaption: state.setCaption,
    toggleChest: state.toggleChest,
    toggleDungeonBoss: state.toggleDungeonBoss,
  }));
