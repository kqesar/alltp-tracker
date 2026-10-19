import { create } from "zustand";

type EntrancePickerState = {
  /** The entrance whose destination is being noted, by the pack's id */
  picking: string | null;
  pick: (entrance: string) => void;
  close: () => void;
  /**
   * The place an entrance hovered or focused leads to: every entrance
   * noted to lead there shows it, a cave's other sides
   */
  linked: string | null;
  link: (place: string | null) => void;
};

/**
 * Which entrance the destination picker is open for (the map's markers and
 * the Entrances list open it, the picker closes it), and the place the
 * entrance under the pointer or the focus leads to. Transient, never saved.
 */
export const useEntrancePicker = create<EntrancePickerState>()((set) => ({
  close: () => set({ picking: null }),
  link: (place) => set({ linked: place }),
  linked: null,
  pick: (entrance) => set({ picking: entrance }),
  picking: null,
}));
