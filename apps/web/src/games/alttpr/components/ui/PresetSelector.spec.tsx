import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import { forgetSeedFiles } from "@/games/alttpr/autotrack/seedFile";
import { PresetSelector } from "@/games/alttpr/components/ui/PresetSelector";
import { getPreset } from "@/games/alttpr/data/presets";
import { DEFAULT_TRICKS } from "@/games/alttpr/data/tricks";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import daily from "../../../../../../../packs/alttpr/test/seed-files/eM43RgZ4Gj.json";

vi.mock("@/games/alttpr/stores/gameStore", () => ({ useGameStore: vi.fn() }));

const applyRun = vi.fn();
const updateSettings = vi.fn();
const updateDoorSettings = vi.fn();
const hideSetting = vi.fn();
const setBigKeysVisible = vi.fn();
const setTricks = vi.fn();
const OPEN_RUN = {
  presetId: "open",
  settings: {
    ...getPreset("open").settings,
    crystalsGanon: 6,
    crystalsTower: 5,
  },
};
const fakeState = {
  applyRun,
  bigKeysVisible: false,
  hideSetting,
  ...OPEN_RUN,
  setBigKeysVisible,
  setTricks,
  tricks: DEFAULT_TRICKS,
  updateSettings,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(fakeState, OPEN_RUN, {
    bigKeysVisible: false,
    tricks: DEFAULT_TRICKS,
  });
  forgetSeedFiles();
  (useGameStore as unknown as Mock).mockImplementation(
    (selector: (state: typeof fakeState) => unknown) => selector(fakeState),
  );
});

