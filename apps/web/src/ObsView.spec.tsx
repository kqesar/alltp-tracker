import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObsView } from "@/ObsView";
import { useGameStore } from "@/stores/gameStore";
import { useUpdateStore } from "@/stores/updateStore";

/** Resize jsdom's viewport and tell the page, as a resized OBS source would. */
const resizeTo = (width: number, height: number) =>
  act(() => {
    window.innerWidth = width;
    window.innerHeight = height;
    window.dispatchEvent(new Event("resize"));
  });

const cssVar = (name: string) =>
  screen.getByTestId("obs-view").style.getPropertyValue(name);

describe("ObsView", () => {
  const { innerHeight, innerWidth } = window;

  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
    act(() => useUpdateStore.setState(useUpdateStore.getInitialState(), true));
  });

  afterEach(() => {
    window.innerWidth = innerWidth;
    window.innerHeight = innerHeight;
  });

  it("renders the item grid as the page's main content", () => {
    render(<ObsView background={null} />);

    expect(screen.getByRole("main")).toBe(screen.getByTestId("obs-view"));
    expect(screen.getByTestId("item-grid")).toHaveAccessibleName(
      "Item tracker grid",
    );
    expect(screen.getByTestId("item-hookshot")).toHaveAccessibleName(
      /^Hookshot, not obtained\./,
    );
  });

  it("renders none of the app around the grid", () => {
    render(<ObsView background={null} />);

    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByTestId("toolbar")).toBeNull();
    expect(screen.queryByTestId("stream-view-button")).toBeNull();
    expect(screen.queryByTestId("map-tracker")).toBeNull();
    expect(screen.queryByTestId("tooltip")).toBeNull();
    // Hovering an item would show its tooltip in the app
    fireEvent.pointerEnter(screen.getByTestId("item-hookshot"), {
      pointerType: "mouse",
    });
    expect(screen.queryByTestId("tooltip")).toBeNull();
  });

  it("keeps its items clickable", () => {
    render(<ObsView background={null} />);
    const hammer = screen.getByTestId("item-hammer");

    fireEvent.click(hammer);

    expect(hammer).toHaveAccessibleName(/^Hammer, obtained\./);
  });

  it("steps its items with their keyboard shortcuts too", async () => {
    const user = userEvent.setup();
    render(<ObsView background={null} />);

    await user.keyboard("w");

    expect(screen.getByTestId("item-hookshot")).toHaveAccessibleName(
      /^Hookshot, obtained\./,
    );
    await user.keyboard("{Control>}z{/Control}");
    expect(screen.getByTestId("item-hookshot")).toHaveAccessibleName(
      /^Hookshot, not obtained\./,
    );
  });

  it("marks the page as the stream view while it is shown", () => {
    const { unmount } = render(<ObsView background={null} />);

    expect(document.documentElement.dataset.view).toBe("obs");
    expect(document.title).toBe("ALLTP Tracker stream view");

    unmount();
    expect(document.documentElement.dataset.view).toBeUndefined();
  });

  it("paints the background it is given, and none otherwise", () => {
    const { unmount } = render(<ObsView background="#00ff00" />);
    expect(screen.getByTestId("obs-view")).toHaveStyle({
      backgroundColor: "#00ff00",
    });
    unmount();

    render(<ObsView background={null} />);
    expect(screen.getByTestId("obs-view").style.backgroundColor).toBe("");
  });

  it("sizes the grid from the viewport and follows its resizes", () => {
    resizeTo(1920, 1080);
    render(<ObsView background={null} />);

    // Six rows while the key cells are hidden: 1080 / 6 = 180 → 176
    expect(cssVar("--cell")).toBe("176px");
    expect(cssVar("--obs-left")).toBe("256px");
    expect(cssVar("--obs-top")).toBe("12px");

    resizeTo(512, 384);
    expect(cssVar("--cell")).toBe("64px");
    expect(cssVar("--obs-left")).toBe("0px");
  });

  it("refits when the key cells add their row", () => {
    resizeTo(512, 420);
    render(<ObsView background={null} />);
    expect(cssVar("--cell")).toBe("64px");

    act(() => useGameStore.getState().setBigKeysVisible(true));

    // Seven rows in 420 px: 60 of room, too far above 48 to snap
    expect(cssVar("--cell")).toBe("60px");
    expect(screen.getAllByTestId("grid-row")).toHaveLength(7);
  });

  it("takes a new version at once instead of offering it", () => {
    const apply = vi.fn();
    render(<ObsView background={null} />);
    expect(apply).not.toHaveBeenCalled();

    act(() => useUpdateStore.setState({ apply }));

    expect(apply).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("update-prompt")).not.toBeInTheDocument();
  });

  it("stops following the viewport once unmounted", () => {
    resizeTo(512, 384);
    const { unmount } = render(<ObsView background={null} />);
    const stage = screen.getByTestId("obs-view");
    unmount();

    resizeTo(1920, 1080);

    expect(stage.style.getPropertyValue("--cell")).toBe("64px");
  });
});
