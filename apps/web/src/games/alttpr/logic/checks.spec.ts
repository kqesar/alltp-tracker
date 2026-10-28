import {
  INVERTED_MARKERS,
  LEGACY_DUNGEONS,
  MARKERS,
  OPEN,
  STANDARD,
  settingsFromUpstream,
} from "@alltp/pack-alttpr";
import { beforeEach, describe, expect, it } from "vitest";
import {
  checkStates,
  isCleared,
  runZones,
  zonesOf,
} from "@/games/alttpr/logic/checks";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const ON_MAP = MARKERS.flatMap((marker) => marker.locations);

const zoneNamed = (name: string) => {
  const zone = zonesOf(OPEN).find((z) => z.name === name);
  if (zone === undefined) throw new Error(`No zone ${name}`);
  return zone;
};

describe("zonesOf", () => {
  it("lists every location of the map once, in Open's and Standard's worlds", () => {
    for (const settings of [OPEN, STANDARD]) {
      const ids = zonesOf(settings).flatMap((zone) =>
        zone.checks.map((check) => check.id),
      );
      expect(ids).toHaveLength(ON_MAP.length);
      expect(new Set(ids)).toEqual(new Set(ON_MAP));
    }
  });

  it("names a dungeon's zone after the dungeon, any other after its region", () => {
    const names = zonesOf(OPEN).map((zone) => zone.name);

    expect(names.slice(0, 4)).toEqual([
      "North East Light World",
      "North West Light World",
      "South Light World",
      "Hyrule Castle",
    ]);
    expect(names).toContain("Thieves' Town");
    expect(names).toContain("Ganon's Tower");
    expect(names).not.toContain("Escape");
    expect(zoneNamed("Eastern Palace").dungeon).toBe("eastern-palace");
    expect(zoneNamed("South Light World").dungeon).toBeUndefined();
  });

  it("names a check within its zone", () => {
    expect(zoneNamed("Eastern Palace").checks.map((c) => c.name)).toContain(
      "Compass Chest",
    );
    // A name not starting with its zone's stays whole
    expect(zoneNamed("North West Light World").checks).toContainEqual({
      id: "kakariko-well/top",
      name: "Kakariko Well - Top",
    });
  });

  it("lists an Inverted world's checks where Inverted puts them", () => {
    const inverted = zonesOf(settingsFromUpstream("inverted", {}));
    const ids = inverted.flatMap((zone) =>
      zone.checks.map((check) => check.id),
    );
    expect(new Set(ids)).toEqual(
      new Set(INVERTED_MARKERS.flatMap((marker) => marker.locations)),
    );
    expect(ids).toHaveLength(ON_MAP.length + 1);
    const zoneOf = (id: string) =>
      inverted.find((zone) => zone.checks.some((check) => check.id === id))
        ?.name;
    expect(zoneOf("bomb-merchant")).toBe("South Light World");
    expect(zoneOf("links-house")).toBe("South Dark World");
  });

  it("is worked out once per world", () => {
    expect(zonesOf({ ...OPEN })).toBe(zonesOf(OPEN));
    expect(zonesOf(STANDARD)).not.toBe(zonesOf(OPEN));
  });
});

