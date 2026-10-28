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

  it("puts a paid check's price in parentheses after its name, and in its names", async () => {
    const user = userEvent.setup();
    render(<ChecksPanel />);
    await user.click(filter("unavailable"));

    expect(row("bottle-merchant")).toHaveTextContent(
      "Bottle Merchant (100 rupees)",
    );
    expect(row("king-zora")).toHaveTextContent("King Zora (500 rupees)");
    expect(
      screen.getByRole("button", { name: "Why? King Zora (500 rupees)" }),
    ).toBeInTheDocument();
    expect(row("hobo")).not.toHaveTextContent("rupees");
  });

  it("says which trick opens a check, links its guide, and opens the Tricks dialog", async () => {
    const user = userEvent.setup();
    act(() =>
      useGameStore
        .getState()
        .setTricks({ enabled: true, techniques: ["fakeFlipper"] }),
    );
    render(<ChecksPanel />);
    await user.click(filter("trick"));

    await user.click(screen.getByTestId("check-why-hobo"));
    act(() => analyzeNow());

    expect(row("hobo")).toHaveTextContent(
      /Doable now with: Fake flipper.*Missing: Zora's Flippers/,
    );
    const link = within(row("hobo") as HTMLElement).getByRole("link", {
      name: /^Fake flipper/,
    });
    expect(link).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=0YzkiaY3eys&t=874s",
    );
    expect(link).toHaveAttribute("target", "_blank");

    expect(screen.queryByRole("dialog", { name: "Tricks" })).toBeNull();
    await user.click(screen.getByTestId("check-about-tricks-hobo"));
    expect(screen.getByRole("dialog", { name: "Tricks" })).toBeInTheDocument();
  });

  it("names the trick under a check it opens, in its checkbox's name too", async () => {
    const user = userEvent.setup();
    act(() =>
      useGameStore
        .getState()
        .setTricks({ enabled: true, techniques: ["fakeFlipper"] }),
    );
    render(<ChecksPanel />);
    await user.click(filter("trick"));
    await user.click(filter("unavailable"));
    // Nothing while the analysis is pending
    expect(screen.queryByTestId("check-trick-hobo")).toBeNull();

    act(() => analyzeNow());

    expect(screen.getByTestId("check-trick-hobo")).toHaveTextContent(
      "Fake flipper",
    );
    expect(
      within(row("hobo") as HTMLElement).getByRole("checkbox"),
    ).toHaveAccessibleName("Hobo, doable with Fake flipper");
    // A check out of logic that no trick opens names none
    expect(row("library")).not.toBeNull();
    expect(screen.queryByTestId("check-trick-library")).toBeNull();
  });

  it("offers no About tricks for a check no trick opens", async () => {
    const user = userEvent.setup();
    act(() =>
      useGameStore
        .getState()
        .setTricks({ enabled: true, techniques: ["fakeFlipper"] }),
    );
    render(<ChecksPanel />);
    await user.click(filter("unavailable"));
    await user.click(screen.getByTestId("check-why-library"));
    act(() => analyzeNow());

    expect(row("library")).toHaveTextContent("Missing: Pegasus Boots");
    expect(screen.queryByTestId("check-about-tricks-library")).toBeNull();
  });

  it("offers the Trick filter only while tricks are marked", async () => {
    const user = userEvent.setup();
    render(<ChecksPanel />);
    expect(screen.queryByTestId("checks-filter-trick")).toBeNull();

    act(() =>
      useGameStore
        .getState()
        .setTricks({ enabled: true, techniques: ["darkRooms"] }),
    );
    // Not shown at first: the count says what it would show
    expect(filter("trick").closest("label")).toHaveTextContent(/Trick[1-9]/);
    expect(filter("trick")).not.toBeChecked();
    const marked = () =>
      screen
        .queryAllByTestId(/^check-row-/)
        .filter((each) => each.textContent?.includes("Trick"));
    expect(marked()).toHaveLength(0);

    await user.click(filter("trick"));
    expect(marked().length).toBeGreaterThan(0);
    expect(marked()).toHaveLength(
      Number(
        /Trick(\d+)/.exec(
          filter("trick").closest("label")?.textContent ?? "",
        )?.[1],
      ),
    );

    act(() =>
      useGameStore
        .getState()
        .setTricks({ enabled: false, techniques: ["darkRooms"] }),
    );
    expect(screen.queryByTestId("checks-filter-trick")).toBeNull();
  });

  it("offers Outside margin in a basic placement run, and says why", async () => {
    const user = userEvent.setup();
    render(<ChecksPanel />);
    expect(screen.queryByTestId("checks-filter-margin")).toBeNull();

    // Basic placement, everything but the hearts: 11 on screen of the 15
    // Misery Mire's way in waits for
    act(() => {
      const state = useGameStore.getState();
      state.updateSettings({ ...state.settings, itemPlacement: "basic" });
      useGameStore.setState({
        items: {
          ...state.items,
          bombos: true,
          boots: true,
          bottle: 2,
          ether: true,
          firerod: true,
          flute: true,
          glove: 2,
          hearts: 9,
          hookshot: true,
          lantern: true,
          moonpearl: true,
          quake: true,
          somaria: true,
          sword: 2,
        },
      });
    });
    expect(filter("margin")).not.toBeChecked();
    await user.click(filter("margin"));
    const bigChest = row("misery-mire/big-chest") as HTMLElement;
    expect(bigChest).toHaveTextContent("Outside margin");

    act(() => analyzeNow());
    await user.click(screen.getByTestId("check-why-misery-mire/big-chest"));
    expect(within(bigChest).getByTestId("missing-margin")).toHaveTextContent(
      /^Doable now, outside Basic's safety margin:/,
    );
    expect(within(bigChest).getByTestId("missing-in-logic")).toHaveTextContent(
      "In logic with: 15 hearts (you have 11 hearts)",
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
    expect(eastern).toHaveTextContent("no item left");
    for (const box of within(eastern).getAllByRole("checkbox")) {
      expect(box).toBeChecked();
      expect(box).toBeDisabled();
    }
  });

  it("leaves a dungeon ticked check by check at 0 to its own checks", async () => {
    const user = userEvent.setup();
    act(() => {
      useGameStore
        .getState()
        .toggleChecks([
          "eastern-palace/cannonball-chest",
          "eastern-palace/map-chest",
          "eastern-palace/big-chest",
          "eastern-palace/big-key-chest",
        ]);
      useGameStore.setState((state) => ({
        items: { ...state.items, chest0: 0 },
      }));
    });
    render(<ChecksPanel />);
    await user.click(filter("opened"));

    const eastern = screen.getByRole("region", { name: /^Eastern Palace/ });
    expect(eastern).toHaveTextContent("no item left");
    // Not opened, so neither ticked nor locked: the counter counts items
    const compass = within(
      row("eastern-palace/compass-chest") as HTMLElement,
    ).getByRole("checkbox", { name: "Compass Chest" });
    expect(compass).not.toBeChecked();
    expect(compass).toBeEnabled();
    expect(row("eastern-palace/compass-chest")).toHaveTextContent("Available");

    await user.click(compass);
    expect(
      useGameStore.getState().checked["eastern-palace/compass-chest"],
    ).toBe(true);
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
