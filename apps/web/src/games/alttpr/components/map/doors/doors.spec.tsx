import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import DoorsPanel from "@/games/alttpr/components/map/doors/DoorsPanel";
import { MapPanel } from "@/games/alttpr/components/map/MapPanel";
import { getPreset, type RunSettings } from "@/games/alttpr/data/presets";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const DR = getPreset("door-randomizer").settings;
const run = (change: Partial<RunSettings>) =>
  act(() =>
    useGameStore.getState().applyRun("door-randomizer", { ...DR, ...change }),
  );
const store = () => useGameStore.getState();

describe("the Doors tab", () => {
  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  it("shows only while doors are shuffled", async () => {
    const user = userEvent.setup();
    run({});
    const { unmount } = render(<MapPanel />);
    expect(screen.queryByRole("tab", { name: "Doors" })).toBeNull();
    act(() => store().updateDoorSettings({ doorShuffle: "basic" }));
    await user.click(screen.getByRole("tab", { name: "Doors" }));
    expect(await screen.findByTestId("doors-panel")).toBeInTheDocument();
    expect(store().mapView).toBe("doors");
    // Doors vanilla again: the map, the view kept for the next shuffle
    act(() => store().updateDoorSettings({ doorShuffle: "vanilla" }));
    expect(screen.queryByTestId("doors-panel")).toBeNull();
    expect(screen.getByRole("tab", { name: "Map" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    unmount();
  });

  it("notes where a door leads, both ways, and its kind", async () => {
    const user = userEvent.setup();
    run({ doorIntensity: "2", doorShuffle: "basic" });
    render(<DoorsPanel />);
    expect(screen.getByTestId("doors-summary")).toHaveTextContent(
      /^0 of \d+ doors of Hyrule Castle noted/,
    );
    await user.selectOptions(screen.getByTestId("doors-dungeon"), [
      "Eastern Palace",
    ]);
    const link = screen.getByTestId("door-link-eastern-lobby-bridge-n");
    expect(link).toHaveAccessibleName("Eastern Lobby Bridge N: leads to");
    await user.selectOptions(link, ["eastern-cannonball-s"]);
    expect(store().doors.links).toEqual({
      "eastern-cannonball-s": "eastern-lobby-bridge-n",
      "eastern-lobby-bridge-n": "eastern-cannonball-s",
    });
    expect(screen.getByTestId("door-link-eastern-cannonball-s")).toHaveValue(
      "eastern-lobby-bridge-n",
    );
    expect(screen.getByTestId("doors-summary")).toHaveTextContent(
      /^2 of \d+ doors of Eastern Palace noted/,
    );
    // A door whose kind the shuffle may change: not known with its link
    const kind = screen.getByTestId("door-kind-eastern-cannonball-s");
    expect(kind).toHaveValue("");
    expect(store().doors.kinds).toBeUndefined();
    await user.selectOptions(kind, ["small"]);
    expect(store().doors.kinds?.["eastern-cannonball-s"]).toBe("small");
    // Not known again forgets both ways, as one undo step each
    await user.selectOptions(link, [""]);
    expect(store().doors.links).toBeUndefined();
    act(() => store().undo());
    expect(store().doors.links?.["eastern-lobby-bridge-n"]).toBe(
      "eastern-cannonball-s",
    );
  });

  it("notes the kinds of the doors linked plain at once, by keyboard", async () => {
    const user = userEvent.setup();
    run({ doorIntensity: "2", doorShuffle: "basic" });
    render(<DoorsPanel />);
    await user.selectOptions(screen.getByTestId("doors-dungeon"), [
      "Eastern Palace",
    ]);
    // Nothing linked: nothing to note plain
    expect(screen.queryByTestId("doors-plain")).toBeNull();
    await user.selectOptions(
      screen.getByTestId("door-link-eastern-lobby-bridge-n"),
      ["eastern-cannonball-s"],
    );
    const plain = screen.getByTestId("doors-plain");
    expect(plain).toHaveAccessibleName(
      "Note the 1 linked door of Eastern Palace plain",
    );
    plain.focus();
    await user.keyboard("{Enter}");
    // The linked door whose kind may change, and no other
    expect(store().doors.kinds).toEqual({ "eastern-cannonball-s": "normal" });
    expect(screen.queryByTestId("doors-plain")).toBeNull();
    act(() => store().undo());
    expect(store().doors.kinds).toBeUndefined();
  });

  it("asks each lobby from intensity 3 and a pool's keys", async () => {
    const user = userEvent.setup();
    run({ doorIntensity: "3", doorShuffle: "crossed" });
    render(<DoorsPanel />);
    await user.selectOptions(screen.getByTestId("doors-dungeon"), [
      "Desert Palace",
    ]);
    // Desert's four ways in
    for (const portal of [
      "desert-south",
      "desert-east",
      "desert-west",
      "desert-back",
    ])
      expect(screen.getByTestId(`door-lobby-${portal}`)).toBeInTheDocument();
    const lobby = screen.getByRole("combobox", {
      name: "Desert South entrance: opens on",
    });
    await user.selectOptions(lobby, ["pod-lobby-s"]);
    expect(store().doors.lobbies).toEqual({ "desert-south": "pod-lobby-s" });
    const keys = screen.getByRole("spinbutton", {
      name: "Small keys in Desert Palace, in all",
    });
    await user.type(keys, "4");
    await waitFor(() =>
      expect(store().doors.keys).toEqual({ "Desert Palace": 4 }),
    );
    await user.clear(keys);
    expect(store().doors.keys).toBeUndefined();
  });

  it("asks no lobby below intensity 3, nor keys in basic", async () => {
    run({ doorIntensity: "2", doorShuffle: "basic" });
    render(<DoorsPanel />);
    expect(screen.queryAllByTestId(/^door-lobby-/)).toHaveLength(0);
    expect(screen.queryByTestId("doors-keys")).toBeNull();
  });
});
