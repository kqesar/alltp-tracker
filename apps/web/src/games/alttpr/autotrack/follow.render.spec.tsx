import { parseUserAgent } from "@alltp/autotrack";
import { act, render, screen } from "@testing-library/react";
import { Profiler } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  FakeVisibility,
  GRANTED,
  ManualClock,
  SAVE,
  seedMemory,
} from "@/games/alttpr/autotrack/fixtures";
import { MapTracker } from "@/games/alttpr/components/map/MapTracker";
import { TrackerGrid } from "@/games/alttpr/components/tracker/TrackerGrid";
import { defaultItemGrid } from "@/games/alttpr/data/items";
import {
  connectAutotrack,
  setAutotrackOptions,
  stopAutotrack,
  useAutotrackStore,
} from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { MemoryTransport } from "../../../../../../packages/autotrack/test/memory-transport";

/** The game mode byte: the overworld ($09) or a dungeon ($07). */
const GAME_MODE = 0xf5_0010;

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

it("re-renders the board only when the game changes what it shows", async () => {
  const memory = seedMemory({ race: false });
  const clock = new ManualClock();
  setAutotrackOptions({
    clock,
    permission: GRANTED,
    random: () => 0,
    transport: () => new MemoryTransport(memory, {}),
    visibility: new FakeVisibility(),
  });
  let commits = 0;
  render(
    <Profiler id="board" onRender={() => commits++}>
      <TrackerGrid itemLayout={defaultItemGrid} />
      <MapTracker />
    </Profiler>,
  );
  const advance = (ms: number) => act(() => clock.advance(ms));

  await act(() => connectAutotrack());
  await advance(0);
  expect(screen.getByTestId("item-hookshot")).toHaveAccessibleName(
    "Hookshot, obtained. Click to change state.",
  );
  commits = 0;
  let sets = 0;
  const unsubscribe = useGameStore.subscribe(() => sets++);
  const readings = () => useAutotrackStore.getState().reading;

  // Link walks in and out of dungeons: memory changes, the board does not
  for (let second = 0; second < 6; second++) {
    const before = readings();
    memory[GAME_MODE] = second % 2 === 0 ? 0x07 : 0x09;
    await advance(1000);
    expect(readings()).not.toBe(before);
  }
  // Not a render, and not a write to the store (nor to localStorage)
  expect(commits).toBe(0);
  expect(sets).toBe(0);
  unsubscribe();

  memory[SAVE(0x357)] = 0x01; // the Moon Pearl
  await advance(1000);
  expect(commits).toBeGreaterThan(0);
  expect(useGameStore.getState().items.moonpearl).toBe(true);
});
