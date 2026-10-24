import { act, render, screen } from "@testing-library/react";
import { Profiler } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FeedPanel } from "@/games/archipelago/components/FeedPanel";
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

it("renders and persists a release burst of 1,000 sends and lines once", async () => {
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
  let feedRenders = 0;
  render(
    <>
      <Profiler id="items" onRender={() => renders++}>
        <ItemsPanel />
      </Profiler>
      <Profiler id="feed" onRender={() => feedRenders++}>
        <FeedPanel />
      </Profiler>
    </>,
  );
  renders = 0;
  feedRenders = 0;
  const setItem = vi.spyOn(Storage.prototype, "setItem");
  const writes = () =>
    setItem.mock.calls.filter(([key]) => key === AP_STORAGE_KEY).length;

  // A Release: its line, then a thousand items, each its own ItemSend line
  // and ReceivedItems, in one go
  const release = [
    { cmd: "PrintJSON", data: [], slot: 2, team: 0, type: "Release" },
  ];
  const sent = (index: number) => ({
    flags: 2,
    item: 23,
    location: index,
    player: 2,
  });
  const burst = [
    release,
    ...Array.from({ length: 1000 }, (_, index) => [
      {
        cmd: "PrintJSON",
        data: [],
        item: sent(index),
        receiving: 1,
        type: "ItemSend",
      },
      { cmd: "ReceivedItems", index, items: [sent(index)] },
    ]),
  ];
  act(() => room.network.last.deliver(burst));
  expect(writes()).toBe(0);
  await act(() => new Promise((resolve) => setTimeout(resolve, BATCH_MS * 2)));

  expect(useArchipelagoStore.getState().received).toBe(1000);
  expect(writes()).toBe(1);
  expect(renders).toBe(1);
  expect(feedRenders).toBe(1);
  expect(screen.getByTestId("ap-item-list")).toHaveTextContent(
    "Piece of Heart×, 1000",
  );
  // The burst is one line
  expect(screen.getAllByTestId("ap-feed-line")[0]).toHaveTextContent(
    "Samus released 1000 items, 1000 for you",
  );
});
