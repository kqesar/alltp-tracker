import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ChecksPanel } from "@/games/alttpr/components/map/ChecksPanel";
import { analyzeNow } from "@/games/alttpr/hooks/useRunAnalysis";
import { useAnalysisStore } from "@/games/alttpr/stores/analysisStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const row = (id: string) => screen.queryByTestId(`check-row-${id}`);
const filter = (state: string) => screen.getByTestId(`checks-filter-${state}`);

describe("ChecksPanel", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      useAnalysisStore.setState({ analysis: null });
    });
  });

  it("shows what can be done now or maybe at first, with each state's count", () => {
    render(<ChecksPanel />);

    expect(row("sahasrahlas-hut/left")).toHaveTextContent("Available");
    expect(row("kings-tomb")).toBeNull();
    expect(filter("available")).toBeChecked();
    expect(filter("possible")).toBeChecked();
    expect(filter("unavailable")).not.toBeChecked();
    expect(filter("opened").closest("label")).toHaveTextContent("Checked0");
    const shown = screen.getAllByTestId(/^check-row-/).length;
    expect(screen.getByTestId("checks-summary")).toHaveTextContent(
      `${shown} checks shown`,
    );
    expect(screen.getByTestId("checks-summary")).toHaveAttribute(
      "role",
      "status",
    );
  });

  it("filters by state, zone and words", async () => {
    const user = userEvent.setup();
    render(<ChecksPanel />);

    await user.click(filter("unavailable"));
    expect(row("kings-tomb")).toHaveTextContent("Out of logic");

    await user.selectOptions(
      screen.getByTestId("checks-zone"),
      "North East Light World",
    );
    expect(row("kings-tomb")).toBeNull();
    expect(row("sahasrahlas-hut/left")).not.toBeNull();
    expect(filter("available").closest("label")).toHaveTextContent(
      "Available3",
    );

    await user.selectOptions(screen.getByTestId("checks-zone"), "");
    await user.type(screen.getByTestId("checks-search"), "kakariko well");
    expect(screen.getAllByTestId(/^check-row-/)).toHaveLength(5);

    await user.type(screen.getByTestId("checks-search"), " nowhere");
    expect(screen.queryAllByTestId(/^check-row-/)).toHaveLength(0);
    expect(screen.getByTestId("checks-summary")).toHaveTextContent(
      "No check to show",
    );
  });

  it("checks a location in the run, which one undo takes back", async () => {
    const user = userEvent.setup();
    render(<ChecksPanel />);
    await user.click(filter("opened"));
    const box = within(row("sahasrahlas-hut/left") as HTMLElement).getByRole(
      "checkbox",
      { name: "Sahasrahla's Hut - Left" },
    );

    await user.click(box);

    expect(useGameStore.getState().checked).toEqual({
      "sahasrahlas-hut/left": true,
    });
    expect(box).toBeChecked();
    expect(row("sahasrahlas-hut/left")).toHaveTextContent("Checked");

    act(() => useGameStore.getState().undo());
    expect(box).not.toBeChecked();
  });

  it("shows a cleared dungeon's checks done, and keeps them so", async () => {
    const user = userEvent.setup();
    act(() =>
      useGameStore.setState((state) => ({
        items: { ...state.items, chest0: 0 },
      })),
    );
    render(<ChecksPanel />);
    await user.click(filter("opened"));

    const eastern = screen.getByRole("region", { name: /^Eastern Palace/ });
    expect(eastern).toHaveTextContent("done");
    for (const box of within(eastern).getAllByRole("checkbox")) {
      expect(box).toBeChecked();
      expect(box).toBeDisabled();
    }
  });

  it("keeps a cleared dungeon's boss check open until the boss is beaten", async () => {
    const user = userEvent.setup();
    act(() =>
      useGameStore.setState((state) => ({
        items: { ...state.items, chest0: 0 },
      })),
    );
    render(<ChecksPanel />);
    await user.click(filter("opened"));
    await user.click(filter("unavailable"));
    const boss = () =>
      within(row("eastern-palace/boss") as HTMLElement).getByRole("checkbox");

    // The counter counts items: the boss is still to beat, and no box can
    // say otherwise, so it is left to the boss cell
    expect(boss()).not.toBeChecked();
    expect(boss()).toBeDisabled();
    expect(row("eastern-palace/compass-chest")).toHaveTextContent("Checked");

    act(() => useGameStore.getState().handleItemClick("boss0"));

    expect(boss()).toBeChecked();
    expect(boss()).toBeDisabled();
  });

  it("names a dungeon's items left beside it", () => {
    render(<ChecksPanel />);

    expect(
      screen.getByRole("heading", { name: /^Eastern Palace/ }),
    ).toHaveTextContent("3 items left, maybe");
  });

  it("says why a check is not available, once asked", async () => {
    const user = userEvent.setup();
    render(<ChecksPanel />);
    await user.click(filter("unavailable"));
    const why = screen.getByTestId("check-why-library");
    expect(why).toHaveAccessibleName("Why? Library");
    expect(why).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("check-why-sahasrahlas-hut/left")).toBeNull();

    await user.click(why);

    expect(why).toHaveAttribute("aria-expanded", "true");
    expect(row("library")).toHaveTextContent("Working it out…");
    act(() => analyzeNow());
    expect(row("library")).toHaveTextContent("Missing: Pegasus Boots");
  });

  it("offers no why under logic it does not model, every check maybe", () => {
    // Crosskeys with its keys kept in their dungeons
    act(() => {
      useGameStore.getState().applyPreset("crosskeys");
      useGameStore.getState().updateSettings({ dungeonItems: "mcs" });
    });
    render(<ChecksPanel />);

    expect(row("library")).toHaveTextContent("Maybe");
    expect(screen.queryByTestId("check-why-library")).toBeNull();
    expect(filter("unavailable").closest("label")).toHaveTextContent(
      "Out of logic0",
    );
    expect(screen.queryByTestId("zone-why-eastern-palace")).toBeNull();
  });

  describe("what a dungeon is missing", () => {
    it("opens on its heading, grouped, once the analysis is in", async () => {
      const user = userEvent.setup();
      render(<ChecksPanel />);
      await user.click(filter("unavailable"));
      const ask = screen.getByTestId("zone-why-palace-of-darkness");
      expect(ask).toHaveAccessibleName("What's missing? Palace of Darkness");
      expect(ask).toHaveAttribute("aria-expanded", "false");
      expect(
        screen.getByTestId("zone-missing-palace-of-darkness"),
      ).not.toBeVisible();
      // Only a dungeon has one
      expect(screen.queryByTestId("check-why-sahasrahlas-hut/left")).toBeNull();

      await user.click(ask);

      expect(ask).toHaveAttribute("aria-expanded", "true");
      const body = screen.getByTestId("zone-missing-palace-of-darkness");
      expect(body).toBeVisible();
      expect(body).toHaveTextContent("Working it out…");
      expect(ask).toHaveAttribute("aria-controls", body.id);

      act(() => analyzeNow());

      expect(body).not.toHaveTextContent("Working it out…");
      const groups = within(body)
        .getAllByTestId("missing-group")
        .map((group) => group.textContent);
      // Nothing in logic yet: every check is behind something
      expect(groups.join()).toMatch(/Agahnim \+ Moon Pearl/);
      expect(groups.join()).toMatch(/Dark Basement ×2 \(2 checks\)/);
      expect(groups.at(-1)).toMatch(/: Boss$/);
    });

    it("closes again, and reads the run as it moves", async () => {
      const user = userEvent.setup();
      act(() => analyzeNow());
      render(<ChecksPanel />);
      const ask = screen.getByTestId("zone-why-eastern-palace");
      const body = screen.getByTestId("zone-missing-eastern-palace");

      await user.click(ask);
      expect(body).toHaveTextContent("Boss");
      await user.click(ask);
      expect(body).not.toBeVisible();
      expect(ask).toHaveAttribute("aria-expanded", "false");
    });

    it("is offered for a dungeon whose counter is 0 only while its boss lives", async () => {
      const user = userEvent.setup();
      act(() =>
        useGameStore.setState((state) => ({
          items: { ...state.items, chest0: 0 },
        })),
      );
      render(<ChecksPanel />);
      await user.click(filter("opened"));
      await user.click(filter("unavailable"));

      // Its counter is at 0, but Armos Knights are not beaten
      expect(
        screen.getByRole("region", { name: /^Eastern Palace/ }),
      ).toBeVisible();
      expect(screen.getByTestId("zone-why-eastern-palace")).toBeInTheDocument();

      act(() => useGameStore.getState().handleItemClick("boss0"));

      expect(screen.queryByTestId("zone-why-eastern-palace")).toBeNull();
      expect(screen.getByTestId("zone-why-desert-palace")).toBeInTheDocument();
    });

    it("counts every check of the dungeon, whatever the filters show", async () => {
      const user = userEvent.setup();
      act(() => analyzeNow());
      render(<ChecksPanel />);
      // Only what is available is listed under Eastern Palace
      await user.click(filter("possible"));
      expect(row("eastern-palace/big-key-chest")).toBeNull();

      await user.click(screen.getByTestId("zone-why-eastern-palace"));

      expect(
        screen.getByTestId("zone-missing-eastern-palace"),
      ).toHaveTextContent("Big Key Chest");
    });
  });
});
