import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObsView } from "@/games/alttpr/ObsView";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
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
    expect(document.title).toBe("Rando Atlas stream view");

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

  it("sizes the band from the viewport and follows its resizes", () => {
    resizeTo(1920, 1080);
    render(<ObsView background={null} />);

    // Twelve columns, four rows while the key cells are hidden: 1920 / 12
    expect(cssVar("--cell")).toBe("160px");
    expect(cssVar("--obs-left")).toBe("0px");
    expect(cssVar("--obs-top")).toBe("220px");
    expect(screen.getAllByTestId("grid-row")).toHaveLength(4);
    expect(screen.getByTestId("item-bottlecontents1")).toBeInTheDocument();
    expect(screen.getByTestId("goal-goaltower")).toBeInTheDocument();

    resizeTo(768, 256);
    expect(cssVar("--cell")).toBe("64px");
    expect(cssVar("--obs-left")).toBe("0px");
  });

  it("refits when the key cells add their row and Hyrule Castle's column", () => {
    resizeTo(768, 320);
    render(<ObsView background={null} />);
    expect(cssVar("--cell")).toBe("64px");

    act(() => useGameStore.getState().setBigKeysVisible(true));

    // Thirteen columns in 768 px: 59 of room, too far above 48 to snap
    expect(cssVar("--cell")).toBe("58px");
    expect(screen.getAllByTestId("grid-row")).toHaveLength(5);
    expect(screen.getByTestId("key-label-hyrule-castle")).toHaveTextContent(
      "HC",
    );
  });

  it("folds the band in two on a page taller than wide", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      addEventListener: () => {},
      matches: query === "(orientation: portrait)",
      removeEventListener: () => {},
    }));
    resizeTo(390, 844);
    render(<ObsView background={null} />);

    // Six columns: the three rows of items and the dungeons cut in halves
    expect(screen.getAllByTestId("grid-row")).toHaveLength(8);
    expect(cssVar("--cell")).toBe("64px");
    vi.unstubAllGlobals();
  });

  it("keeps a row under the band for the run timer, when asked", () => {
    resizeTo(768, 320);
    const { unmount } = render(<ObsView background={null} />);
    // Four rows: the band centres in the room, and no timer is drawn
    expect(cssVar("--obs-top")).toBe("32px");
    expect(screen.queryByTestId("stream-timer")).toBeNull();
    unmount();

    render(<ObsView background={null} timer />);
    // Five: the band's four and the timer's, right under them
    expect(cssVar("--cell")).toBe("64px");
    expect(cssVar("--obs-top")).toBe("0px");
    expect(cssVar("--obs-timer-top")).toBe("256px");
    expect(screen.getByTestId("stream-timer")).toHaveAccessibleName(
      "Run timer: 0:00, not started",
    );
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
    resizeTo(768, 256);
    const { unmount } = render(<ObsView background={null} />);
    const stage = screen.getByTestId("obs-view");
    unmount();

    resizeTo(1920, 1080);

    expect(stage.style.getPropertyValue("--cell")).toBe("64px");
  });
});
