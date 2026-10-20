import { describe, expect, it } from "vitest";
import {
  ACTIVE_GAME_KEY,
  activeGame,
  loadGame,
  pageTitle,
} from "@/games/registry";

const storage = (saved: string | null) => ({ getItem: () => saved });

describe("activeGame", () => {
  it("is the game this device saved", () => {
    expect(activeGame(storage("alttpr"))).toBe("alttpr");
  });

  it("is A Link to the Past without a choice, or with one it does not know", () => {
    expect(activeGame(storage(null))).toBe("alttpr");
    expect(activeGame(storage("zelda1"))).toBe("alttpr");
    expect(activeGame(storage(""))).toBe("alttpr");
  });

  it("is A Link to the Past when storage throws", () => {
    const blocked = {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    };
    expect(activeGame(blocked)).toBe("alttpr");
  });

  it("reads the page's storage by default", () => {
    localStorage.setItem(ACTIVE_GAME_KEY, "nope");
    try {
      expect(activeGame()).toBe("alttpr");
    } finally {
      localStorage.removeItem(ACTIVE_GAME_KEY);
    }
  });
});

describe("pageTitle", () => {
  it("names the product, then the game", () => {
    expect(pageTitle("alttpr")).toBe(
      "Rando Atlas \u00b7 A Link to the Past Randomizer",
    );
    expect(pageTitle("sm")).toBe("Rando Atlas \u00b7 Super Metroid Randomizer");
    expect(pageTitle("smz3")).toBe("Rando Atlas \u00b7 SMZ3 Randomizer");
  });
});

describe("loadGame", () => {
  it("loads a game's tracker, stream view and start", async () => {
    const game = await loadGame("alttpr");
    expect(typeof game.App).toBe("function");
    expect(typeof game.ObsView).toBe("function");
    expect(typeof game.start).toBe("function");
  });
});
