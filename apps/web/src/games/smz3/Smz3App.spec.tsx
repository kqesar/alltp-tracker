import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Smz3Controls } from "@/games/smz3/components/Smz3Controls";
import { Smz3Grid } from "@/games/smz3/components/Smz3Grid";
import { Smz3Keycards } from "@/games/smz3/components/Smz3Keycards";
import { Smz3Maps } from "@/games/smz3/components/Smz3Maps";
import { Smz3Tokens } from "@/games/smz3/components/Smz3Tokens";
import { markerState } from "@/games/smz3/logic";
import Smz3App from "@/games/smz3/Smz3App";
import { exportSave, freshProgress, useSmz3Store } from "@/games/smz3/store";

const store = () => useSmz3Store.getState();

beforeEach(() => {
  localStorage.clear();
  useSmz3Store.setState(useSmz3Store.getInitialState(), true);
});

describe("the SMZ3 grid", () => {
  it("names each item and its state, and steps it by click, right-click or -", () => {
    render(<Smz3Grid />);
    const hookshot = screen.getByTestId("smz3-item-hookshot");
    expect(hookshot).toHaveAccessibleName(
      "Hookshot, not obtained. Click to change state.",
    );
    fireEvent.click(hookshot);
    expect(hookshot).toHaveAccessibleName(
      "Hookshot, obtained. Click to change state.",
    );
    const missile = screen.getByTestId("smz3-item-missile");
    fireEvent.click(missile);
    fireEvent.click(missile);
    expect(missile).toHaveAccessibleName(
      "Missile, 2 of 40. Click to change state.",
    );
    expect(missile).toHaveTextContent("2");
    fireEvent.contextMenu(missile);
    fireEvent.keyDown(missile, { key: "-" });
    expect(store().items.missile).toBe(0);
    // A sword shows its level on its sprite, never a count over it
    const sword = screen.getByTestId("smz3-item-sword");
    fireEvent.click(sword);
    fireEvent.click(sword);
    expect(sword).toHaveAccessibleName("Sword, 2 of 4. Click to change state.");
    expect(sword).toHaveTextContent("");
    // So do the bottles, their count drawn on the sprite
    const bottle = screen.getByTestId("smz3-item-bottle");
    fireEvent.click(bottle);
    fireEvent.click(bottle);
    expect(bottle).toHaveTextContent("");
    expect(bottle.style.getPropertyValue("--sprite")).toContain("bottle2.png");
  });
});

describe("the maps", () => {
  it("colour each location by the logic, and check it on a click", async () => {
    const user = userEvent.setup();
    render(<Smz3Maps />);
    const house = screen.getByTestId("marker-links-house");
    expect(house).toHaveAccessibleName("Link's House: available");
    await user.click(house);
    expect(store().checked).toContain("links-house");
    expect(house).toHaveAccessibleName("Link's House: checked");
    expect(house).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("tab", { name: "Zebes" }));
    const morph = screen.getByTestId("marker-morphing-ball");
    expect(morph).toHaveAccessibleName("Morphing Ball: available");
    expect(screen.queryByTestId("marker-links-house")).toBeNull();
    // The legend has no seen state here
    expect(screen.getByTestId("map-legend")).not.toHaveTextContent(
      "Visible, not reachable yet",
    );
  });
});

describe("the boss tokens", () => {
  it("count those found against what Tourian asks for", async () => {
    const user = userEvent.setup();
    act(() => store().setSettings({ tourianBosses: 1 }));
    render(<Smz3Tokens />);
    expect(screen.getByTestId("smz3-tokens-summary")).toHaveTextContent(
      "0 of the 1 Tourian asks for.",
    );
    await user.click(screen.getByTestId("smz3-tokenRidley"));
    expect(screen.getByTestId("smz3-tokenRidley")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("smz3-tokens-summary")).toHaveTextContent(
      "1 found: Tourian is open.",
    );
    await user.click(screen.getByTestId("smz3-tokenRidley"));
    expect(store().items.tokenRidley).toBe(0);
  });
});

