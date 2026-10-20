import type { SessionStatus } from "@alltp/autotrack";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STATUSES, statusOf } from "@/autotrack/fixtures";
import {
  AutotrackControl,
  AutotrackLiveRegion,
  AutotrackMoreBadge,
} from "@/games/alttpr/components/autotrack/AutotrackControl";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";

/** The store as a running session leaves it, showing `status`. */
const show = (status: SessionStatus, active = true) =>
  act(() => useAutotrackStore.setState({ active, shown: status, status }));

const RACE = statusOf("connected", {
  race: {
    active: true,
    flag: "race",
    overridden: false,
    raceLegal: true,
    setting: "auto",
  },
});

beforeEach(() => {
  act(() =>
    useAutotrackStore.setState(useAutotrackStore.getInitialState(), true),
  );
});

describe("AutotrackControl", () => {
  it("names the status, and shows it as the dot's shape", () => {
    render(<AutotrackControl />);
    const button = screen.getByTestId("autotrack-button");
    const dot = () => screen.getByTestId("autotrack-dot");

    expect(button).toHaveAccessibleName("Autotracking, Off");
    expect(button).toHaveAttribute("title", "Autotracking: Off");
    expect(dot()).toHaveAttribute("data-phase", "off");

    show(STATUSES.connecting);
    expect(dot()).toHaveAttribute("data-phase", "busy");
    show(STATUSES["bridge-unreachable"]);
    expect(button).toHaveAccessibleName(
      "Autotracking, SNI isn't running, or the browser is blocking it",
    );
    expect(dot()).toHaveAttribute("data-phase", "problem");
    show(STATUSES.connected);
    expect(button).toHaveAccessibleName("Autotracking, Connected");
    expect(dot()).toHaveAttribute("data-phase", "on");
    expect(screen.queryByTestId("race-badge")).toBeNull();
  });

  it("shows the race-legal badge while Race Mode is on", () => {
    render(<AutotrackControl />);

    show(RACE);

    const badge = screen.getByTestId("race-badge");
    expect(badge).toHaveTextContent("Race-legal");
    expect(badge).toHaveAttribute(
      "title",
      "This is a race seed: the tracker reads only what races permit.",
    );
    expect(screen.getByTestId("autotrack-button")).toHaveAccessibleName(
      "Autotracking, Connected, race-legal",
    );
    // Not once it stops
    show(RACE, false);
    expect(screen.queryByTestId("race-badge")).toBeNull();
  });

  it("says when another tab of the tracker autotracks", () => {
    render(<AutotrackControl />);

    act(() =>
      useAutotrackStore.setState({
        active: true,
        elsewhere: true,
        shown: STATUSES.idle,
      }),
    );

    expect(screen.getByTestId("autotrack-button")).toHaveAccessibleName(
      "Autotracking, Running in another tab",
    );
    expect(screen.getByTestId("autotrack-dot")).toHaveAttribute(
      "data-phase",
      "off",
    );
  });

  it("says, when its code cannot load, to reload", () => {
    render(<AutotrackControl />);

    act(() => useAutotrackStore.setState({ unavailable: true }));

    expect(screen.getByTestId("autotrack-button")).toHaveAccessibleName(
      "Autotracking, Could not load: reload the page",
    );
    expect(screen.getByTestId("autotrack-dot")).toHaveAttribute(
      "data-phase",
      "problem",
    );
  });

  it("is an item of the More menu, its status after its name", () => {
    render(<AutotrackControl variant="menu" />);

    show(RACE);

    const item = screen.getByRole("menuitem");
    expect(item).toHaveAccessibleName("Autotracking, Connected, race-legal");
    expect(item).toHaveAttribute("data-testid", "toolbar-more-autotrack");
  });
});

