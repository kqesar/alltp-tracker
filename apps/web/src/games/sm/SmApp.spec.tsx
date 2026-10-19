import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SmControls } from "@/games/sm/components/SmControls";
import { SmGrid } from "@/games/sm/components/SmGrid";
import { SmObjectives } from "@/games/sm/components/SmObjectives";
import SmApp from "@/games/sm/SmApp";
import { exportSave, freshProgress, useSmStore } from "@/games/sm/store";

const store = () => useSmStore.getState();

beforeEach(() => {
  localStorage.clear();
  useSmStore.setState(useSmStore.getInitialState(), true);
});

describe("the Super Metroid grid", () => {
  it("names each item and its state, and steps it by click, right-click or -", () => {
    render(<SmGrid />);
    const morph = screen.getByTestId("sm-item-morph");
    expect(morph).toHaveAccessibleName(
      "Morphing Ball, not obtained. Click to change state.",
    );
    fireEvent.click(morph);
    expect(morph).toHaveAccessibleName(
      "Morphing Ball, obtained. Click to change state.",
    );
    const missile = screen.getByTestId("sm-item-missile");
    fireEvent.click(missile);
    fireEvent.click(missile);
    expect(missile).toHaveAccessibleName(
      "Missile, 2 of 46. Click to change state.",
    );
    expect(missile).toHaveTextContent("2");
    fireEvent.contextMenu(missile);
    fireEvent.keyDown(missile, { key: "-" });
    expect(store().items.missile).toBe(0);
    expect(missile).toHaveTextContent("");
  });

  it("lays out the cells the seed's settings add", () => {
    const { rerender } = render(<SmGrid />);
    expect(screen.queryByTestId("sm-item-wallJump")).toBeNull();
    expect(screen.getByTestId("sm-item-speedBooster")).toBeInTheDocument();
    act(() => {
      store().setOption("wallJump", true);
      store().setOption("splitSpeed", true);
    });
    rerender(<SmGrid />);
    expect(screen.getByTestId("sm-item-wallJump")).toBeInTheDocument();
    expect(screen.getByTestId("sm-item-sparkBooster")).toBeInTheDocument();
    expect(screen.getByTestId("sm-item-blueBooster")).toBeInTheDocument();
    expect(screen.queryByTestId("sm-item-speedBooster")).toBeNull();
    // Still six cells a row, the last row's last one empty
    expect(screen.getAllByRole("button")).toHaveLength(23);
  });
});

describe("the seed's objectives", () => {
  it("count those done, and say when the barriers are down", () => {
    render(<SmObjectives />);
    expect(screen.getByTestId("sm-objectives-summary")).toHaveTextContent(
      "0 of 4 done.",
    );
    for (const id of ["kraid", "phantoon", "draygon"]) {
      fireEvent.click(screen.getByTestId(`sm-objective-${id}`));
    }
    expect(screen.getByTestId("sm-objective-kraid")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("sm-objectives-summary")).toHaveTextContent(
      "3 of 4 done.",
    );
    fireEvent.click(screen.getByTestId("sm-objective-ridley"));
    expect(screen.getByTestId("sm-objectives-summary")).toHaveTextContent(
      "All done: the barriers before Mother Brain are down.",
    );
  });

  it("say when the seed asks for none", () => {
    act(() => store().setObjectives([]));
    render(<SmObjectives />);
    expect(screen.getByTestId("sm-objectives-summary")).toHaveTextContent(
      "This seed asks for none.",
    );
  });
});

