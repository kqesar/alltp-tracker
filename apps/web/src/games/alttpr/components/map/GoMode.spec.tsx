import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { GoMode } from "@/games/alttpr/components/map/GoMode";
import type { ItemState } from "@/games/alttpr/data/items";
import type { RunSettings } from "@/games/alttpr/data/presets";
import { analyzeNow } from "@/games/alttpr/hooks/useRunAnalysis";
import { analyzeRun, type GoModeLeft } from "@/games/alttpr/logic/missing";
import type { Need } from "@/games/alttpr/logic/needs";
import { solutionOf } from "@/games/alttpr/logic/solution";
import { useAnalysisStore } from "@/games/alttpr/stores/analysisStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import endGame from "../../../../../e2e/fixtures/end-game.json";

/** The browser tests' end of a run, with these cells and settings. */
const setRun = (
  items: Partial<ItemState>,
  settings: Partial<RunSettings> = {},
) =>
  act(() =>
    useGameStore.setState({
      items: { ...endGame.state.items, ...items } as ItemState,
      medallions: endGame.state.medallions,
      settings: { ...(endGame.state.settings as RunSettings), ...settings },
      smallKeys: endGame.state.smallKeys,
    }),
  );

/** The run's analysis, its go mode replaced by `goMode`. */
const analyzedAs = (goMode: GoModeLeft) => {
  const state = useGameStore.getState();
  act(() =>
    useAnalysisStore.setState({
      analysis: { ...analyzeRun(solutionOf(state), state.settings), goMode },
    }),
  );
};

const need = (label: string): Need => ({ key: label, label });

const openPanel = async () => {
  await userEvent.setup().click(screen.getByTestId("go-mode"));
  return screen.getByTestId("go-mode-panel");
};

