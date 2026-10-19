import { useEffect } from "react";
import { create } from "zustand";
import type { LayoutMap } from "@/utils/keyLabels";

/** `navigator.keyboard`, which only Chromium browsers implement. */
type KeyboardApi = { getLayoutMap?: () => Promise<LayoutMap> };

/**
 * What each physical key types on the player's keyboard layout, once the
 * browser has said; null before that, and for good where it cannot. Kept out
 * of the game store: it is neither saved nor part of a run.
 */
export const useKeyboardLayoutStore = create<{ layout: LayoutMap | null }>()(
  () => ({ layout: null }),
);

/**
 * Ask the browser for the keyboard layout map. Where it has none (Firefox,
 * Safari) or refuses (a cross-origin frame), labels keep their fallback.
 */
export const loadKeyboardLayout = async () => {
  const keyboard = (navigator as Navigator & { keyboard?: KeyboardApi })
    .keyboard;
  try {
    const layout = await keyboard?.getLayoutMap?.();
    if (layout) useKeyboardLayoutStore.setState({ layout });
  } catch {
    // Not allowed here: the fallback labels stand
  }
};

let requested = false;

/** The player's keyboard layout map, asked for on first use. */
export const useKeyboardLayout = () => {
  useEffect(() => {
    if (requested) return;
    requested = true;
    void loadKeyboardLayout();
  }, []);
  return useKeyboardLayoutStore((state) => state.layout);
};
