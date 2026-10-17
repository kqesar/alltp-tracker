import { MARKERS, OPEN, STANDARD } from "@alltp/pack-alttpr";
import { beforeEach, describe, expect, it } from "vitest";
import { checkStates, isCleared, runZones, zonesOf } from "@/logic/checks";
import { useGameStore } from "@/stores/gameStore";

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

  it("is worked out once per world", () => {
    expect(zonesOf({ ...OPEN })).toBe(zonesOf(OPEN));
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

  it("shows a dungeon's checks done once its counter is 0", () => {
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
    expect(eastern.checks.map((check) => states[check.id])).toEqual(
      eastern.checks.map(() => "opened"),
    );
  });
});