describe("GoMode", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      useAnalysisStore.setState({ analysis: null });
    });
  });

  it("lists the items of the one way left, and counts them on the button", async () => {
    setRun({
      boss7: 0,
      boss8: 0,
      boss9: 0,
      glove: 1,
      moonpearl: false,
      sword: 1,
    });
    render(<GoMode />);
    expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
      "Go mode: not yet",
    );
    act(() => analyzeNow());

    // The crystals missing too are the board's to count, not the list's
    expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
      "Go mode: 3 items left",
    );
    const left = within(await openPanel()).getByTestId("go-mode-left");
    expect(left).toHaveTextContent(/^Missing, crystals aside:/);
    const items = within(left).getAllByRole("listitem", { hidden: true });
    expect(items.map((item) => item.textContent)).toEqual([
      "Titan's Mitt",
      "Moon Pearl",
      "Master Sword",
    ]);
    // Each with the grid's sprite, decorative beside its name
    for (const item of items) {
      expect(
        within(item).getByRole("presentation", { hidden: true }),
      ).toHaveAttribute("src", expect.stringMatching(/\.png$/));
    }
    // The state itself is what the live region says, not the count
    expect(screen.getByTestId("go-mode-status")).toHaveTextContent(
      "Go mode: not yet",
    );
  });

  it("gives each way a row when there are several", async () => {
    setRun({ firerod: false, lantern: false });
    render(<GoMode />);
    act(() => analyzeNow());

    expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
      "Go mode: 1 item left",
    );
    const panel = await openPanel();
    expect(panel).toHaveTextContent("Missing, crystals aside, one of these:");
    expect(
      within(panel)
        .getAllByTestId("go-mode-way")
        .map((way) => way.textContent),
    ).toEqual(["Fire Rod", "Lantern"]);
    expect(within(panel).queryByTestId("go-mode-more")).toBeNull();
  });

  it("shows three ways, the others behind a disclosure", async () => {
    render(<GoMode />);
    analyzedAs({
      kind: "items",
      ways: {
        sets: [
          [need("Hammer")],
          [need("Hookshot")],
          [need("Moon Pearl"), need("Power Glove")],
          [need("Bow"), need("Lantern")],
          [need("Cape"), need("Fire Rod")],
        ],
        truncated: true,
      },
    });
    const panel = await openPanel();

    const rows = within(panel).getAllByTestId("go-mode-way");
    expect(rows).toHaveLength(5);
    const more = within(panel).getByTestId("go-mode-more");
    expect(more).not.toHaveAttribute("open");
    expect(within(more).getAllByTestId("go-mode-way")).toHaveLength(2);
    expect(within(more).getByText("2 more ways")).toBeInTheDocument();
    expect(panel).toHaveTextContent("Others, with more items, not listed.");
    expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
      "Go mode: 1 item left",
    );
  });

  it("says when only crystals are left", async () => {
    setRun({ boss7: 0, boss8: 0, boss9: 0 });
    render(<GoMode />);
    act(() => analyzeNow());

    expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
      "Go mode: crystals left",
    );
    expect(await openPanel()).toHaveTextContent("Only crystals left.");
  });

  it("keeps the last count while the next analysis is pending, never the list", async () => {
    setRun({ firerod: false, lantern: false, moonpearl: false });
    render(<GoMode />);
    act(() => analyzeNow());
    expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
      "Go mode: 2 items left",
    );
    const panel = await openPanel();

    act(() => useGameStore.getState().setItem("moonpearl", true));
    expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
      "Go mode: 2 items left",
    );
    expect(panel).toHaveTextContent("Working it out…");

    act(() => analyzeNow());
    expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
      "Go mode: 1 item left",
    );
  });

  it("says what puts a possible go mode in logic, its state on the button", async () => {
    setRun(
      { hearts: 0, sword: 1 },
      { hidden: ["swordless", "itemPlacement", "crystalsGanon"] },
    );
    render(<GoMode />);
    act(() => analyzeNow());

    expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
      "Go mode: possible",
    );
    const left = within(await openPanel()).getByTestId("go-mode-left");
    expect(left).toHaveTextContent(/^In logic with, crystals aside:/);
    expect(
      within(left)
        .getAllByRole("listitem", { hidden: true })
        .map((item) => item.textContent),
    ).toEqual(["12 hearts", "Tempered Sword"]);
  });

  it("says in a sentence what no list can", async () => {
    render(<GoMode />);
    act(() => analyzeNow());
    const panel = await openPanel();
    expect(panel).toHaveTextContent(
      "More than three items away, crystals aside.",
    );
    expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
      "Go mode: not yet",
    );

    for (const [goMode, words] of [
      [
        { kind: "nothing" },
        "Nothing left to get but dungeon keys, which may sit where you cannot reach yet.",
      ],
      [
        { kind: "unknown" },
        "No item puts it in logic yet: it hangs on a setting not known yet or on where an item sits.",
      ],
      [{ kind: "door" }, "Behind a door you have not noted."],
    ] as const) {
      analyzedAs(goMode);
      expect(panel, goMode.kind).toHaveTextContent(words);
      expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
        "Go mode: not yet",
      );
    }
  });

  it("says a go mode basic placement's margin alone holds back, and what is left", async () => {
    // Basic placement, 11 hearts on screen: Ganon's Tower waits for 12
    setRun({ hearts: 9 }, { itemPlacement: "basic" });
    render(<GoMode />);
    act(() => analyzeNow());

    expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
      "Go mode: outside Basic's margin",
    );
    expect(screen.getByTestId("go-mode-status")).toHaveTextContent(
      "Go mode: outside Basic's margin",
    );
    const panel = await openPanel();
    expect(within(panel).getByTestId("go-mode-margin")).toHaveTextContent(
      /^Doable now, outside Basic's safety margin:/,
    );
    const left = within(panel).getByTestId("go-mode-left");
    expect(left).toHaveTextContent(/^In logic with, crystals aside:12 hearts$/);
  });

  it("lists nothing once in go mode", async () => {
    setRun({});
    render(<GoMode />);
    act(() => analyzeNow());

    expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
      "Go mode: in logic",
    );
    const panel = await openPanel();
    expect(panel).toHaveTextContent("Every step to the goal is in logic.");
    expect(within(panel).queryByRole("list", { hidden: true })).toBeNull();
  });
});
