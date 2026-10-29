import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MapPanel } from "@/games/alttpr/components/map/MapPanel";
import { getPreset } from "@/games/alttpr/data/presets";
import { analyzeNow } from "@/games/alttpr/hooks/useRunAnalysis";
import { useAnalysisStore } from "@/games/alttpr/stores/analysisStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import type { Progress } from "@/games/alttpr/stores/persistence";
import endGame from "../../../../../e2e/fixtures/end-game.json";

/** The browser tests' end of a run: go mode in logic. */
const END_GAME = endGame.state as Partial<Progress>;

describe("MapPanel", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      useAnalysisStore.setState({ analysis: null });
    });
  });

  it("shows the map, the checks or the run, as the player's tab says", async () => {
    const user = userEvent.setup();
    render(<MapPanel />);
    const mapTab = screen.getByRole("tab", { name: "Map" });
    const checksTab = screen.getByRole("tab", { name: "Checks" });
    expect(mapTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("map-tracker")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Map");

    await user.click(checksTab);

    expect(useGameStore.getState().mapView).toBe("checks");
    expect(screen.queryByTestId("map-tracker")).toBeNull();
    expect(screen.getByTestId("checks-panel")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Checks");

    // Automatic activation, wrapping round
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Run" })).toHaveFocus();
    expect(useGameStore.getState().mapView).toBe("run");
    expect(screen.getByTestId("run-panel")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Run");
    await user.keyboard("{ArrowRight}");
    expect(mapTab).toHaveFocus();
    expect(mapTab).toHaveAttribute("aria-selected", "true");
    expect(checksTab).toHaveAttribute("tabindex", "-1");
  });

  it("keeps the view a preference: a new game leaves it", () => {
    act(() => useGameStore.getState().setMapView("checks"));
    act(() => useGameStore.getState().reset());
    render(<MapPanel />);

    expect(screen.getByTestId("checks-panel")).toBeInTheDocument();
  });

  it("has an Entrances tab only while entrances are shuffled", async () => {
    act(() => useGameStore.getState().setMapView("entrances"));
    render(<MapPanel />);
    // A run without shuffled entrances shows the map instead
    expect(screen.queryByRole("tab", { name: "Entrances" })).toBeNull();
    expect(screen.getByTestId("map-tracker")).toBeInTheDocument();

    act(() => useGameStore.getState().applyPreset("crosskeys"));
    expect(screen.getByRole("tab", { name: "Entrances" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByTestId("entrances-panel")).toBeInTheDocument();
  });

  it("says why every check is maybe in a run whose logic is not modelled", () => {
    render(<MapPanel />);
    expect(screen.queryByTestId("logic-note")).not.toBeInTheDocument();

    // Crosskeys with its keys in their dungeons: the entrance randomizer
    // keeps them there, which the tracker does not track
    act(() => {
      useGameStore.getState().applyPreset("crosskeys");
      useGameStore.getState().updateSettings({ dungeonItems: "mcs" });
    });
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "The tracker has no logic for Crossworld entrances with dungeon items kept in their dungeons yet: every check shows as maybe.",
    );
    expect(screen.queryByTestId("go-mode")).not.toBeInTheDocument();
  });

  it("says a glitched seed's logic is not modelled, and shows no marker in logic", () => {
    act(() =>
      useGameStore.getState().applyRun("open", {
        ...getPreset("open").settings,
        glitches: "overworld_glitches",
      }),
    );
    render(<MapPanel />);

    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "The tracker has no logic for Overworld Glitches yet: every check shows as maybe.",
    );
    expect(screen.getByTestId("marker-sahasrahlas-hut")).toHaveAccessibleName(
      /: maybe available$/,
    );
    expect(screen.queryByTestId("go-mode")).not.toBeInTheDocument();
  });

  it("says whose logic a Door Randomizer seed borrows, and names what it cannot model", () => {
    act(() => useGameStore.getState().applyPreset("door-crosskeys"));
    render(<MapPanel />);
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "The logic follows the entrances you noted",
    );
    expect(screen.getByTestId("logic-note-door")).toHaveTextContent(
      "Door Randomizer seed: entrance logic from the ALttP Entrance Randomizer until DR's own is ported.",
    );

    act(() => useGameStore.getState().updateDoorSettings({ pottery: "keys" }));
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "The tracker has no logic for shuffled key drops with keys outside their dungeons yet: every check shows as maybe.",
    );
    expect(screen.queryByTestId("logic-note-door")).not.toBeInTheDocument();

    act(() => useGameStore.getState().applyPreset("door-randomizer"));
    expect(screen.queryByTestId("logic-note")).not.toBeInTheDocument();
    expect(screen.getByTestId("logic-note-door")).toHaveTextContent(
      "Door Randomizer seed: dungeon logic from alttpr.com's v31 until DR's own is ported.",
    );
  });

  it("names the entrance shuffle as the cause in an Open run, not the run type", () => {
    act(() =>
      useGameStore.getState().applyRun("open", {
        ...getPreset("open").settings,
        entranceShuffle: "full",
      }),
    );
    render(<MapPanel />);
    const note = screen.getByTestId("logic-note");
    expect(note).toHaveTextContent(
      "The tracker has no logic for Full entrance shuffle yet: every check shows as maybe.",
    );
    expect(note).not.toHaveTextContent("Open runs");
  });

  it("names every cause when several apply", () => {
    act(() =>
      useGameStore.getState().applyRun("open", {
        ...getPreset("open").settings,
        entranceShuffle: "simple",
        glitches: "no_logic",
      }),
    );
    render(<MapPanel />);
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "The tracker has no logic for No Logic and Simple entrance shuffle yet: every check shows as maybe.",
    );
  });

  it("says shuffled bosses behind shuffled entrances are not modelled", () => {
    act(() => {
      useGameStore.getState().applyPreset("crosskeys");
      useGameStore.getState().updateSettings({ bossShuffle: "full" });
    });
    render(<MapPanel />);
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "The tracker has no logic for shuffled bosses behind Crossworld entrances yet: every check shows as maybe.",
    );
  });

  it("says a Crosskeys run's logic follows the entrances noted", () => {
    act(() => useGameStore.getState().applyPreset("crosskeys"));
    render(<MapPanel />);
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "The logic follows the entrances you noted: a check behind a door you have not noted stays out of logic.",
    );
  });

  describe("go mode", () => {
    it("says a Mystery run's goal is not known yet, and nothing to open", () => {
      act(() => useGameStore.getState().applyPreset("mystery"));
      render(<MapPanel />);
      const goMode = screen.getByTestId("go-mode");
      expect(goMode).toHaveTextContent("Go mode: goal unknown");
      expect(goMode.tagName).toBe("SPAN");

      act(() => useGameStore.getState().updateSettings({ goal: "ganon" }));
      expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
        "Go mode: not yet",
      );
    });

    it("is not yet on a fresh run, and says what it misses", async () => {
      const user = userEvent.setup();
      render(<MapPanel />);
      const goMode = screen.getByTestId("go-mode");
      expect(goMode).toHaveAccessibleName("Go mode: not yet");
      expect(goMode).toHaveTextContent("☆");
      expect(screen.getByTestId("go-mode-status")).toHaveTextContent(
        "Go mode: not yet",
      );
      expect(goMode).toHaveAttribute(
        "popovertarget",
        screen.getByTestId("go-mode-panel").id,
      );

      await user.click(goMode);
      expect(screen.getByTestId("go-mode-panel")).toHaveTextContent(
        "Working it out…",
      );
      act(() => analyzeNow());
      expect(screen.getByTestId("go-mode-panel")).toHaveTextContent(
        "More than three items away, crystals aside.",
      );
    });

    it("is in logic at the end of a run", () => {
      act(() => useGameStore.setState(END_GAME));
      render(<MapPanel />);

      expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
        "Go mode: in logic",
      );
      expect(screen.getByTestId("go-mode")).toHaveTextContent("★");
      expect(screen.getByTestId("go-mode-panel")).toHaveTextContent(
        "Every step to the goal is in logic.",
      );
    });

    it("is not shown for a goal without one", () => {
      act(() => useGameStore.getState().applyPreset("all-dungeons"));
      render(<MapPanel />);

      expect(screen.queryByTestId("go-mode")).toBeNull();
      expect(screen.queryByTestId("go-mode-status")).toBeNull();
    });
  });
});