describe("the SMZ3 toolbar", () => {
  it("sets the run type, its settings and the pads in its dialog", async () => {
    const user = userEvent.setup();
    render(<Smz3Controls />);
    await user.click(screen.getByTitle("Choose a run type"));
    const dialog = screen.getByRole("dialog", { name: "Choose a run type" });
    expect(within(dialog).getByTestId("game-smz3")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.selectOptions(within(dialog).getByTestId("smz3-preset"), [
      "normal-753",
    ]);
    expect(store().settings).toMatchObject({
      ganonCrystals: 5,
      tourianBosses: 3,
      towerCrystals: 7,
    });
    await user.selectOptions(
      within(dialog).getByLabelText("Super Metroid logic"),
      ["hard"],
    );
    expect(store().settings.smLogic).toBe("hard");
    expect(within(dialog).getByTestId("smz3-preset")).toHaveValue("custom");
    await user.click(
      within(dialog).getByLabelText("Keysanity (keys and keycards anywhere)"),
    );
    expect(store().settings.keysanity).toBe(true);
    await user.selectOptions(
      within(dialog).getByTestId("smz3-tower-crystals"),
      ["6"],
    );
    await user.selectOptions(
      within(dialog).getByTestId("smz3-ganon-crystals"),
      ["4"],
    );
    await user.selectOptions(
      within(dialog).getByTestId("smz3-tourian-bosses"),
      ["2"],
    );
    expect(store().settings).toMatchObject({
      ganonCrystals: 4,
      tourianBosses: 2,
      towerCrystals: 6,
    });
    await user.selectOptions(within(dialog).getByLabelText("Misery Mire"), [
      "ether",
    ]);
    await user.selectOptions(within(dialog).getByLabelText("Turtle Rock"), [
      "quake",
    ]);
    expect(store().pads).toEqual({ mire: "ether", turtleRock: "quake" });
    await user.selectOptions(
      within(dialog).getByLabelText("Super Metroid logic"),
      ["normal"],
    );
    expect(store().settings.smLogic).toBe("normal");
  });

  it("starts a new game after asking, and undoes it", async () => {
    const user = userEvent.setup();
    act(() => store().step("hammer", 1));
    render(<Smz3Controls />);
    await user.click(screen.getByTitle("Start a new game (clears progress)"));
    await user.click(
      within(screen.getByRole("dialog", { name: "New game?" })).getByRole(
        "button",
        { name: "New game" },
      ),
    );
    expect(store().items.hammer).toBe(0);
    expect(screen.getByTestId("smz3-status")).toHaveTextContent(
      "New game started.",
    );
    await user.click(screen.getByTestId("undo"));
    expect(store().items.hammer).toBe(1);
    await user.click(screen.getByTestId("redo"));
    expect(store().items.hammer).toBe(0);
  });

  it("imports a save after asking, and says why it refuses one", async () => {
    const user = userEvent.setup();
    render(<Smz3Controls />);
    const input = screen.getByTestId("import-file");
    const run = { ...freshProgress(), checked: ["sanctuary"] };
    await user.upload(
      input,
      new File([exportSave(run)], "run.json", { type: "application/json" }),
    );
    const confirm = await screen.findByRole("dialog", {
      name: "Import this save?",
    });
    await user.click(within(confirm).getByRole("button", { name: "Import" }));
    expect(store().checked).toEqual(["sanctuary"]);
    await user.upload(
      input,
      new File(
        [
          '{"format":"alltp-tracker-save","game":"sm","version":1,"progress":{}}',
        ],
        "z.json",
      ),
    );
    expect(await screen.findByTestId("smz3-status")).toHaveTextContent(
      "This save is for another game: switch game to import it there.",
    );
  });

  it("cancels a new game or an import as asked, and says a file it cannot read", async () => {
    const user = userEvent.setup();
    act(() => store().step("hammer", 1));
    render(<Smz3Controls />);
    await user.click(screen.getByTitle("Start a new game (clears progress)"));
    await user.click(
      within(screen.getByRole("dialog", { name: "New game?" })).getByRole(
        "button",
        { name: "Cancel" },
      ),
    );
    expect(store().items.hammer).toBe(1);
    const input = screen.getByTestId("import-file");
    await user.upload(input, new File([exportSave(freshProgress())], "a.json"));
    await user.click(
      within(
        await screen.findByRole("dialog", { name: "Import this save?" }),
      ).getByRole("button", { name: "Cancel" }),
    );
    expect(store().items.hammer).toBe(1);
    const broken = new File(["x"], "b.json");
    vi.spyOn(broken, "text").mockRejectedValue(new Error("unreadable"));
    await user.upload(input, broken);
    expect(await screen.findByTestId("smz3-status")).toHaveTextContent(
      "This file could not be read.",
    );
  });

  it("exports the run as a save file", async () => {
    const user = userEvent.setup();
    const created = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:smz3-save");
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    render(<Smz3Controls />);
    await user.click(screen.getByTitle("Export progress to a file"));
    expect(created).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    created.mockRestore();
    click.mockRestore();
  });

  describe("when the clipboard refuses the stream view's address", () => {
    const { execCommand } = document;
    afterEach(() => {
      document.execCommand = execCommand;
    });

    it("selects it and copies it with the older command", async () => {
      const user = userEvent.setup();
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      });
      const command = vi.fn(() => true);
      document.execCommand = command;
      render(<Smz3Controls />);
      await user.click(screen.getByTestId("smz3-stream-view"));
      await user.click(
        screen.getByRole("button", { name: "Copy the address" }),
      );
      expect(await screen.findByText("Copied.")).toBeInTheDocument();
      expect(command).toHaveBeenCalledWith("copy");
      expect(String(window.getSelection())).toContain("view=obs");
    });

    it("leaves it selected for Ctrl+C when nothing can copy", async () => {
      const user = userEvent.setup();
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      });
      document.execCommand = vi.fn(() => false);
      render(<Smz3Controls />);
      await user.click(screen.getByTestId("smz3-stream-view"));
      await user.click(
        screen.getByRole("button", { name: "Copy the address" }),
      );
      expect(
        await screen.findByText("Press Ctrl+C to copy."),
      ).toBeInTheDocument();
      expect(String(window.getSelection())).toContain("view=obs");
    });
  });

  it("offers the run timer under the grid, adding it to the address", async () => {
    const user = userEvent.setup();
    render(<Smz3Controls />);
    await user.click(screen.getByTestId("smz3-stream-view"));
    expect(screen.getByTestId("smz3-stream-url")).not.toHaveTextContent(
      "timer=1",
    );
    await user.click(screen.getByTestId("smz3-stream-timer"));
    expect(screen.getByTestId("smz3-stream-url")).toHaveTextContent("timer=1");
  });

  it("gives the stream view's address, and copies it", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<Smz3Controls />);
    await user.click(screen.getByTestId("smz3-stream-view"));
    expect(screen.getByTestId("smz3-stream-url")).toHaveTextContent("view=obs");
    await user.click(screen.getByRole("button", { name: "Copy the address" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("view=obs"));
    expect(await screen.findByText("Copied.")).toBeInTheDocument();
  });
});

