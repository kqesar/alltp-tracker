// The undo history of the Super Metroid and SMZ3 runs, which are the same
// mechanism over two different runs. ALttPR's (alttpr/stores/gameStore.ts)
// stamps its timeline on every step, so it keeps its own actions and takes
// only the depth.

/** Undo depth: far more than a run needs, and each step is a few KB. */
export const HISTORY_LIMIT = 200;

/** The snapshots a run's store keeps beside it, never saved. */
export type History<P> = {
  /** What redo brings back, the next first */
  future: P[];
  /** What undo restores, the latest last */
  past: P[];
};

/**
 * What an action changes in the store: some of the run and of its history, or
 * the history alone (TypeScript cannot tell that `{ future, past }` is no
 * change to a generic run `P`).
 */
type Changes<P> = (Partial<P> & Partial<History<P>>) | History<P>;

/**
 * The actions of a store whose state is a run `P` and its `History<P>`, over
 * the store's own `get` and `set`.
 * @param progressOf - Picks the run out of the state, leaving the history and
 * the actions behind
 */
export const historyActions = <P extends object>({
  get,
  progressOf,
  set,
}: {
  get: () => P & History<P>;
  progressOf: (state: P) => P;
  set: (update: (state: P & History<P>) => Changes<P>) => void;
}) => ({
  /**
   * Lay what the game says on the run and on every snapshot of its history:
   * no step, so undoing the player's change never undoes the game's.
   */
  applyGameNews: (change: (run: P) => Partial<P> | null) => {
    const state = get();
    const now = change(progressOf(state));
    const rebase = (history: P[]) =>
      history.map((run) => {
        const changed = change(run);
        return changed === null ? run : { ...run, ...changed };
      });
    set(() => ({
      ...now,
      future: rebase(state.future),
      past: rebase(state.past),
    }));
  },
  /** A change of the player's: one step of the history. */
  record: (change: Partial<P>) =>
    set((state) => ({
      ...change,
      future: [],
      past: [...state.past, progressOf(state)].slice(-HISTORY_LIMIT),
    })),
  /** Redo the step undone last: the run now is a step of the past again. */
  redo: () =>
    set((state) => {
      const [next, ...future] = state.future;
      if (next === undefined) return state;
      return {
        ...next,
        future,
        past: [...state.past, progressOf(state)],
      };
    }),
  /** Undo the latest step: the run now is the first of the future. */
  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      if (previous === undefined) return state;
      return {
        ...previous,
        future: [progressOf(state), ...state.future],
        past: state.past.slice(0, -1),
      };
    }),
});
