import {
  act,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChecksPanel } from "@/games/archipelago/components/ChecksPanel";
import { FeedWords, lineText } from "@/games/archipelago/components/FeedLine";
import { HintsPanel } from "@/games/archipelago/components/HintsPanel";
import { ItemsPanel } from "@/games/archipelago/components/ItemsPanel";
import { worldNames } from "@/games/archipelago/fixtures";
import { useApNamesStore } from "@/games/archipelago/names";
import { overlayReadingOf, overlaySource } from "@/games/archipelago/overlay";
import {
  type ApItem,
  type ApRoom,
  freshRun,
  useArchipelagoStore,
} from "@/games/archipelago/store";
import { ALTTP_SKIN } from "@/games/archipelago/worlds/alttp";
import {
  hasSkin,
  loadSkin,
  skinNow,
  useSkin,
} from "@/games/archipelago/worlds/skins";
import { SMZ3_SKIN } from "@/games/archipelago/worlds/smz3";

const room = (game: string, slot: number, slotName: string): ApRoom => ({
  checksum: worldNames(game).checksum,
  game,
  generatorVersion: "0.6.8",
  seedName: "4242",
  slot,
  slotName,
  team: 0,
});
const SAMUS = room("Super Metroid", 2, "Samus");
const HYBRID = room("SMZ3", 3, "Hybrid Hero");

const item = (name: string, count = 1, flags = 1): ApItem => ({
  count,
  flags,
  name,
});

/** A run on the board, as the server last stated it. */
const lay = (on: ApRoom, items: ApItem[], change = {}) =>
  act(() =>
    useArchipelagoStore.getState().apply({
      ...freshRun(),
      items,
      room: on,
      updatedAt: 1,
      ...change,
    }),
  );

beforeEach(() => {
  localStorage.clear();
  useArchipelagoStore.setState(useArchipelagoStore.getInitialState(), true);
  useApNamesStore.setState({ groups: null, names: null });
});

describe("the skins' chunks", () => {
  it("load once per world, none for a world without a skin", async () => {
    expect(hasSkin("SMZ3")).toBe(true);
    expect(hasSkin("Clique")).toBe(false);
    expect(hasSkin(undefined)).toBe(false);
    expect(hasSkin("toString")).toBe(false);
    expect(skinNow("Clique")).toBeNull();
    const [first, second] = await Promise.all([
      loadSkin("SMZ3"),
      loadSkin("SMZ3"),
    ]);
    expect(first).toBe(SMZ3_SKIN);
    expect(second).toBe(first);
    expect(await loadSkin("SMZ3")).toBe(first);
    expect(skinNow("SMZ3")).toBe(SMZ3_SKIN);
    expect(await loadSkin("Clique")).toBeNull();
  });

  it("render a component again once the chunk arrived", async () => {
    const { result, rerender } = renderHook(({ game }) => useSkin(game), {
      initialProps: { game: "A Link to the Past" as string | undefined },
    });
    await vi.waitFor(() => expect(result.current).toBe(ALTTP_SKIN));
    rerender({ game: undefined });
    expect(result.current).toBeNull();
  });
});