describe("checkStates", () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  it("says what each check shows: done once checked", () => {
    useGameStore.getState().toggleChecks(["library"]);
    const states = checkStates(useGameStore.getState());

    expect(states.library).toBe("opened");
    expect(states["sahasrahlas-hut/left"]).toBe("available");
    expect(states["kings-tomb"]).toBe("unavailable");
  });

  it("shows a dungeon's item checks done once its counter is 0", () => {
    const eastern = runZones(useGameStore.getState()).find(
      (zone) => zone.dungeon === "eastern-palace",
    );
    if (eastern === undefined) throw new Error("No Eastern Palace");
    expect(isCleared(eastern, useGameStore.getState())).toBe(false);

    useGameStore.setState((state) => ({
      items: { ...state.items, chest0: 0 },
    }));

    const state = useGameStore.getState();
    expect(isCleared(eastern, state)).toBe(true);
    const states = checkStates(state);
    // Its boss's check is the boss's own (below)
    const items = eastern.checks.filter(
      (check) => check.id !== "eastern-palace/boss",
    );
    expect(items.map((check) => states[check.id])).toEqual(
      items.map(() => "opened"),
    );
  });

  it("keeps a cleared dungeon's boss check open until the boss is beaten", () => {
    const index = LEGACY_DUNGEONS.indexOf("desert-palace");
    const desert = runZones(useGameStore.getState()).find(
      (zone) => zone.dungeon === "desert-palace",
    );
    if (desert === undefined) throw new Error("No Desert Palace");
    useGameStore.setState((state) => ({
      items: { ...state.items, [`chest${index}`]: 0 },
    }));

    const others = desert.checks.filter(
      ({ id }) => id !== "desert-palace/boss",
    );
    expect(others).toHaveLength(desert.checks.length - 1);
    const alive = checkStates(useGameStore.getState());
    expect(isCleared(desert, useGameStore.getState())).toBe(true);
    expect(others.map(({ id }) => alive[id])).toEqual(
      others.map(() => "opened"),
    );
    expect(alive["desert-palace/boss"]).toBe("unavailable");

    useGameStore.getState().handleItemClick(`boss${index}`);
    const beaten = checkStates(useGameStore.getState());
    expect(beaten["desert-palace/boss"]).toBe("opened");
  });

  it("shows each check its own state at 0 once the dungeon's checks are ticked", () => {
    const index = LEGACY_DUNGEONS.indexOf("desert-palace");
    const desert = runZones(useGameStore.getState()).find(
      (zone) => zone.dungeon === "desert-palace",
    );
    if (desert === undefined) throw new Error("No Desert Palace");
    // Four chests opened, as autotracking ticks them: their items and the
    // big key make the counter 0, the big chest left holding a dungeon item
    useGameStore
      .getState()
      .toggleChecks([
        "desert-palace/map-chest",
        "desert-palace/torch",
        "desert-palace/big-key-chest",
        "desert-palace/compass-chest",
      ]);
    useGameStore.setState((state) => ({
      items: {
        ...state.items,
        [`bigkey${index}`]: 1,
        book: true,
        [`chest${index}`]: 0,
      },
    }));

    const state = useGameStore.getState();
    expect(isCleared(desert, state)).toBe(false);
    const states = checkStates(state);
    expect(states["desert-palace/big-chest"]).toBe("available");
    expect(states["desert-palace/torch"]).toBe("opened");
    expect(states["desert-palace/boss"]).toBe("unavailable");
  });

  it("still counts a dungeon out whose boss alone is ticked", () => {
    const index = LEGACY_DUNGEONS.indexOf("desert-palace");
    const desert = runZones(useGameStore.getState()).find(
      (zone) => zone.dungeon === "desert-palace",
    );
    if (desert === undefined) throw new Error("No Desert Palace");
    useGameStore.getState().toggleChecks(["desert-palace/boss"]);
    useGameStore.setState((state) => ({
      items: { ...state.items, [`chest${index}`]: 0 },
    }));

    const state = useGameStore.getState();
    expect(isCleared(desert, state)).toBe(true);
    expect(checkStates(state)["desert-palace/big-chest"]).toBe("opened");
  });

  it("has no boss check to keep in the towers, whose bosses are rules", () => {
    useGameStore.setState((state) => ({
      items: { ...state.items, chest12: 0 },
    }));
    const states = checkStates(useGameStore.getState());
    const tower = runZones(useGameStore.getState()).find(
      (zone) => zone.dungeon === "ganons-tower",
    );
    expect(tower?.checks.map(({ id }) => states[id])).toEqual(
      tower?.checks.map(() => "opened"),
    );
  });
});
