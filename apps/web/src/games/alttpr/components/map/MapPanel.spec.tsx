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

  it("has an Entrances tab for one of the Door Randomizer's own shuffles", () => {
    act(() => {
      useGameStore.getState().applyPreset("door-randomizer");
      useGameStore.getState().setMapView("entrances");
    });
    render(<MapPanel />);
    expect(screen.queryByRole("tab", { name: "Entrances" })).toBeNull();
    // A Lite seed leaves alttpr.com's shuffle at none
    act(() =>
      useGameStore.getState().updateDoorSettings({ doorEntrances: "lite" }),
    );
    expect(screen.getByRole("tab", { name: "Entrances" })).toBeInTheDocument();
  });

  it("says why every check is maybe in a run whose logic is not modelled", () => {
    render(<MapPanel />);
    expect(screen.queryByTestId("logic-note")).not.toBeInTheDocument();

    act(() => {
      useGameStore.getState().applyPreset("crosskeys");
      useGameStore.getState().updateSettings({ entranceShuffle: "insanity" });
    });
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "Not modelled yet: the Insanity entrance shuffle. Every check shows as maybe.",
    );
    expect(screen.queryByTestId("go-mode")).not.toBeInTheDocument();
  });

  it("reads a glitched seed behind shuffled entrances as the entrance randomizer's NoGlitches", () => {
    // vt hands it to the randomizer as noglitches, without the boots
    // (EntranceRandomizer.php:84-91, Randomizer.php:122-131)
    for (const glitches of [
      "overworld_glitches",
      "major_glitches",
      "no_logic",
    ] as const) {
      act(() =>
        useGameStore.getState().applyRun("crosskeys", {
          ...getPreset("crosskeys").settings,
          glitches,
        }),
      );
      const { unmount } = render(<MapPanel />);
      expect(screen.getByTestId("logic-note")).toHaveTextContent(
        "The logic follows the entrances you noted: a check behind a door you have not noted stays out of logic. A seed with shuffled entrances is filled without glitches, whatever its Glitches: the map shows what is in logic without them, and Link starts without the boots.",
      );
      unmount();
    }
  });

  it("reads an Overworld Glitches seed by its logic, the boots given", () => {
    act(() =>
      useGameStore.getState().applyRun("open", {
        ...getPreset("open").settings,
        glitches: "overworld_glitches",
      }),
    );
    render(<MapPanel />);

    expect(screen.queryByTestId("logic-note")).not.toBeInTheDocument();
    // Under the bridge with a fake flipper (South.php:131), in logic here
    expect(screen.getByTestId("marker-hobo")).toHaveAccessibleName(
      /: available$/,
    );
    act(() => useGameStore.getState().updateSettings({ glitches: "none" }));
    expect(screen.getByTestId("marker-hobo")).toHaveAccessibleName(
      /: out of logic$/,
    );
  });

  it("says what a Door Randomizer seed's logic rests on, and names what it cannot model", () => {
    act(() => {
      useGameStore.getState().applyPreset("door-crosskeys");
      useGameStore.getState().updateDoorSettings({ bombBag: false });
    });
    render(<MapPanel />);
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "The logic follows the entrances you noted",
    );
    expect(screen.getByTestId("logic-note-door")).toHaveTextContent(
      "Door Randomizer seed: the logic is DR's own (1.5.8).",
    );

    // Its key drops too, in DR's world on the entrances noted
    act(() => useGameStore.getState().updateDoorSettings({ pottery: "keys" }));
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "The logic follows the entrances you noted",
    );
    expect(screen.getByTestId("logic-note-door")).toBeInTheDocument();
    // A door shuffle: DR's world on the doors noted too
    act(() =>
      useGameStore.getState().updateDoorSettings({ doorShuffle: "basic" }),
    );
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "The logic follows the entrances you noted",
    );
    expect(screen.getByTestId("logic-note-door")).toHaveTextContent(
      "Its doors are shuffled: the logic follows the doors you note in the Doors tab",
    );

    // DR's glitched logics are not alttpr.com's, which the pack ports
    act(() => {
      useGameStore.getState().applyPreset("door-randomizer");
      useGameStore.getState().updateDoorSettings({ bombBag: false });
    });
    act(() =>
      useGameStore
        .getState()
        .updateSettings({ glitches: "overworld_glitches" }),
    );
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "Not modelled yet: the Door Randomizer's Overworld Glitches. Every check shows as maybe.",
    );
    expect(screen.queryByTestId("logic-note-door")).not.toBeInTheDocument();
    expect(screen.getByTestId("marker-hobo")).toHaveAccessibleName(
      "Hobo: maybe available",
    );

    act(() => useGameStore.getState().applyPreset("door-randomizer"));
    // Its bomb bag not known reads as on, the upgrade not known: modelled
    expect(screen.queryByTestId("logic-note")).not.toBeInTheDocument();
    act(() => useGameStore.getState().updateDoorSettings({ bombBag: false }));
    expect(screen.queryByTestId("logic-note")).not.toBeInTheDocument();
    expect(screen.getByTestId("logic-note-door")).toHaveTextContent(
      "Door Randomizer seed: the logic is DR's own (1.5.8).",
    );

    // Its Overworld fork: the fork's own world, but where it is not held
    act(() =>
      useGameStore.getState().updateDoorSettings({ randomizer: "owr" }),
    );
    // Its prizes and followers not known yet: named, never read as none
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "Not modelled yet: the prize shuffle not known yet (set it in Mode), the follower shuffle not known yet (set it in Mode) and the custom goals not known yet (set them in Mode). Every check shows as maybe.",
    );
    act(() =>
      useGameStore.getState().updateDoorSettings({
        customGoals: false,
        prizeShuffle: "none",
        shuffleFollowers: false,
      }),
    );
    expect(screen.getByTestId("logic-note-door")).toHaveTextContent(
      "Overworld Randomizer seed: the logic is the fork's own (0.8.0.2, on DR 1.5.7).",
    );
    act(() => useGameStore.getState().updateDoorSettings({ owLayout: "grid" }));
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "Not modelled yet: the Grid overworld layout.",
    );
    expect(screen.queryByTestId("logic-note-door")).not.toBeInTheDocument();
    act(() =>
      useGameStore.getState().updateDoorSettings({ owLayout: "vanilla" }),
    );
    // A Mystery run's hidden settings: not modelled until set, never v31's
    act(() => {
      useGameStore.getState().updateDoorSettings({ randomizer: "dr" });
      useGameStore.getState().hideSetting("goal");
    });
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "Not modelled yet: a Door Randomizer seed with hidden settings (set them in Mode). Every check shows as maybe.",
    );
    expect(screen.queryByTestId("logic-note-door")).not.toBeInTheDocument();
  });

  it("names the entrance shuffle as the cause in an Open run, not the run type", () => {
    act(() =>
      useGameStore.getState().applyRun("open", {
        ...getPreset("open").settings,
        entranceShuffle: "insanity",
      }),
    );
    render(<MapPanel />);
    const note = screen.getByTestId("logic-note");
    expect(note).toHaveTextContent(
      "Not modelled yet: the Insanity entrance shuffle. Every check shows as maybe.",
    );
    expect(note).not.toHaveTextContent("Open runs");
  });

  it("follows the entrances noted in a Simple, Restricted or Full run with its keys wild", () => {
    for (const entranceShuffle of ["simple", "restricted", "full"] as const) {
      act(() =>
        useGameStore.getState().applyRun("crosskeys", {
          ...getPreset("crosskeys").settings,
          entranceShuffle,
        }),
      );
      const { unmount } = render(<MapPanel />);
      expect(screen.getByTestId("logic-note")).toHaveTextContent(
        "The logic follows the entrances you noted",
      );
      unmount();
    }
  });

  it("names every cause when several apply", () => {
    act(() =>
      useGameStore.getState().applyRun("open", {
        ...getPreset("open").settings,
        entranceShuffle: "insanity",
        mode: "inverted",
      }),
    );
    render(<MapPanel />);
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "Not modelled yet: the Insanity entrance shuffle and shuffled entrances in the Inverted world. Every check shows as maybe.",
    );
  });

  it("says a No Logic seed promises no route, and what the map shows", () => {
    act(() =>
      useGameStore.getState().applyRun("open", {
        ...getPreset("open").settings,
        glitches: "no_logic",
      }),
    );
    render(<MapPanel />);
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "No Logic: the seed promises no route, so nothing is in logic. The map shows what you can reach without glitches (set under Played with in Mode). A key may sit behind its own door: a key door stays maybe until every spot its key may sit in is reached, or you mark its keys (Show key cells).",
    );
  });

  it("tells a Mystery run to set its entrances, then its glitches", () => {
    act(() => useGameStore.getState().applyPreset("mystery"));
    render(<MapPanel />);
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "The entrances are not set yet: they may be shuffled, so every check shows as maybe until you set Entrances in Mode.",
    );
    act(() =>
      useGameStore.getState().updateSettings({ entranceShuffle: "none" }),
    );
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "The glitches are not set yet: a check only a glitched logic reaches, or whose key may sit behind its own door (as in No Logic), shows as maybe until you set Glitches in Mode.",
    );
    act(() => useGameStore.getState().updateSettings({ glitches: "none" }));
    expect(screen.queryByTestId("logic-note")).not.toBeInTheDocument();
  });

  it("models shuffled bosses behind shuffled entrances", () => {
    act(() => {
      useGameStore.getState().applyPreset("crosskeys");
      useGameStore.getState().updateSettings({ bossShuffle: "full" });
    });
    render(<MapPanel />);
    expect(screen.getByTestId("logic-note")).toHaveTextContent(
      "The logic follows the entrances you noted: a check behind a door you have not noted stays out of logic.",
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

      // Its entrances not known yet, every check is maybe: no go mode
      act(() => useGameStore.getState().updateSettings({ goal: "ganon" }));
      expect(screen.queryByTestId("go-mode")).toBeNull();
      act(() =>
        useGameStore.getState().updateSettings({ entranceShuffle: "none" }),
      );
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
