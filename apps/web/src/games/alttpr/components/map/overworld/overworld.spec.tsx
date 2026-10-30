import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MapPanel } from "@/games/alttpr/components/map/MapPanel";
import OverworldPanel from "@/games/alttpr/components/map/overworld/OverworldPanel";
import { flipGroupsOf } from "@/games/alttpr/data/doorRando";
import { getPreset, type RunSettings } from "@/games/alttpr/data/presets";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** An OWR run held in the fork's world, its overworld left as it is. */
const OWR: RunSettings = {
  ...getPreset("door-randomizer").settings,
  bombBag: false,
  customGoals: false,
  owCrossed: "none",
  owFluteShuffle: "vanilla",
  owLayout: "vanilla",
  owMixed: false,
  owrVersion: "0.8.0.2",
  owWhirlpool: false,
  prizeShuffle: "none",
  randomizer: "owr",
  shuffleFollowers: false,
};
const run = (change: Partial<RunSettings>) =>
  act(() =>
    useGameStore.getState().applyRun("door-randomizer", { ...OWR, ...change }),
  );
const store = () => useGameStore.getState();

describe("the Overworld tab", () => {
  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  it("shows only while an OWR run shuffles its whirlpools or flute spots", async () => {
    const user = userEvent.setup();
    run({});
    const { unmount } = render(<MapPanel />);
    expect(screen.queryByRole("tab", { name: "Overworld" })).toBeNull();
    act(() => store().updateDoorSettings({ owWhirlpool: true }));
    await user.click(screen.getByRole("tab", { name: "Overworld" }));
    expect(await screen.findByTestId("overworld-panel")).toBeInTheDocument();
    expect(store().mapView).toBe("overworld");
    // Whirlpools vanilla again: the map, the view kept for the next run
    act(() => store().updateDoorSettings({ owWhirlpool: false }));
    expect(screen.queryByTestId("overworld-panel")).toBeNull();
    expect(screen.getByRole("tab", { name: "Map" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // DR itself has neither: never the tab
    act(() =>
      store().updateDoorSettings({
        owFluteShuffle: "random",
        randomizer: "dr",
      }),
    );
    expect(screen.queryByRole("tab", { name: "Overworld" })).toBeNull();
    unmount();
  });

  it("notes where a whirlpool leads, both ways, one undo step", async () => {
    const user = userEvent.setup();
    run({ owWhirlpool: true });
    render(<OverworldPanel />);
    // The dark world's two, a pool of two, are paired with no note
    expect(screen.getByTestId("overworld-summary")).toHaveTextContent(
      "2 of 8 whirlpools noted",
    );
    expect(
      screen.getByTestId("whirlpool-row-Qirn Jump Whirlpool"),
    ).toHaveTextContent("leads to Bomber Corner Whirlpool (always)");
    // Flute spots not moved: not offered
    expect(screen.queryByTestId("flute-screen-18")).toBeNull();
    const pool = screen.getByRole("combobox", {
      name: "C Whirlpool: leads to",
    });
    await user.selectOptions(pool, ["Zora Whirlpool"]);
    expect(store().overworld.whirlpools).toEqual({
      "C Whirlpool": "Zora Whirlpool",
      "Zora Whirlpool": "C Whirlpool",
    });
    expect(
      screen.getByRole("combobox", { name: "Zora Whirlpool: leads to" }),
    ).toHaveValue("C Whirlpool");
    expect(screen.getByTestId("overworld-summary")).toHaveTextContent(
      "4 of 8 whirlpools noted",
    );
    // A whirlpool never leads into itself
    expect(
      [...pool.querySelectorAll("option")].map((option) => option.value),
    ).not.toContain("C Whirlpool");
    act(() => store().undo());
    expect(store().overworld).toEqual({});
    expect(pool).toHaveValue("");
  });

  it("offers a whirlpool its own world's pool, every other once crossed or mixed", () => {
    const options = (name: string) =>
      [
        ...screen
          .getByRole("combobox", { name: `${name}: leads to` })
          .querySelectorAll("option"),
      ]
        .map((option) => option.value)
        .filter((value) => value !== "");
    run({ owWhirlpool: true });
    const { unmount } = render(<OverworldPanel />);
    // OverworldShuffle.py:378-391: light with light, dark with dark (the
    // two dark ones paired with no choice)
    expect(
      screen.queryByRole("combobox", { name: "Qirn Jump Whirlpool: leads to" }),
    ).toBeNull();
    expect(options("C Whirlpool")).toEqual([
      "River Bend Whirlpool",
      "Lake Hylia Whirlpool",
      "Zora Whirlpool",
      "Kakariko Pond Whirlpool",
      "Octoballoon Whirlpool",
    ]);
    unmount();
    for (const crossed of [
      { owCrossed: "unrestricted" as const },
      { owCrossed: "grouped" as const },
      { owMixed: true },
    ]) {
      run({ owWhirlpool: true, ...crossed });
      const view = render(<OverworldPanel />);
      expect(
        options("Qirn Jump Whirlpool"),
        JSON.stringify(crossed),
      ).toHaveLength(7);
      view.unmount();
    }
  });

  it("ticks the flute's screens, up to eight, by keyboard too", async () => {
    const user = userEvent.setup();
    run({ owFluteShuffle: "balanced" });
    render(<OverworldPanel />);
    expect(
      screen.queryByRole("combobox", { name: "C Whirlpool: leads to" }),
    ).toBeNull();
    const village = screen.getByRole("checkbox", { name: "Kakariko Village" });
    expect(village).toHaveAttribute("data-testid", "flute-screen-18");
    village.focus();
    await user.keyboard(" ");
    expect(store().overworld.flute).toEqual([0x18]);
    expect(screen.getByTestId("overworld-summary")).toHaveTextContent(
      "1 of 8 flute spots noted",
    );
    // Eight noted: the rest wait until one is taken off
    for (const id of ["00", "02", "03", "05", "07", "0a", "0f"])
      await user.click(screen.getByTestId(`flute-screen-${id}`));
    expect(store().overworld.flute).toHaveLength(8);
    expect(screen.getByTestId("flute-screen-3f")).toBeDisabled();
    expect(village).toBeEnabled();
    await user.click(village);
    expect(store().overworld.flute).not.toContain(0x18);
    expect(screen.getByTestId("flute-screen-3f")).toBeEnabled();
  });

  it("names an Inverted world's flute screens by the dark world, where the bird lands", () => {
    run({ mode: "inverted", owFluteShuffle: "random" });
    render(<OverworldPanel />);
    expect(screen.getByTestId("flute-screen-18")).toHaveAccessibleName(
      "Village of Outcasts",
    );
    expect(screen.getByTestId("flute-screen-28")).toHaveAccessibleName(
      "Digging Game",
    );
  });

  it("notes whether each edge pair of a crossed overworld crosses, by keyboard too", async () => {
    const user = userEvent.setup();
    run({ owCrossed: "grouped" });
    render(<OverworldPanel />);
    expect(screen.getByTestId("overworld-summary")).toHaveTextContent(
      "0 of 67 edge pairs noted",
    );
    expect(screen.queryByTestId("flute-screen-18")).toBeNull();
    const pair = screen.getByRole("combobox", {
      name: "Lost Woods to Lost Woods Pass (west): world",
    });
    pair.focus();
    await user.selectOptions(pair, ["crosses"]);
    expect(store().overworld.crossings).toEqual({ "Lost Woods SW": true });
    await user.selectOptions(pair, ["stays"]);
    expect(store().overworld.crossings).toEqual({ "Lost Woods SW": false });
    expect(screen.getByTestId("overworld-summary")).toHaveTextContent(
      "1 of 67 edge pairs noted",
    );
    await user.selectOptions(pair, [""]);
    expect(store().overworld).toEqual({});
    act(() => store().undo());
    expect(pair).toHaveValue("stays");
  });

  it("notes Mixed's screens a group at a time, by keyboard too", async () => {
    const user = userEvent.setup();
    run({ owMixed: true });
    render(<OverworldPanel />);
    // define_tile_groups' groups that may flip (the sanctuary's never)
    expect(screen.getByTestId("overworld-summary")).toHaveTextContent(
      "0 of 27 screen groups noted",
    );
    expect(screen.queryByTestId("flip-row-13")).toBeNull();
    const lostWoods = screen.getByRole("combobox", {
      name: "Lost Woods, Stone Bridge, Master Sword Meadow: flipped",
    });
    expect(lostWoods.closest("li")).toHaveAttribute(
      "data-testid",
      "flip-row-00",
    );
    lostWoods.focus();
    await user.selectOptions(lostWoods, ["flipped"]);
    expect(store().overworld.flips).toEqual({
      "0": true,
      "45": true,
      "128": true,
    });
    expect(screen.getByTestId("overworld-summary")).toHaveTextContent(
      "1 of 27 screen groups noted",
    );
    await user.selectOptions(lostWoods, ["stands"]);
    expect(store().overworld.flips?.["45"]).toBe(false);
    await user.selectOptions(lostWoods, [""]);
    expect(store().overworld).toEqual({});
    act(() => store().undo());
    expect(lostWoods).toHaveValue("stands");
    // A whirlpool select offers the seven others: Mixed's pools wait on flips
    expect(screen.queryByTestId("whirlpool-row-C Whirlpool")).toBeNull();
  });

  it("shows an uncrossed Mixed run's pool of two once its screens tell", async () => {
    const user = userEvent.setup();
    run({ owMixed: true, owWhirlpool: true });
    render(<OverworldPanel />);
    // Every whirlpool's world waits on its screen's flip: a select for each
    expect(
      screen.getByRole("combobox", { name: "Qirn Jump Whirlpool: leads to" }),
    ).toBeInTheDocument();
    for (const select of screen.getAllByRole("combobox", { name: /flipped$/ }))
      await user.selectOptions(select, ["stands"]);
    // Nothing flipped: the dark world's two, a pool of two (:380-391)
    expect(
      screen.getByTestId("whirlpool-row-Qirn Jump Whirlpool"),
    ).toHaveTextContent("leads to Bomber Corner Whirlpool (always)");
    expect(screen.getByTestId("overworld-summary")).toHaveTextContent(
      "2 of 8 whirlpools noted",
    );
    // River Bend's screen flipped (Qirn Jump its twin): River Bend and
    // Bomber Corner are the dark world's two
    const group = flipGroupsOf(store().settings).find(({ screens }) =>
      screens.includes(0x15),
    );
    expect(group).toBeDefined();
    const id = (group?.screens[0] ?? 0).toString(16).padStart(2, "0");
    const select = within(screen.getByTestId(`flip-row-${id}`)).getByRole(
      "combobox",
    );
    await user.selectOptions(select, ["flipped"]);
    expect(
      screen.getByTestId("whirlpool-row-River Bend Whirlpool"),
    ).toHaveTextContent("leads to Bomber Corner Whirlpool (always)");
    expect(
      screen.getByRole("combobox", { name: "Qirn Jump Whirlpool: leads to" }),
    ).toBeInTheDocument();
  });

  it("names the flute screens as the tracker names places", () => {
    run({ owFluteShuffle: "random" });
    render(<OverworldPanel />);
    expect(screen.getByTestId("flute-screen-2c")).toHaveAccessibleName(
      "Link's House",
    );
    expect(screen.getByTestId("flute-screen-07")).toHaveAccessibleName(
      "Turtle Rock Pegs",
    );
  });
});
