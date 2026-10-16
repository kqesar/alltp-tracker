import { create } from "zustand";

/** What a tooltip describes; its text is derived live from the game state. */
export type TooltipTarget =
  | { kind: "chest"; index: number }
  | { kind: "dungeon"; index: number }
  | { kind: "item"; item: string };

type TooltipState = {
  target: TooltipTarget | null;
  /** The element the tooltip points at */
  anchor: HTMLElement | null;
  show: (target: TooltipTarget, anchor: HTMLElement) => void;
  /** Hide, but only if `anchor` (when given) is still the one shown */
  hide: (anchor?: HTMLElement) => void;
};

/**
 * The one tooltip on the page. Kept apart from the game store: hovering never
 * re-renders the board, and nothing here is saved or undone.
 */
export const useTooltipStore = create<TooltipState>()((set, get) => ({
  anchor: null,
  hide: (anchor) => {
    if (anchor && get().anchor !== anchor) return;
    set({ anchor: null, target: null });
  },
  show: (target, anchor) => {
    cancelHide();
    set({ anchor, target });
  },
  target: null,
}));

/** Grace period letting the pointer travel from a control onto its tooltip. */
const HIDE_DELAY_MS = 120;

let hideTimer: ReturnType<typeof setTimeout> | undefined;

/** Hide soon, unless the pointer reaches the tooltip or another anchor first. */
export const scheduleHide = (anchor: HTMLElement) => {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(
    () => useTooltipStore.getState().hide(anchor),
    HIDE_DELAY_MS,
  );
};

/** Keep the tooltip open: the pointer is on it, or on a new anchor. */
export const cancelHide = () => clearTimeout(hideTimer);

/** The tooltip on screen, registered by the Tooltip component. */
let tooltipElement: HTMLElement | null = null;

export const setTooltipElement = (element: HTMLElement | null) => {
  tooltipElement = element;
};

/**
 * Whether a point lies on the tooltip shown. The tooltip takes no pointer
 * events, so a press on it reaches the control it covers: hovering it is
 * told by position instead.
 * @param x - Client x of the pointer
 * @param y - Client y of the pointer
 */
export const isOnTooltip = (x: number, y: number): boolean => {
  const box = tooltipElement?.getBoundingClientRect();
  return (
    !!box &&
    box.width > 0 &&
    x >= box.left &&
    x <= box.right &&
    y >= box.top &&
    y <= box.bottom
  );
};
