import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GamePicker } from "@/components/ui/GamePicker";
import { ACTIVE_GAME_KEY, loadGame, switchGame } from "@/games/registry";

describe("GamePicker", () => {
  it("presses the game tracked, and switches to another only", () => {
    const onSwitch = vi.fn();
    render(<GamePicker current="alttpr" onSwitch={onSwitch} />);
    const alttpr = screen.getByTestId("game-alttpr");
    const sm = screen.getByTestId("game-sm");
    expect(alttpr).toHaveAttribute("aria-pressed", "true");
    expect(sm).toHaveAttribute("aria-pressed", "false");
    expect(sm).toHaveAccessibleName("Super Metroid, Map Rando");
    fireEvent.click(alttpr);
    expect(onSwitch).not.toHaveBeenCalled();
    fireEvent.click(sm);
    expect(onSwitch).toHaveBeenCalledWith("sm");
  });
});

describe("switchGame", () => {
  it("saves the game, then loads the page again", () => {
    const reload = vi.fn();
    switchGame("sm", reload);
    expect(localStorage.getItem(ACTIVE_GAME_KEY)).toBe("sm");
    expect(reload).toHaveBeenCalledOnce();
    localStorage.removeItem(ACTIVE_GAME_KEY);
  });

  it("loads the page again on its game when storage refuses the choice", () => {
    const reload = vi.fn();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
    switchGame("sm", reload);
    expect(reload).toHaveBeenCalledOnce();
    setItem.mockRestore();
  });

  it("loads Super Metroid's module", async () => {
    const game = await loadGame("sm");
    expect(typeof game.App).toBe("function");
    game.start();
  });
});