describe("a Super Metroid slot", () => {
  it("draws VARIA's names on Map Rando's sheet, packs and tanks counted", async () => {
    lay(SAMUS, [
      item("Morph Ball"),
      item("Missile", 9),
      item("Energy Tank", 3),
      item("Nothing", 2, 0),
    ]);
    render(<ItemsPanel />);
    const morph = await screen.findByTestId("ap-item-morph");
    expect(morph).toHaveTextContent("Morph Ball, received");
    expect(morph).toHaveClass("ap-cell--sm");
    expect(morph).not.toHaveClass("griditem--dimmed");
    expect(morph.style.getPropertyValue("--frame")).toBe("19");
    const missile = screen.getByTestId("ap-item-missile");
    expect(missile).toHaveTextContent("Missile, 9 received9");
    expect(within(missile).getByText("9")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByTestId("ap-item-pb")).toHaveClass("griditem--dimmed");
    expect(screen.getByTestId("ap-item-pb")).toHaveTextContent(
      "Power Bomb, not received",
    );
    expect(
      within(screen.getByTestId("ap-item-list"))
        .getAllByTestId("ap-list-item")
        .map((li) => li.textContent),
    ).toEqual(["Nothing×, 2"]);
  });

  it("groups its checks by VARIA's areas, AP naming none", async () => {
    const names = worldNames("Super Metroid");
    const id = (name: string) => names.locationIds.get(name) ?? -1;
    lay(SAMUS, [], {
      checked: [id("Varia Suit")],
      missing: [id("Energy Tank, Kraid"), id("Bomb")],
    });
    // The server's groups, Everywhere left out: none
    act(() => useApNamesStore.setState({ groups: {}, names }));
    render(<ChecksPanel />);
    const kraid = await screen.findByTestId("ap-zone-Kraid's Lair");
    expect(kraid).toHaveTextContent("Kraid's Lair — 1 left / 2");
    expect(
      screen.getByTestId("ap-zone-Crateria and Blue Brinstar"),
    ).toHaveTextContent("1 left / 1");
    expect(screen.queryByTestId("ap-zone-Other locations")).toBeNull();
  });
});

describe("an SMZ3 slot", () => {
  it("draws both games, keys as each dungeon's pool holds them", async () => {
    lay(HYBRID, [
      item("ProgressiveSword", 2),
      item("Varia"),
      item("BigKeyEP"),
      item("KeyHC"),
      item("HeartPiece", 4, 0),
    ]);
    render(<ItemsPanel />);
    expect(await screen.findByTestId("ap-item-sword")).toHaveTextContent(
      "Sword, Master Sword",
    );
    expect(screen.getByTestId("ap-item-varia")).toHaveClass("ap-cell--sm");
    expect(screen.getByTestId("ap-item-keys-ep")).toHaveTextContent(
      "Eastern Palace: big key received",
    );
    expect(screen.getByTestId("ap-item-keys-hc")).toHaveTextContent(
      "Hyrule Castle: 1 small key",
    );
    // No keycard yet: no keycards' row
    expect(screen.queryByTestId("ap-item-cards-cr")).toBeNull();
    // TotalSMZ3's identifiers in words, AP's own name kept as the title
    const heart = within(screen.getByTestId("ap-item-list")).getByText(
      "Heart Piece",
    );
    expect(heart).toHaveAttribute("title", "HeartPiece");
    expect(heart).toHaveAccessibleDescription("HeartPiece");
    expect(useArchipelagoStore.getState().items.at(-1)?.name).toBe(
      "HeartPiece",
    );
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(63);
  });

  it("adds the keycards' row with the first card, each level in words", async () => {
    lay(HYBRID, [item("CardCrateriaL1"), item("CardCrateriaBoss")]);
    render(<ItemsPanel />);
    const crateria = await screen.findByTestId("ap-item-cards-cr");
    expect(crateria).toHaveTextContent(
      "Crateria keycards: level 1 received, level 2 not received, boss received",
    );
    expect(screen.getByTestId("ap-item-cards-ws")).toHaveTextContent(
      "Wrecked Ship keycards: level 1 not received, boss not received",
    );
    expect(screen.getByTestId("ap-item-smmaps")).toHaveTextContent(
      "Super Metroid maps, not received",
    );
  });
});

