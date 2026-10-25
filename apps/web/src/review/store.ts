// The review that is open, if any: a spoiler log read, bound to the run and
// held in memory only. No `persist`, no storage, no export: the game's own
// store is what saving, sharing, the stream view, the overlay API and live
// follow read, and this one is none of them. A reload, a game switch or
// anything that closes the review drops it (`review/useReview.ts`).

import type { Binding, SpoilerGame, SpoilerLog } from "@alltp/spoiler";
import { create } from "zustand";

/** A log read and accepted for a run. */
export type Loaded = {
  readonly game: SpoilerGame;
  readonly log: SpoilerLog;
  /** How the log relates to the run: the seed was proven, or nothing contradicts. */
  readonly binding: Extract<Binding, { verdict: "verified" | "not-verified" }>;
  /** The file's name, shown with the seed. */
  readonly fileName: string;
  /** The run's seed when the review opened: another seed closes it. */
  readonly boundSeed: string | null;
};

type ReviewState = {
  review: Loaded | null;
  open: (review: Loaded) => void;
  close: () => void;
};

export const useReviewStore = create<ReviewState>()((set) => ({
  close: () =>
    set((state) => (state.review === null ? state : { review: null })),
  open: (review) => set({ review }),
  review: null,
}));
