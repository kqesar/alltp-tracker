import { create } from "zustand";

type EntrancePickerState = {
  /** The entrance whose destination is being noted, by the pack's id */
  picking: string | null;
  pick: (entrance: string) => void;
  close: () => void;
};

/**
 * Which entrance the destination picker is open for: the map's markers and
 * the Entrances list open it, the picker closes it. Transient, never saved.
 */
export const useEntrancePicker = create<EntrancePickerState>()((set) => ({
  close: () => set({ picking: null }),
  pick: (entrance) => set({ picking: entrance }),
  picking: null,
}));