describe("an SMZ3 item named elsewhere on the board", () => {
  it("reads in words in the feed and the hints, by the item's world", () => {
    const entry = {
      flags: 1,
      kind: "item" as const,
      mine: true,
      parts: [
        { flags: 1, game: "SMZ3", kind: "item" as const, text: "BombUpgrade5" },
        { kind: "text" as const, text: " and " },
        {
          flags: 1,
          game: "A Link to the Past",
          kind: "item" as const,
          text: "Bomb Upgrade (+5)",
        },
      ],
      received: true,
      seq: 1,
    };
    render(<FeedWords entry={entry} />);
    expect(screen.getByText("Bomb Upgrade 5")).toHaveAttribute(
      "title",
      "BombUpgrade5",
    );
    expect(screen.getByText("Bomb Upgrade (+5)")).not.toHaveAttribute("title");
    expect(lineText(entry)).toBe("Bomb Upgrade 5 and Bomb Upgrade (+5)");
  });

  it("reads in words in a hint for an SMZ3 player", () => {
    lay(SAMUS, [], {
      hints: [
        {
          entrance: "",
          finder: "Samus",
          flags: 1,
          forMe: false,
          item: "ProgressiveSword",
          location: "Bomb",
          receiver: "Hybrid Hero",
          status: "priority",
        },
      ],
      players: [
        { game: "Super Metroid", name: "Samus", slot: 2, status: null },
        { game: "SMZ3", name: "Hybrid Hero", slot: 3, status: null },
      ],
    });
    render(<HintsPanel />);
    expect(screen.getByTestId("ap-hint")).toHaveTextContent(
      "PriorityProgressive Sword for Hybrid Hero at Bomb",
    );
  });
});

describe("the overlay's whitelist", () => {
  it("tells a world without a skin's items alone, by name", () => {
    const reading = overlayReadingOf({
      items: [{ count: 2, flags: 1, name: "Feather" }],
    });
    expect(reading).toEqual({
      fresh: false,
      state: {
        game: "archipelago",
        goMode: null,
        items: [{ id: "Feather", level: 2, max: 2, name: "Feather" }],
        objectives: [],
        timer: null,
      },
    });
    expect(overlayReadingOf({ items: [] }).fresh).toBe(true);
  });

  it("lists a skin's every item, held or not, its pool where AP fixes it", () => {
    const { state } = overlayReadingOf(
      {
        items: [
          item("Rupees (20)", 3, 0),
          item("Progressive Sword", 2),
          item("Small Key (Ice Palace)", 2),
        ],
      },
      ALTTP_SKIN,
    );
    const byId = new Map(state.items.map((entry) => [entry.id, entry]));
    expect(state.items[0]).toEqual({
      id: "Progressive Sword",
      level: 2,
      max: 4,
      name: "Progressive Sword",
    });
    expect(byId.get("Hookshot")).toMatchObject({ level: 0, max: 1 });
    expect(byId.get("Bottle (Fairy)")).toMatchObject({ level: 0, max: 4 });
    expect(byId.get("Big Key (Ice Palace)")).toMatchObject({ max: 1 });
    // Open-ended: the count is the most
    expect(byId.get("Small Key (Ice Palace)")).toMatchObject({
      level: 2,
      max: 2,
    });
    expect(byId.get("Small Key (Desert Palace)")).toMatchObject({
      level: 0,
      max: 0,
    });
    // What no cell counts comes last
    expect(state.items.at(-1)).toEqual({
      id: "Rupees (20)",
      level: 3,
      max: 3,
      name: "Rupees (20)",
    });
    const smz3 = overlayReadingOf({ items: [] }, SMZ3_SKIN).state.items;
    expect(smz3.find((entry) => entry.id === "CardNorfairL2")).toMatchObject({
      max: 1,
    });
    expect(smz3.find((entry) => entry.id === "ETank")).toMatchObject({
      max: 0,
    });
  });

  it("reads the store, the skin once its chunk arrived, and follows it", async () => {
    let calls = 0;
    const stop = overlaySource.subscribe(() => calls++);
    lay(HYBRID, [item("Bombs (3)", 1, 0)]);
    expect(calls).toBeGreaterThanOrEqual(1);
    await vi.waitFor(() =>
      expect(overlaySource.read().state.items[0]?.id).toBe("ProgressiveSword"),
    );
    stop();
    const after = calls;
    lay(HYBRID, []);
    expect(calls).toBe(after);
    expect(overlaySource.read().state.items.at(-1)?.id).not.toBe("Bombs (3)");
    // Nothing of the room reaches the API
    lay(HYBRID, [item("Bombs (3)", 1, 0)]);
    expect(JSON.stringify(overlaySource.read())).not.toContain("4242");
    expect(JSON.stringify(overlaySource.read())).not.toContain("Hybrid");
  });
});