describe("PresetSelector", () => {
  const openList = () => {
    fireEvent.click(screen.getByRole("button", { name: /mode/i }));
    return screen.getByRole("dialog", { name: /choose a run type/i });
  };

  it("shows the current preset name", () => {
    render(<PresetSelector />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("lists presets and the current run settings when opened", () => {
    render(<PresetSelector />);
    const dialog = openList();

    expect(
      within(dialog).getByRole("button", { name: /^keysanity/i }),
    ).toBeInTheDocument();
    // Current-run settings summary is shown
    expect(within(dialog).getByText("Goal")).toBeInTheDocument();
    expect(within(dialog).getByText("Defeat Ganon")).toBeInTheDocument();
    // A seed's own crystal counts, which no preset names
    expect(
      within(dialog).getByRole("combobox", { name: "Ganon's Tower" }),
    ).toHaveDisplayValue("5 crystals");
    expect(
      within(dialog).getByRole("combobox", { name: "Ganon" }),
    ).toHaveDisplayValue("6 crystals");
  });

  it("offers the key cells as a described checkbox, a display option", () => {
    render(<PresetSelector />);
    const dialog = openList();

    const option = within(dialog).getByRole("checkbox", {
      name: "Show key cells",
    });
    expect(option).not.toBeChecked();
    expect(option).toHaveAccessibleDescription(
      /on their own in MC, MCS and Full/i,
    );
    // Outside the settings summary: no select, no run change
    expect(option.closest(".run-settings")).toBeNull();

    fireEvent.click(option);
    expect(setBigKeysVisible).toHaveBeenCalledWith(true);
    expect(applyRun).not.toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("offers the tricks under the key cells, opening their dialog", () => {
    render(<PresetSelector />);
    const dialog = openList();

    const entry = within(dialog).getByTestId("tricks-button");
    expect(entry).toHaveAccessibleName("Tricks");
    expect(entry).toHaveAccessibleDescription(/^Off\./);
    // Under the key cells' checkbox, outside the settings summary
    const keyCells = within(dialog).getByTestId("key-cells-toggle");
    expect(
      keyCells.compareDocumentPosition(entry) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(entry.closest(".run-settings")).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Tricks" })).toBeNull();

    fireEvent.click(entry);
    const tricks = screen.getByRole("dialog", { name: "Tricks" });
    fireEvent.click(
      within(tricks).getByRole("checkbox", {
        name: "Mark checks these tricks open",
      }),
    );
    expect(setTricks).toHaveBeenCalledWith({
      enabled: true,
      techniques: DEFAULT_TRICKS.techniques,
    });
    expect(applyRun).not.toHaveBeenCalled();
  });

  it("says how many tricks are known once they are on", () => {
    fakeState.tricks = {
      enabled: true,
      techniques: ["darkRooms", "waterWalk"],
    } as typeof DEFAULT_TRICKS;
    render(<PresetSelector />);
    expect(
      within(openList()).getByTestId("tricks-button"),
    ).toHaveAccessibleDescription(
      "On, 2 tricks known: checks they open are marked.",
    );
  });

  it("checks the key cells while they are shown, and hides them on a click", () => {
    fakeState.bigKeysVisible = true;
    render(<PresetSelector />);
    const option = within(openList()).getByRole("checkbox", {
      name: "Show key cells",
    });

    expect(option).toBeChecked();
    fireEvent.click(option);
    expect(setBigKeysVisible).toHaveBeenCalledWith(false);
  });

  it("asks for confirmation before switching, then applies the preset", () => {
    render(<PresetSelector />);
    const dialog = openList();
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^keysanity/i }),
    );

    expect(
      screen.getByRole("dialog", { name: /switch run type/i }),
    ).toBeInTheDocument();
    expect(applyRun).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /switch & reset/i }));
    expect(applyRun).toHaveBeenCalledWith(
      "keysanity",
      getPreset("keysanity").settings,
    );
  });

  it("resets the run type in play once its settings were tuned, after confirmation", () => {
    // OPEN_RUN's crystals were tuned (a seed's own): Open again is a reset
    render(<PresetSelector />);
    fireEvent.click(within(openList()).getByRole("button", { name: /^open/i }));

    const confirm = screen.getByRole("dialog", { name: /reset run type/i });
    expect(confirm).toHaveTextContent(
      'Going back to the settings of "Open" will reset your current progress.',
    );
    expect(applyRun).not.toHaveBeenCalled();
    // The title says reset, so does the button
    expect(
      within(confirm).queryByRole("button", { name: /switch/i }),
    ).toBeNull();
    fireEvent.click(within(confirm).getByRole("button", { name: /^reset$/i }));
    expect(applyRun).toHaveBeenCalledWith("open", getPreset("open").settings);
  });

  it("asks nothing of the run type in play while it keeps its own settings", () => {
    Object.assign(fakeState, {
      settings: { ...getPreset("open").settings },
    });
    render(<PresetSelector />);
    const dialog = openList();
    fireEvent.click(within(dialog).getByRole("button", { name: /^open/i }));

    expect(
      screen.queryByRole("dialog", { name: /reset run type/i }),
    ).toBeNull();
    expect(applyRun).not.toHaveBeenCalled();
    // The list closes
    expect(
      screen.queryByRole("dialog", { name: /choose a run type/i }),
    ).toBeNull();
  });

  it("starts from a seed's link: its run type, once confirmed, under its settings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(daily))),
    );
    render(<PresetSelector />);
    const dialog = openList();

    fireEvent.change(within(dialog).getByTestId("seed-import-input"), {
      target: { value: "https://alttpr.com/en/h/eM43RgZ4Gj" },
    });
    fireEvent.click(within(dialog).getByTestId("seed-import-load"));

    const confirm = await screen.findByRole("dialog", {
      name: /switch run type/i,
    });
    expect(confirm).toHaveTextContent(
      'Switching to "Inverted (Inverted, Fast Ganon, 4/7, Basic placement, Hard pool, Hard functionality, Hard enemy health)"',
    );
    expect(applyRun).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /switch & reset/i }));
    expect(applyRun).toHaveBeenCalledWith(
      "inverted",
      {
        ...fakeState.settings,
        crystalsGanon: 7,
        crystalsTower: 4,
        enemyHealth: "hard",
        goal: "fast-ganon",
        itemFunctionality: "hard",
        itemPlacement: "basic",
        itemPool: "hard",
        mode: "inverted",
      },
      expect.any(Function),
    );
    // The run starts as the seed's: the hash it was asked for
    const lay = applyRun.mock.calls[0]?.[2] as () => unknown;
    expect(lay()).toEqual({ seed: "eM43RgZ4Gj" });
  });

  it("tunes the settings in place, the run kept", () => {
    render(<PresetSelector />);
    const dialog = openList();

    fireEvent.change(
      within(dialog).getByRole("combobox", { name: "Item pool" }),
      { target: { value: "hard" } },
    );
    fireEvent.change(
      within(dialog).getByRole("combobox", { name: "Ganon's Tower" }),
      { target: { value: "0" } },
    );
    // A run that names no boss shuffle has none
    const bosses = within(dialog).getByRole("combobox", {
      name: "Boss shuffle",
    });
    expect(bosses).toHaveValue("none");
    fireEvent.change(bosses, { target: { value: "full" } });
    // Nor glitches: None, which the player sets by hand
    const glitches = within(dialog).getByRole("combobox", {
      name: "Glitches",
    });
    expect(glitches).toHaveValue("none");
    fireEvent.change(glitches, { target: { value: "overworld_glitches" } });

    expect(updateSettings.mock.calls).toEqual([
      [{ itemPool: "hard" }],
      [{ crystalsTower: 0 }],
      [{ bossShuffle: "full" }],
      [{ glitches: "overworld_glitches" }],
    ]);
    expect(applyRun).not.toHaveBeenCalled();
    // The world names the run type: it is no field
    expect(within(dialog).getAllByRole("combobox")).toHaveLength(14);
  });

  it("offers a Door Randomizer run's own settings, changed in place", () => {
    Object.assign(fakeState, {
      presetId: "door-randomizer",
      settings: { ...getPreset("door-randomizer").settings, pottery: "keys" },
      updateDoorSettings,
    });
    render(<PresetSelector />);
    const dialog = openList();

    expect(
      within(dialog).getByText("Randomizer").nextSibling,
    ).toHaveTextContent("Door Randomizer");
    const pottery = within(dialog).getByRole("combobox", { name: "Pottery" });
    expect(pottery).toHaveValue("keys");
    fireEvent.change(pottery, { target: { value: "lottery" } });
    fireEvent.change(
      within(dialog).getByRole("combobox", { name: "Shopsanity" }),
      { target: { value: "true" } },
    );
    expect(updateDoorSettings.mock.calls).toEqual([
      [{ pottery: "lottery" }],
      [{ shopsanity: true }],
    ]);
    // No overworld setting in a DR run, only in an OWR one
    expect(
      within(dialog).queryByRole("combobox", { name: "Overworld layout" }),
    ).toBeNull();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("offers Link's House and the Tavern's back as not known until set", () => {
    Object.assign(fakeState, {
      presetId: "door-crosskeys",
      settings: {
        ...getPreset("door-crosskeys").settings,
        shuffleLinks: false,
      },
      updateDoorSettings,
    });
    render(<PresetSelector />);
    const dialog = openList();
    const tavern = within(dialog).getByRole("combobox", {
      name: "Back of Tavern",
    });
    expect(tavern).toHaveValue("?");
    expect(
      within(tavern).getByRole("option", { name: "? Not known" }),
    ).toBeInTheDocument();
    const links = within(dialog).getByRole("combobox", {
      name: "Link's House",
    });
    expect(links).toHaveValue("false");
    fireEvent.change(tavern, { target: { value: "true" } });
    fireEvent.change(links, { target: { value: "?" } });
    expect(updateDoorSettings.mock.calls).toEqual([
      [{ shuffleTavern: true }],
      [{ shuffleLinks: undefined }],
    ]);
  });

  it("offers a Mystery run's settings as not known yet, and hides one again", () => {
    Object.assign(fakeState, {
      presetId: "mystery",
      settings: {
        ...getPreset("mystery").settings,
        hidden: ["goal", "glitches", "entranceShuffle"],
      },
    });
    render(<PresetSelector />);
    const dialog = openList();
    const goal = within(dialog).getByRole("combobox", { name: "Goal" });
    expect(goal).toHaveValue("?");
    expect(
      within(goal).getByRole("option", { name: "? Unknown" }),
    ).toBeInTheDocument();

    fireEvent.change(goal, { target: { value: "fast-ganon" } });
    expect(updateSettings).toHaveBeenCalledWith({ goal: "fast-ganon" });
    const swords = within(dialog).getByRole("combobox", { name: "Swords" });
    fireEvent.change(swords, { target: { value: "?" } });
    expect(hideSetting).toHaveBeenCalledWith("swordless");
    // The glitches and the entrance shuffle may be unknown too
    for (const name of ["Glitches", "Entrances"]) {
      const select = within(dialog).getByRole("combobox", { name });
      expect(select).toHaveValue("?");
      expect(
        within(select).getByRole("option", { name: "? Unknown" }),
      ).toBeInTheDocument();
    }
    fireEvent.change(
      within(dialog).getByRole("combobox", { name: "Entrances" }),
      { target: { value: "crossed" } },
    );
    expect(updateSettings).toHaveBeenCalledWith({ entranceShuffle: "crossed" });
    // The dungeon items are assumed, never hidden
    expect(
      within(
        within(dialog).getByRole("combobox", { name: "Dungeon items" }),
      ).queryByRole("option", { name: "? Unknown" }),
    ).toBeNull();
  });

  it("offers no unknown in a run type whose settings are known", () => {
    render(<PresetSelector />);
    const dialog = openList();
    expect(
      within(dialog).queryAllByRole("option", { name: "? Unknown" }),
    ).toEqual([]);
  });

  it("does not switch when picking the already-active preset", () => {
    render(<PresetSelector />);
    const dialog = openList();
    fireEvent.click(within(dialog).getByRole("button", { name: /^open/i }));
    expect(applyRun).not.toHaveBeenCalled();
  });
});