describe("the Super Metroid toolbar", () => {
  it("sets the seed's objectives by preset or one by one, and its items", async () => {
    const user = userEvent.setup();
    render(<SmControls />);
    await user.click(screen.getByRole("button", { name: /^Mode/ }));
    const dialog = screen.getByRole("dialog", { name: "Choose a run type" });
    expect(within(dialog).getByTestId("game-sm")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.selectOptions(within(dialog).getByLabelText("Objectives"), [
      "metroids",
    ]);
    expect(store().objectives).toEqual([
      "metroidRoom1",
      "metroidRoom2",
      "metroidRoom3",
      "metroidRoom4",
    ]);
    await user.click(within(dialog).getByLabelText("Crocomire"));
    expect(store().objectives).toContain("crocomire");
    expect(within(dialog).getByLabelText("Objectives")).toHaveValue("custom");
    await user.click(
      within(dialog).getByLabelText("Wall Jump Boots (wall jumps need them)"),
    );
    expect(store().wallJump).toBe(true);
  });

  it("starts a new game after asking, and undoes it", async () => {
    const user = userEvent.setup();
    act(() => store().step("charge", 1));
    render(<SmControls />);
    await user.click(screen.getByTitle("Start a new game (clears progress)"));
    await user.click(
      within(screen.getByRole("dialog", { name: "New game?" })).getByRole(
        "button",
        { name: "New game" },
      ),
    );
    expect(store().items.charge).toBe(0);
    expect(screen.getByTestId("sm-status")).toHaveTextContent(
      "New game started.",
    );
    await user.click(screen.getByTestId("undo"));
    expect(store().items.charge).toBe(1);
  });

  it("imports a save after asking, and says why it refuses one", async () => {
    const user = userEvent.setup();
    render(<SmControls />);
    const input = screen.getByTestId("import-file");
    const run = { ...freshProgress(), done: ["ridley"] };
    await user.upload(
      input,
      new File([exportSave(run)], "run.json", { type: "application/json" }),
    );
    const confirm = await screen.findByRole("dialog", {
      name: "Import this save?",
    });
    await user.click(within(confirm).getByRole("button", { name: "Import" }));
    expect(store().done).toEqual(["ridley"]);
    await user.upload(
      input,
      new File(
        [
          '{"format":"alltp-tracker-save","game":"alttpr","version":11,"progress":{}}',
        ],
        "z.json",
      ),
    );
    expect(await screen.findByTestId("sm-status")).toHaveTextContent(
      "This save is for A Link to the Past: switch game to import it there.",
    );
  });

  it("exports the run as a save file", async () => {
    const user = userEvent.setup();
    const created = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:sm-save");
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    render(<SmControls />);
    await user.click(screen.getByTitle("Export progress to a file"));
    expect(created).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    created.mockRestore();
    click.mockRestore();
  });

  it("cancels a new game or an import as asked, and says a file it cannot read", async () => {
    const user = userEvent.setup();
    act(() => store().step("charge", 1));
    render(<SmControls />);
    await user.click(screen.getByTitle("Start a new game (clears progress)"));
    await user.click(
      within(screen.getByRole("dialog", { name: "New game?" })).getByRole(
        "button",
        { name: "Cancel" },
      ),
    );
    expect(store().items.charge).toBe(1);
    const input = screen.getByTestId("import-file");
    await user.upload(input, new File([exportSave(freshProgress())], "a.json"));
    await user.click(
      within(
        await screen.findByRole("dialog", { name: "Import this save?" }),
      ).getByRole("button", { name: "Cancel" }),
    );
    expect(store().items.charge).toBe(1);
    const broken = new File(["x"], "b.json");
    vi.spyOn(broken, "text").mockRejectedValue(new Error("unreadable"));
    await user.upload(input, broken);
    expect(await screen.findByTestId("sm-status")).toHaveTextContent(
      "This file could not be read.",
    );
  });

  it("gives the stream view's address, and copies it", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<SmControls />);
    await user.click(screen.getByTestId("sm-stream-view"));
    await user.click(screen.getByRole("button", { name: "Copy the address" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("view=obs"));
    expect(await screen.findByText("Copied.")).toBeInTheDocument();
  });

  it("gives the stream view's address", async () => {
    const user = userEvent.setup();
    render(<SmControls />);
    await user.click(screen.getByTestId("sm-stream-view"));
    expect(screen.getByTestId("sm-stream-url")).toHaveTextContent("view=obs");
  });
});

describe("the Super Metroid tracker", () => {
  it("undoes and redoes from the keyboard, as ALttPR's board", () => {
    render(<SmApp />);
    fireEvent.click(screen.getByTestId("sm-item-ice"));
    fireEvent.keyDown(window, { ctrlKey: true, key: "z" });
    expect(store().items.ice).toBe(0);
    fireEvent.keyDown(window, { ctrlKey: true, key: "z", shiftKey: true });
    expect(store().items.ice).toBe(1);
    expect(screen.getByTestId("link-maprando")).toHaveAttribute(
      "href",
      "https://maprando.com/",
    );
  });
});
