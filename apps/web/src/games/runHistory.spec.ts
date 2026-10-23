import { beforeEach, describe, expect, it } from "vitest";
import { create } from "zustand";
import {
  HISTORY_LIMIT,
  type History,
  historyActions,
} from "@/games/runHistory";

type Run = { held: number; name: string };
type State = Run & History<Run>;

const progressOf = (state: Run): Run => ({
  held: state.held,
  name: state.name,
});

const store = create<State>()(() => ({
  future: [],
  held: 0,
  name: "run",
  past: [],
}));
const history = historyActions<Run>({
  get: store.getState,
  progressOf,
  set: store.setState,
});

beforeEach(() =>
  store.setState({ future: [], held: 0, name: "run", past: [] }),
);

describe("historyActions", () => {
  it("records a change as one step and clears what redo held", () => {
    history.record({ held: 1 });
    history.undo();
    history.record({ held: 2 });

    expect(store.getState()).toMatchObject({ future: [], held: 2 });
    expect(store.getState().past).toEqual([{ held: 0, name: "run" }]);
  });

  it("undoes and redoes, the run and its snapshots moving together", () => {
    history.record({ held: 1 });
    history.record({ held: 2 });

    history.undo();
    expect(store.getState().held).toBe(1);
    expect(store.getState().future).toEqual([{ held: 2, name: "run" }]);

    history.redo();
    expect(store.getState().held).toBe(2);
    expect(store.getState().future).toEqual([]);
  });

  it("does nothing to undo or redo with no step left", () => {
    const before = store.getState();

    history.undo();
    history.redo();

    expect(store.getState()).toBe(before);
  });

  it("keeps the latest steps only", () => {
    for (let held = 1; held <= HISTORY_LIMIT + 5; held++) {
      history.record({ held });
    }

    const { past } = store.getState();
    expect(past).toHaveLength(HISTORY_LIMIT);
    expect(past.at(-1)?.held).toBe(HISTORY_LIMIT + 4);
  });

  it("lays the game's news on the run and on every snapshot, as no step", () => {
    history.record({ held: 1 });
    history.record({ held: 2 });
    history.undo();

    history.applyGameNews((run) => (run.held >= 1 ? { name: "seen" } : null));

    const state = store.getState();
    expect(state.name).toBe("seen");
    expect(state.past).toEqual([{ held: 0, name: "run" }]);
    expect(state.future).toEqual([{ held: 2, name: "seen" }]);
    history.undo();
    expect(store.getState()).toMatchObject({ held: 0, name: "run" });
  });
});