describe("AutotrackControl's dialog", () => {
  /** How many times the dialog's module was fetched (evaluated). */
  let fetches = 0;

  beforeEach(() => {
    fetches = 0;
    vi.resetModules();
    vi.doMock(
      "@/games/alttpr/components/autotrack/AutotrackDialog",
      async (original) => {
        fetches++;
        return original();
      },
    );
  });

  afterEach(() => {
    vi.doUnmock("@/games/alttpr/components/autotrack/AutotrackDialog");
    vi.doUnmock("@/games/alttpr/stores/autotrackStore");
  });

  it("is fetched once a pointer or focus nears, and opens on a click only", async () => {
    const control = await import(
      "@/games/alttpr/components/autotrack/AutotrackControl"
    );
    render(<control.AutotrackControl />);
    const button = screen.getByTestId("autotrack-button");
    expect(fetches).toBe(0);

    fireEvent.pointerEnter(button);
    await waitFor(() => expect(fetches).toBe(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.focus(button);
    fireEvent.pointerDown(button);
    await userEvent.click(button);

    const dialog = await screen.findByRole("dialog", { name: "Autotracking" });
    expect(fetches).toBe(1);
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(dialog).not.toBeInTheDocument();
    // Its code is there now: it opens at once
    await userEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Autotracking" })).toBeVisible();
  });

  it("offers a reload when its code cannot be fetched", async () => {
    vi.doMock("@/games/alttpr/components/autotrack/AutotrackDialog", () => {
      throw new Error("offline");
    });
    const control = await import(
      "@/games/alttpr/components/autotrack/AutotrackControl"
    );
    // The page of the modules this test loaded afresh, not the one imported above
    const { page } = await import("@/components/autotrack/lazyDialog");
    const reload = vi.spyOn(page, "reload").mockImplementation(() => {});
    try {
      render(<control.AutotrackControl variant="menu" />);

      await userEvent.click(screen.getByRole("menuitem"));

      const dialog = await screen.findByRole("dialog", {
        name: "Autotracking",
      });
      expect(dialog).toHaveTextContent("Autotracking could not be loaded");
      await userEvent.click(screen.getByRole("button", { name: "Reload" }));
      expect(reload).toHaveBeenCalled();
      await userEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("dialog")).toBeNull();
    } finally {
      reload.mockRestore();
    }
  });
});

describe("AutotrackMoreBadge", () => {
  it("copies the dot for the eye alone", () => {
    render(<AutotrackMoreBadge />);
    show(STATUSES["no-device"]);

    const badge = screen.getByTestId("toolbar-more-badge");
    expect(badge).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("autotrack-dot")).toHaveAttribute(
      "data-phase",
      "problem",
    );
  });
});

describe("AutotrackLiveRegion", () => {
  it("says what autotracking did of its own after the status", () => {
    render(<AutotrackLiveRegion />);
    show(STATUSES.connected);

    act(() =>
      useAutotrackStore.setState({
        news: { repeated: false, text: "This seed is Keysanity: switched." },
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Autotracking: Connected. This seed is Keysanity: switched.",
    );
  });

  it("says when it connects, fails or stops, and keeps quiet in between", () => {
    render(<AutotrackLiveRegion />);
    const live = screen.getByRole("status");
    expect(live).toHaveTextContent(/^$/);

    show(STATUSES.idle);
    show(STATUSES.connecting);
    expect(live).toHaveTextContent(/^$/);
    show(STATUSES.connected);
    expect(live).toHaveTextContent("Autotracking: Connected");
    // Reconnecting after a drop: quiet until it knows how it went
    show(STATUSES.connecting);
    show(STATUSES.attaching);
    expect(live).toHaveTextContent("Autotracking: Connected");
    show(STATUSES["bridge-unreachable"]);
    expect(live).toHaveTextContent(
      "Autotracking: SNI isn't running, or the browser is blocking it",
    );
    // The browser's prompt wants the player
    show(STATUSES["local-network-prompt"]);
    expect(live).toHaveTextContent(
      "Autotracking: Allow the connection in the browser's prompt",
    );
    show(STATUSES.stopped, false);
    expect(live).toHaveTextContent("Autotracking: Off");
    // Waiting for another tab is no mere passage
    act(() =>
      useAutotrackStore.setState({
        active: true,
        elsewhere: true,
        shown: STATUSES.idle,
      }),
    );
    expect(live).toHaveTextContent("Autotracking: Running in another tab");
  });
});
