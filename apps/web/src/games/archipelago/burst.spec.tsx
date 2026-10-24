import { act, render, screen } from "@testing-library/react";
import { Profiler } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ItemsPanel } from "@/games/archipelago/components/ItemsPanel";
import {
  connect,
  saveRoom,
  setRuntimeOptions,
  stop,
  useApConnectionStore,
} from "@/games/archipelago/connection";
import { ROOM_ADDRESS, startRoom } from "@/games/archipelago/fixtures";
import { BATCH_MS } from "@/games/archipelago/runtime";
import { AP_STORAGE_KEY, useArchipelagoStore } from "@/games/archipelago/store";

beforeEach(() => {
  localStorage.clear();
  useArchipelagoStore.setState(useArchipelagoStore.getInitialState(), true);
  useApConnectionStore.setState(useApConnectionStore.getInitialState(), true);
});

afterEach(() => {
  stop();
  setRuntimeOptions({});
  vi.restoreAllMocks();
});

it("renders and persists a release burst of 1,000 sends once", async () => {
  const room = startRoom();
  saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
  await connect();
  await vi.waitFor(() =>
    expect(useApConnectionStore.getState().status.code).toBe("connected"),
  );
  await vi.waitFor(() =>
    expect(useArchipelagoStore.getState().room?.slotName).toBe("Link"),
  );
  // Settled: the names in, the last write gone out
  await new Promise((resolve) => setTimeout(resolve, BATCH_MS * 2));

  let renders = 0;
  render(
    <Profiler id="items" onRender={() => renders++}>
      <ItemsPanel />
    </Profiler>,
  );
  renders = 0;
  const setItem = vi.spyOn(Storage.prototype, "setItem");
  const writes = () =>
    setItem.mock.calls.filter(([key]) => key === AP_STORAGE_KEY).length;

  // A Release: a thousand items, each its own ReceivedItems, in one go
  const burst = Array.from({ length: 1000 }, (_, index) => [
    {
      cmd: "ReceivedItems",
      index,
      items: [{ flags: 2, item: 23, location: index, player: 2 }],
    },
  ]);
  act(() => room.network.last.deliver(burst));
  expect(writes()).toBe(0);
  await act(() => new Promise((resolve) => setTimeout(resolve, BATCH_MS * 2)));

  expect(useArchipelagoStore.getState().received).toBe(1000);
  expect(writes()).toBe(1);
  expect(renders).toBe(1);
  expect(screen.getByTestId("ap-item-list")).toHaveTextContent(
    "Piece of Heart×, 1000",
  );
});
