import { beforeEach, describe, expect, it } from "vitest";
import { alttpr } from "@/games/alttpr/module";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { sm } from "@/games/sm/module";
import { useSmStore } from "@/games/sm/store";
import { smz3 } from "@/games/smz3/module";
import {
  LOCATION_IDS as SMZ3_LOCATIONS,
  useSmz3Store,
} from "@/games/smz3/store";

const T0 = 1_000_000;

/** A game's saved run cut by its race feed, as the relay would get it. */
const cut = (module: typeof alttpr, key: string) => {
  const saved = localStorage.getItem(key);
  if (saved === null) throw new Error(`nothing saved under ${key}`);
  const race = module.race;
  if (race === undefined) throw new Error("no race feed");
  const value = race.run(saved);
  if (value === null) throw new Error("the feed refused the run");
  return { state: JSON.parse(value).state, value };
};

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  useAutotrackStore.setState({ raceChoice: "auto", reading: null });
  useSmStore.setState(useSmStore.getInitialState(), true);
  useSmz3Store.setState(useSmz3Store.getInitialState(), true);
});

describe("the run the desktop app relays in Race Mode", () => {
  it("keeps of A Link to the Past's run the grid and the timer alone", () => {
    const store = useGameStore.getState();
    store.handleItemClick("hookshot");
    store.toggleChecks(["kings-tomb"]);
    store.noteEntrance("kakariko-shop", "elder-house-east");
    store.startTimer(T0);
    useGameStore.setState({ seed: "eM43RgZ4Gj" });

    const { state, value } = cut(alttpr, "alltp-tracker-state");
    expect(state.items.hookshot).toBe(true);
    expect(state.timer.startedAt).toBe(T0);
    // What a race keeps back: the places checked and when, the entrances
    // noted, the seed
    expect(state).toMatchObject({
      checked: {},
      entrances: {},
      seed: null,
      timeline: {},
    });
    expect(value).not.toContain("kings-tomb");
    expect(value).not.toContain("eM43RgZ4Gj");

    // A device following takes it as a run: the grid comes, nothing else
    useGameStore.setState(useGameStore.getInitialState(), true);
    localStorage.setItem("alltp-tracker-state", value);
    void useGameStore.persist.rehydrate();
    expect(useGameStore.getState().items.hookshot).toBe(true);
    expect(useGameStore.getState().checked).toEqual({});
  });

  it("keeps of Super Metroid's run the grid and the timer alone", () => {
    useSmStore.setState({
      done: ["kraid"],
      found: { "12:3": { at: T0, ms: 1000 } },
      items: { ...useSmStore.getState().items, morph: 1 },
      objectives: ["kraid"],
      seed: "Zebes42",
      wallJump: true,
    });

    const { state, value } = cut(sm, "alltp-tracker-sm");
    expect(state).toMatchObject({
      done: [],
      found: {},
      // A fresh run's, not the player's
      objectives: useSmStore.getInitialState().objectives,
      seed: null,
      wallJump: true,
    });
    expect(state.items.morph).toBe(1);
    expect(value).not.toContain("Zebes42");
    expect(value).not.toContain("12:3");

    useSmStore.setState(useSmStore.getInitialState(), true);
    localStorage.setItem("alltp-tracker-sm", value);
    void useSmStore.persist.rehydrate();
    expect(useSmStore.getState().items.morph).toBe(1);
    expect(useSmStore.getState().wallJump).toBe(true);
  });

  it("keeps of SMZ3's run the grid and the timer alone", () => {
    const checked = SMZ3_LOCATIONS.slice(0, 3);
    useSmz3Store.setState({
      checked,
      items: { ...useSmz3Store.getState().items, moonPearl: 1 },
      pads: { mire: "quake", turtleRock: "ether" },
      seed: "8506bbef2c2b4432af378b571c6c9133",
    });

    const { state, value } = cut(smz3, "alltp-tracker-smz3");
    expect(state).toMatchObject({
      checked: [],
      pads: { mire: "unknown", turtleRock: "unknown" },
      seed: null,
    });
    expect(state.items.moonPearl).toBe(1);
    expect(value).not.toContain("8506bbef");

    useSmz3Store.setState(useSmz3Store.getInitialState(), true);
    localStorage.setItem("alltp-tracker-smz3", value);
    void useSmz3Store.persist.rehydrate();
    expect(useSmz3Store.getState().items.moonPearl).toBe(1);
    expect(useSmz3Store.getState().checked).toEqual([]);
  });

  it("refuses what does not read as a saved run", () => {
    expect(alttpr.race?.run("not json")).toBeNull();
    expect(sm.race?.run(JSON.stringify({ version: 1 }))).toBeNull();
  });
});