describe("keysanity", () => {
  it("adds each dungeon's keys and Super Metroid's keycards, which the logic reads", async () => {
    const user = userEvent.setup();
    act(() => {
      store().setSettings({ keysanity: true });
      store().step("morph", 1);
    });
    render(<Smz3App />);
    expect(screen.getByTestId("layout")).toHaveAttribute("data-keys", "true");

    // Eastern Palace's big chest waits for its big key
    const bigChest = () => markerState(store(), ["eastern-palace/big-chest"]);
    expect(bigChest()).toBe("unavailable");
    const bigKey = screen.getByTestId("smz3-item-bigKeyEP");
    expect(bigKey).toHaveAccessibleName(
      "Eastern Palace big key, not obtained. Click to change state.",
    );
    await user.click(bigKey);
    expect(bigKey).toHaveAccessibleName(/, obtained\./);
    expect(bigChest()).toBe("available");
    // Eastern Palace has no small key; Palace of Darkness counts its six
    expect(
      within(screen.getByTestId("smz3-keys-EP")).getAllByRole("button"),
    ).toHaveLength(1);
    const darkKeys = screen.getByTestId("smz3-item-keyPD");
    await user.click(darkKeys);
    await user.click(darkKeys);
    fireEvent.keyDown(darkKeys, { key: "-" });
    expect(darkKeys).toHaveAccessibleName(
      "Palace of Darkness small keys, 1 of 6. Click to change state.",
    );
    expect(screen.getByTestId("smz3-keys-PD")).toHaveTextContent("PD1");

    // Blue Brinstar's middle missile waits for Brinstar's level 1 keycard
    await user.click(screen.getByRole("tab", { name: "Zebes" }));
    const missile = screen.getByTestId("marker-missile-blue-brinstar-middle");
    expect(missile).toHaveAccessibleName(/: out of logic$/);
    const card = screen.getByRole("button", {
      name: "Brinstar Level 1 keycard",
    });
    await user.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(missile).toHaveAccessibleName(/: available$/);
    // Wrecked Ship has no level 2 card
    expect(
      screen.queryByRole("button", { name: "Wrecked Ship Level 2 keycard" }),
    ).toBeNull();
    await user.click(card);
    expect(store().items.cardBrinstarL1).toBe(0);
  });

  it("is a single Tab stop in the keycards, the arrow keys moving inside", async () => {
    const user = userEvent.setup();
    act(() => store().setSettings({ keysanity: true }));
    render(<Smz3Keycards />);
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Crateria Level 1 keycard" }),
    ).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("button", { name: "Crateria Level 2 keycard" }),
    ).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(
      screen.getByRole("button", { name: "Brinstar Level 2 keycard" }),
    ).toHaveFocus();
  });
});

