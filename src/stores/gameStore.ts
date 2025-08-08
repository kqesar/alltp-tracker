import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ChestItem, DungeonItem, ItemState } from "../data/chests";
import {
  chests as initialChests,
  dungeons as initialDungeons,
} from "../data/chests";
import { items as initialItems, itemsMax, itemsMin } from "../data/items";

interface GameState {
  // State
  items: ItemState;
  chestsState: ChestItem[];
  dungeonsState: DungeonItem[];
  medallions: number[];
  caption: string;
  mapOrientation: boolean;

  // Actions
  setCaption: (caption: string) => void;
  handleItemClick: (item: string) => void;
  handleMedallionChange: (bossNumber: number, newValue: number) => void;
  toggleChest: (chestIndex: number) => void;
  toggleDungeonBoss: (dungeonIndex: number) => void;
  setChestsState: (chests: ChestItem[]) => void;
  setDungeonsState: (dungeons: DungeonItem[]) => void;

  // Reset function for testing or new game
  reset: () => void;
}

const initialState = {
  caption: "",
  chestsState: [...initialChests],
  dungeonsState: [...initialDungeons],
  items: { ...initialItems } as ItemState,
  mapOrientation: false,
  medallions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
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
                  medallionName = "medallion0";
                  break;
                default:
                  medallionName = "medallion0";
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

      reset: () => set(initialState),

      setCaption: (caption: string) => set({ caption }),

      setChestsState: (chests: ChestItem[]) => set({ chestsState: chests }),

      setDungeonsState: (dungeons: DungeonItem[]) =>
        set({ dungeonsState: dungeons }),

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
export const useGameActions = () =>
  useGameStore((state) => ({
    handleItemClick: state.handleItemClick,
    handleMedallionChange: state.handleMedallionChange,
    setCaption: state.setCaption,
    toggleChest: state.toggleChest,
    toggleDungeonBoss: state.toggleDungeonBoss,
  }));
