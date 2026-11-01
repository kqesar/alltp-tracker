// The undo history of the Super Metroid and SMZ3 runs, which are the same
// mechanism over two different runs. ALttPR's (alttpr/stores/gameStore.ts)
// stamps its timeline on every step, so it keeps its own actions and takes
// only the depth.

/**
 * What a step that replaces the run, or its seed, keeps beside the snapshot
 * of the run it leaves: the run's clock (its timer, Super Metroid's clock
 * base), which lives outside the run. Undo and Redo bring it back with the
 * run, so undoing New game, a New run or Follow this ROM gives back the run's
 * own time, not the one the other run counted since. A symbol, so it rides
 * along every copy of the snapshot (game news rebases it) and no save holds
 * it.
 */
const CLOCK = Symbol("clock");

type Clocked = { [CLOCK]?: Record<string, unknown> };

/** A snapshot with the run's clock kept beside it. */
export const withClock = <P extends object>(
  snapshot: P,
  clock: Record<string, unknown>,
): P => ({ ...snapshot, [CLOCK]: clock });

/** The clock kept beside a snapshot, if its step kept one. */
export const clockOf = (snapshot: object) => (snapshot as Clocked)[CLOCK];

/**
 * The snapshot of the run left by Undo or Redo: with the clock now, when the
 * step it crosses kept one, so the way back brings it too.
 * @param run - The run left
 * @param state - The store's state, its clock now
 * @param kept - The clock the step crossed kept, or undefined
 */
export const leaving = <P extends object>(
  run: P,
  state: object,
  kept: Record<string, unknown> | undefined,
): P =>
  kept === undefined
    ? run
    : withClock(
        run,
        Object.fromEntries(
          Object.keys(kept).map((key) => [
            key,
            (state as Record<string, unknown>)[key],
          ]),
        ),
      );

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
  /**
   * A change of the player's: one step of the history.
   * @param clock - The run's clock now, for a step that replaces the run or
   * its seed (`withClock`)
   */
  record: (change: Partial<P>, clock?: Record<string, unknown>) =>
    set((state) => {
      const run = progressOf(state);
      return {
        ...change,
        future: [],
        past: [
          ...state.past,
          clock === undefined ? run : withClock(run, clock),
        ].slice(-HISTORY_LIMIT),
      };
    }),
  /** Redo the step undone last: the run now is a step of the past again. */
  redo: () =>
    set((state) => {
      const [next, ...future] = state.future;
      if (next === undefined) return state;
      const kept = clockOf(next);
      return {
        ...next,
        ...kept,
        future,
        past: [...state.past, leaving(progressOf(state), state, kept)],
      } as Changes<P>;
    }),
  /** Undo the latest step: the run now is the first of the future. */
  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      if (previous === undefined) return state;
      const kept = clockOf(previous);
      return {
        ...previous,
        ...kept,
        future: [leaving(progressOf(state), state, kept), ...state.future],
        past: state.past.slice(0, -1),
      } as Changes<P>;
    }),
});