describe("the SMZ3 tracker", () => {
  it("has the run timer above the board, cleared by a new game", async () => {
    const user = userEvent.setup();
    render(<Smz3App />);
    const timer = screen.getByTestId("run-timer");
    expect(timer.closest(".board-run")).not.toBeNull();
    expect(timer).toHaveAccessibleName("Run timer: 0:00, not started");
    act(() => store().startTimer());
    expect(timer).toHaveAccessibleName("Run timer: 0:00, running");

    await user.click(screen.getByTitle("Start a new game (clears progress)"));
    await user.click(
      within(screen.getByRole("dialog", { name: "New game?" })).getByRole(
        "button",
        { name: "New game" },
      ),
    );
    expect(timer).toHaveAccessibleName("Run timer: 0:00, not started");
  });

  it("leaves Ctrl+Alt+Z (AltGr+Z on some layouts) and Shift+Y alone", () => {
    render(<Smz3App />);
    fireEvent.click(screen.getByTestId("smz3-item-ice"));
    fireEvent.keyDown(window, { altKey: true, ctrlKey: true, key: "z" });
    expect(store().items.ice).toBe(1);
    fireEvent.keyDown(window, { ctrlKey: true, key: "z" });
    fireEvent.keyDown(window, { ctrlKey: true, key: "Y", shiftKey: true });
    expect(store().items.ice).toBe(0);
  });

  it("undoes and redoes from the keyboard, and links samus.link", () => {
    render(<Smz3App />);
    fireEvent.click(screen.getByTestId("smz3-item-ice"));
    fireEvent.keyDown(window, { ctrlKey: true, key: "z" });
    expect(store().items.ice).toBe(0);
    fireEvent.keyDown(window, { ctrlKey: true, key: "z", shiftKey: true });
    expect(store().items.ice).toBe(1);
    fireEvent.keyDown(window, { ctrlKey: true, key: "y" });
    fireEvent.keyDown(window, { ctrlKey: true, key: "x" });
    expect(screen.getByTestId("link-samus")).toHaveAttribute(
      "href",
      "https://samus.link/",
    );
  });
});
