import { afterEach, describe, expect, it } from "vitest";
import {
  joinLinkUrl,
  readJoinLink,
  takeJoinLink,
} from "@/games/archipelago/joinLink";

describe("readJoinLink", () => {
  it.each([
    [
      "?game=archipelago&room=archipelago.gg%3A38281&slot=Link",
      { room: "archipelago.gg:38281", slot: "Link" },
    ],
    // Every form the Room field takes: a /connect line, a room link, ws://
    [
      "?room=%2Fconnect+archipelago.gg%3A60030&slot=Hybrid+Hero",
      { room: "/connect archipelago.gg:60030", slot: "Hybrid Hero" },
    ],
    [
      "?room=https%3A%2F%2Farchipelago.gg%2Froom%2FAbC-12&slot=",
      { room: "https://archipelago.gg/room/AbC-12", slot: "" },
    ],
    [
      "?room=ws%3A%2F%2F127.0.0.1%3A38281",
      { room: "ws://127.0.0.1:38281", slot: "" },
    ],
    // The slot as typed: case and spaces are the slot's
    ["?room=localhost&slot=+lInK+", { room: "localhost", slot: " lInK " }],
    // A slot far past AP's 16 characters is no slot
    [`?room=localhost&slot=${"x".repeat(65)}`, { room: "localhost", slot: "" }],
  ])("reads %s", (search, prefill) => {
    expect(readJoinLink(search)).toEqual(prefill);
  });

  it.each([
    "?game=archipelago",
    "?room=",
    "?room=%20%20&slot=Link",
    "?room=http%3A%2F%2Fexample.com%2Froom&slot=Link",
    "?room=example.com%3A99999",
  ])("finds no room in %s", (search) => {
    expect(readJoinLink(search)).toBeNull();
  });
});

describe("takeJoinLink", () => {
  const open = (address: string) =>
    window.history.replaceState(null, "", address);

  afterEach(() => open("/"));

  it("takes the room and the slot, then leaves the address without them", () => {
    open("/alltp-tracker/?view=x&room=archipelago.gg%3A38281&slot=Link#top");
    expect(takeJoinLink()).toEqual({
      room: "archipelago.gg:38281",
      slot: "Link",
    });
    expect(window.location.pathname + window.location.search).toBe(
      "/alltp-tracker/?view=x",
    );
    expect(window.location.hash).toBe("#top");
    // A reload fills nothing in again
    expect(takeJoinLink()).toBeNull();
  });

  it("drops a password a hand-made link carries, unread", () => {
    open("/alltp-tracker/?room=localhost&slot=Link&password=hunter2");
    expect(takeJoinLink()).toEqual({ room: "localhost", slot: "Link" });
    expect(window.location.search).toBe("");
    // Even with no room to fill in
    open("/alltp-tracker/?password=hunter2");
    expect(takeJoinLink()).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("leaves an address without a join link alone", () => {
    open("/alltp-tracker/?bridge=8080");
    const before = window.history.state;
    expect(takeJoinLink()).toBeNull();
    expect(window.location.search).toBe("?bridge=8080");
    expect(window.history.state).toBe(before);
  });
});

describe("joinLinkUrl", () => {
  it("holds the game, the room and the slot, never a password", () => {
    const url = new URL(
      joinLinkUrl("https://kqesar.github.io/alltp-tracker/", {
        room: " /connect archipelago.gg:60030 ",
        slot: "Hybrid Hero",
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://kqesar.github.io/alltp-tracker/",
    );
    expect([...url.searchParams]).toEqual([
      ["game", "archipelago"],
      ["room", "/connect archipelago.gg:60030"],
      ["slot", "Hybrid Hero"],
    ]);
    // What the link writes, the link reads back
    expect(readJoinLink(url.search)).toEqual({
      room: "/connect archipelago.gg:60030",
      slot: "Hybrid Hero",
    });
  });
});
