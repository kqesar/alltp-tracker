import { act, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const { useStreamStore } = await import("@/desktop/streamTools");
const { default: StreamMovedNotice } = await import(
  "@/desktop/StreamMovedNotice"
);

const SESSION = {
  address: "http://127.0.0.1:44897/",
  apiToken: "ABCDEFGHIJKLMNOPQRSTUV",
  lan: false,
  lanAddress: null,
  moved: true,
  port: 44_897,
  token: "abcdefghijklmnopqrstuv",
  viewers: 0,
};

beforeEach(() => {
  useStreamStore.setState(useStreamStore.getInitialState(), true);
});

describe("StreamMovedNotice", () => {
  it("keeps an empty live region until the stream's port moved at launch", () => {
    render(<StreamMovedNotice />);

    const notice = screen.getByTestId("stream-moved-notice");
    expect(notice).toHaveRole("status");
    expect(notice).toBeEmptyDOMElement();
  });

  it("says the port and what to do, then goes when dismissed", () => {
    render(<StreamMovedNotice />);

    act(() => useStreamStore.setState({ movedNotice: true, session: SESSION }));

    const notice = screen.getByTestId("stream-moved-notice");
    expect(notice).toHaveTextContent("it now uses port 44897");
    expect(notice).toHaveTextContent(
      "paste its new address into your OBS source",
    );
    fireEvent.click(screen.getByTestId("stream-moved-dismiss"));
    expect(notice).toBeEmptyDOMElement();
    expect(useStreamStore.getState().movedNotice).toBe(false);
  });

  it("has no axe violation", async () => {
    const { container } = render(<StreamMovedNotice />);
    act(() => useStreamStore.setState({ movedNotice: true, session: SESSION }));

    const result = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });

    expect(result.violations.map(({ id }) => id)).toEqual([]);
  });
});
