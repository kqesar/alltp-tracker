import { afterEach, describe, expect, it } from "vitest";
import {
  ACTIVE_GAME_KEY,
  activeGame,
  loadGame,
  pageTitle,
  takeGameFromAddress,
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

describe("takeGameFromAddress", () => {
  const open = (address: string) =>
    window.history.replaceState(null, "", address);

  afterEach(() => {
    localStorage.clear();
    open("/");
  });

  it("makes the game a link asks for this device's, and drops the parameter", () => {
    open("/alltp-tracker/?game=sm&view=obs#top");

    takeGameFromAddress();

    expect(localStorage.getItem(ACTIVE_GAME_KEY)).toBe("sm");
    expect(window.location.pathname + window.location.search).toBe(
      "/alltp-tracker/?view=obs",
    );
    expect(window.location.hash).toBe("#top");
  });

  it("drops a game it does not know, keeping the device's", () => {
    localStorage.setItem(ACTIVE_GAME_KEY, "smz3");
    open("/?game=zelda1");

    takeGameFromAddress();

    expect(localStorage.getItem(ACTIVE_GAME_KEY)).toBe("smz3");
    expect(window.location.search).toBe("");
  });

  it("leaves an address without the parameter as it is", () => {
    open("/?view=obs");

    takeGameFromAddress();

    expect(localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
    expect(window.location.search).toBe("?view=obs");
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
