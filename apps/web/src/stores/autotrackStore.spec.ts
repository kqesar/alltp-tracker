import { parseUserAgent } from "@alltp/autotrack";
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FakeVisibility,
  GRANTED,
  ManualClock,
  SAVE,
  seedMemory,
} from "@/autotrack/fixtures";
import {
  connectAutotrack,
  setAutotrackOptions,
  stopAutotrack,
  syncFromGame,
  useAutotrackStore,
} from "@/stores/autotrackStore";
import { useGameStore } from "@/stores/gameStore";
import { MemoryTransport } from "../../../../packages/autotrack/test/memory-transport";

/** A console holding a seed in play, behind an in-memory bridge. */
const harness = () => {
  const memory = seedMemory({ race: false });
  const clock = new ManualClock();
  setAutotrackOptions({
    clock,
    permission: GRANTED,
    random: () => 0,
    transport: () => new MemoryTransport(memory, {}),
    visibility: new FakeVisibility(),
  });
  return { advance: (ms: number) => act(() => clock.advance(ms)), memory };
};

const board = () => useGameStore.getState();

beforeEach(() => {
  localStorage.clear();
  act(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    useAutotrackStore.setState(useAutotrackStore.getInitialState(), true);
    useAutotrackStore.setState({
      environment: parseUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
      ),
    });
  });
});

afterEach(() => {
  act(() => stopAutotrack());
  setAutotrackOptions({});
});

describe("autotracking and the board", () => {
  it("lays what it reads on the board as the game changes", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.advance(0);

    expect(board().items).toMatchObject({
      hookshot: true,
      moonpearl: false,
      sword: 2,
    });
    h.memory[SAVE(0x357)] = 0x01; // Moon Pearl
    await h.advance(1000);
    expect(board().items.moonpearl).toBe(true);
    // Not a step of the player's history
    expect(board().past).toEqual([]);
  });

  it("syncs the board to the game on the player's word", async () => {
    const h = harness();
    expect(syncFromGame()).toBeNull();
    await act(() => connectAutotrack());
    await h.advance(0);
    act(() => board().handleItemClick("sword"));

    let changed: number | null = null;
    act(() => {
      changed = syncFromGame();
    });

    expect(changed).toBe(1);
    expect(board().items.sword).toBe(2);
    act(() => stopAutotrack());
    expect(syncFromGame()).toBeNull();
  });

  it("lays nothing a stopped session read", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.advance(0);
    act(() => stopAutotrack());
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));

    h.memory[SAVE(0x357)] = 0x01;
    await h.advance(2000);

    expect(board().items.hookshot).toBe(false);
  });
});
