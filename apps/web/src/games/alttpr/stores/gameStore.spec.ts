import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_KEYMAP, DEFAULT_SHORTCUTS } from "@/games/alttpr/data/keymap";
import { getPreset, sameSettings } from "@/games/alttpr/data/presets";
import v1Export from "@/games/alttpr/stores/fixtures/v1-export.json";
import v2Export from "@/games/alttpr/stores/fixtures/v2-export.json";
import v5KeysanityExport from "@/games/alttpr/stores/fixtures/v5-keysanity-export.json";
import v5LocalStorage from "@/games/alttpr/stores/fixtures/v5-local-storage.json";
import { isFreshRun, useGameStore } from "@/games/alttpr/stores/gameStore";
import {
  PERSIST_VERSION,
  type Progress,
  parseSave,
} from "@/games/alttpr/stores/persistence";

const STORAGE_KEY = "alltp-tracker-state";

/** Read a save file and load it, as Import does once the player confirms. */
const importSave = (json: string) => {
  const save = parseSave(json);
  if (!save.ok) throw new Error(save.reason);
  useGameStore.getState().loadProgress(save.progress);
};

/** Write a save the way an older release left it in localStorage. */
const storeSave = (state: object, version: number) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version }));

describe("GameStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  it("asks a Ganonhunt for its own 40 pieces, and keeps where swords are only with swords", () => {
    useGameStore.getState().applyPreset("ganonhunt");
    expect(useGameStore.getState().items.goalpieces).toBe(40);
    expect(useGameStore.getState().items.triforce).toBe(0);

    const { updateSettings } = useGameStore.getState();
    updateSettings({ enemyHealth: "hard", swords: "assured" });
    expect(useGameStore.getState().settings).toMatchObject({
      enemyHealth: "hard",
      swords: "assured",
    });
    // Randomized and default are said by their absence
    updateSettings({ enemyHealth: "default", swords: "randomized" });
    expect(useGameStore.getState().settings).not.toHaveProperty("swords");
    expect(useGameStore.getState().settings).not.toHaveProperty("enemyHealth");
    // Swordless: no swords to place
    updateSettings({ swords: "vanilla" });
    updateSettings({ swordless: true });
    expect(useGameStore.getState().settings).not.toHaveProperty("swords");
  });

  it("starts a fresh Open run with nothing found", () => {
    const state = useGameStore.getState();

    expect(state.presetId).toBe("open");
    expect(state.medallions).toEqual(Array(10).fill(0));
    expect(state.smallKeys).toEqual(Array(13).fill(0));
    expect(state.checked).toEqual({});
    expect(state.items.boss0).toBe(1);
    expect(
      Array.from({ length: 10 }, (_, index) => state.items[`chest${index}`]),
    ).toEqual([3, 2, 2, 5, 6, 2, 4, 3, 2, 5]);
    expect(state.bigKeysVisible).toBe(false);
    expect(state.mapLayout).toBe("auto");
  });

  describe("item clicks", () => {
    it("toggles a boolean item", () => {
      useGameStore.getState().handleItemClick("hookshot");
      expect(useGameStore.getState().items.hookshot).toBe(true);

      useGameStore.getState().handleItemClick("hookshot");
      expect(useGameStore.getState().items.hookshot).toBe(false);
    });

    it("steps a progressive item up", () => {
      useGameStore.getState().handleItemClick("bow");

      expect(useGameStore.getState().items.bow).toBe(1);
    });

    it("counts a dungeon's chests down and wraps back to full", () => {
      const { handleItemClick } = useGameStore.getState();

      handleItemClick("chest0");
      expect(useGameStore.getState().items.chest0).toBe(2);

      handleItemClick("chest0");
      handleItemClick("chest0");
      expect(useGameStore.getState().items.chest0).toBe(0);

      handleItemClick("chest0");
      expect(useGameStore.getState().items.chest0).toBe(3);
    });

    it("counts every location of a keysanity dungeon", () => {
      useGameStore.getState().applyPreset("keysanity");
      expect(useGameStore.getState().items.chest3).toBe(14);

      useGameStore.getState().handleItemClick("chest3", -1);
      expect(useGameStore.getState().items.chest3).toBe(0);
      useGameStore.getState().handleItemClick("chest3", -1);
      expect(useGameStore.getState().items.chest3).toBe(1);
    });

    it("toggles a boss between alive and beaten", () => {
      useGameStore.getState().handleItemClick("boss4");
      expect(useGameStore.getState().items.boss4).toBe(2);

      useGameStore.getState().handleItemClick("boss4");
      expect(useGameStore.getState().items.boss4).toBe(1);
    });

    it("ignores blank item clicks", () => {
      const before = useGameStore.getState().items;

      useGameStore.getState().handleItemClick("");
      useGameStore.getState().handleItemClick("blank");

      expect(useGameStore.getState().items).toBe(before);
    });
  });

  describe("medallions", () => {
    it("stores the medallion picked for a dungeon", () => {
      useGameStore.getState().handleMedallionChange(8, 2);

      expect(useGameStore.getState().medallions[8]).toBe(2);
    });

    it("steps a medallion through its four states both ways, wrapping", () => {
      const { stepMedallion } = useGameStore.getState();
      const seen = [1, 1, 1, 1].map(() => {
        stepMedallion(9);
        return useGameStore.getState().medallions[9];
      });

      expect(seen).toEqual([1, 2, 3, 0]);
      useGameStore.getState().stepMedallion(9, -1);
      expect(useGameStore.getState().medallions[9]).toBe(3);
    });
  });

  describe("checked locations", () => {
    const SHED = ["mire-shed/left", "mire-shed/right"];

    it("checks a marker's locations together, then none of them", () => {
      useGameStore.getState().toggleChecks(SHED);
      expect(useGameStore.getState().checked).toEqual({
        "mire-shed/left": true,
        "mire-shed/right": true,
      });

      useGameStore.getState().toggleChecks(SHED);
      expect(useGameStore.getState().checked).toEqual({});
    });

    it("checks them all while any is left, and leaves the rest alone", () => {
      useGameStore.getState().toggleChecks(["kings-tomb"]);
      useGameStore.getState().toggleChecks(["mire-shed/left"]);

      useGameStore.getState().toggleChecks(SHED);

      expect(Object.keys(useGameStore.getState().checked).sort()).toEqual([
        "kings-tomb",
        "mire-shed/left",
        "mire-shed/right",
      ]);
    });

    it("records nothing for a marker that stands for no location", () => {
      const before = useGameStore.getState();

      before.toggleChecks([]);

      expect(useGameStore.getState()).toBe(before);
    });
  });

  describe("Small Keys", () => {
    it("counts each dungeon's keys up to its maximum, then back to 0", () => {
      // Eastern Palace has none: its count stays 0, and nothing is recorded
      const maxValues = [0, 1, 1, 6, 1, 3, 1, 2, 3, 4];

      useGameStore.getState().handleSmallKeyClick(0);
      useGameStore.getState().handleSmallKeyClick(0, -1);
      expect(useGameStore.getState().smallKeys[0]).toBe(0);
      expect(useGameStore.getState().past).toEqual([]);

      maxValues.forEach((max, dungeonIndex) => {
        if (max === 0) return;
        for (let count = 1; count <= max; count++) {
          useGameStore.getState().handleSmallKeyClick(dungeonIndex);
          expect(useGameStore.getState().smallKeys[dungeonIndex]).toBe(count);
        }

        useGameStore.getState().handleSmallKeyClick(dungeonIndex);
        expect(useGameStore.getState().smallKeys[dungeonIndex]).toBe(0);
      });
    });
  });

  describe("new game", () => {
    it("clears the run but keeps the preset and the display preferences", () => {
      const state = useGameStore.getState();
      state.applyPreset("keysanity");
      state.setMapLayout("stacked");
      state.setBigKeysVisible(false);
      state.toggleChecks(["kings-tomb"]);
      state.handleItemClick("boss0");
      state.handleItemClick("hookshot");
      state.handleSmallKeyClick(3);
      state.handleMedallionChange(8, 3);

      useGameStore.getState().reset();

      const after = useGameStore.getState();
      expect(after.checked).toEqual({});
      expect(after.items.boss0).toBe(1);
      expect(after.items.chest3).toBe(14);
      expect(after.items.hookshot).toBe(false);
      expect(after.smallKeys[3]).toBe(0);
      expect(after.medallions[8]).toBe(0);
      expect(after.presetId).toBe("keysanity");
      expect(after.mapLayout).toBe("stacked");
      expect(after.bigKeysVisible).toBe(false);
    });
  });

  describe("a run's type and settings", () => {
    const FIVE_FIVE = {
      ...useGameStore.getInitialState().settings,
      crystalsGanon: 5,
      crystalsTower: 5,
    };

    it("starts a run of other settings as one undo step, laying the game on it", () => {
      const state = useGameStore.getState();
      state.handleItemClick("hookshot");

      state.applyRun(
        "keysanity",
        { ...FIVE_FIVE, dungeonItems: "full" },
        (fresh) => ({
          items: { ...fresh.items, flute: true },
        }),
      );

      const after = useGameStore.getState();
      expect(after.presetId).toBe("keysanity");
      expect(after.settings.crystalsTower).toBe(5);
      expect(after.items).toMatchObject({
        chest3: 14,
        flute: true,
        hookshot: false,
      });
      expect(after.bigKeysVisible).toBe(true);

      after.undo();
      const back = useGameStore.getState();
      expect(back.presetId).toBe("open");
      expect(back.items).toMatchObject({ flute: false, hookshot: true });
    });

    it("keeps a run's settings through a new game", () => {
      useGameStore.getState().applyRun("open", FIVE_FIVE);
      useGameStore.getState().handleItemClick("hookshot");

      useGameStore.getState().reset();

      expect(useGameStore.getState().settings).toEqual(FIVE_FIVE);
    });

    it("tunes a run's settings in place, as one undo step", () => {
      const store = () => useGameStore.getState();
      store().handleItemClick("hookshot");
      store().handleItemClick("chest3");
      const before = store().settings;

      store().updateSettings({ crystalsTower: 4, itemPool: "hard" });

      expect(store().settings).toEqual({
        ...before,
        crystalsTower: 4,
        itemPool: "hard",
      });
      expect(store().items).toMatchObject({ chest3: 4, hookshot: true });
      expect(store().presetId).toBe("open");
      store().undo();
      expect(store().settings).toEqual(before);
      expect(store().items.hookshot).toBe(true);
    });

    it("sets the glitches by hand, None said by their absence", () => {
      const store = () => useGameStore.getState();
      store().updateSettings({ glitches: "major_glitches" });
      expect(store().settings.glitches).toBe("major_glitches");
      store().updateSettings({ glitches: "none" });
      expect(store().settings).not.toHaveProperty("glitches");
      const past = store().past;
      store().updateSettings({ glitches: "none" });
      expect(store().past).toBe(past);
    });

    it("sets the boss shuffle by hand, None said by its absence as in a preset", () => {
      const store = () => useGameStore.getState();
      store().updateSettings({ bossShuffle: "simple" });
      expect(store().settings.bossShuffle).toBe("simple");
      store().updateSettings({ bossShuffle: "none" });
      expect(store().settings).not.toHaveProperty("bossShuffle");
      expect(sameSettings(store().settings, getPreset("open").settings)).toBe(
        true,
      );
    });

    it("keeps the glitches a No Logic run is played with to that run", () => {
      const store = () => useGameStore.getState();
      store().updateSettings({ glitches: "no_logic" });
      store().updateSettings({ playGlitches: "overworld_glitches" });
      expect(store().settings).toMatchObject({
        glitches: "no_logic",
        playGlitches: "overworld_glitches",
      });
      store().updateSettings({ playGlitches: "none" });
      expect(store().settings).not.toHaveProperty("playGlitches");
      store().updateSettings({ playGlitches: "overworld_glitches" });
      // Another logic drops them
      store().updateSettings({ glitches: "major_glitches" });
      expect(store().settings).not.toHaveProperty("playGlitches");
    });

    it("starts a bomb-bag run's bombs at none, and steps them a bag at a time", () => {
      const store = () => useGameStore.getState();
      store().applyRun("door-randomizer", {
        ...getPreset("door-randomizer").settings,
        bombBag: true,
      });
      expect(store().items.bombcapacity).toBe(0);
      store().handleItemClick("bombcapacity");
      expect(store().items.bombcapacity).toBe(10);
      // Turned off, the run's own 10; on again, none: a 10 kept would say
      // the bag found
      store().updateDoorSettings({ bombBag: false });
      expect(store().items.bombcapacity).toBe(10);
      store().handleItemClick("bombcapacity");
      expect(store().items.bombcapacity).toBe(15);
      store().updateDoorSettings({ bombBag: true });
      expect(store().items.bombcapacity).toBe(0);
      // Not known: the cell is left as it is
      store().handleItemClick("bombcapacity");
      store().updateDoorSettings({ bombBag: undefined });
      expect(store().items.bombcapacity).toBe(10);
      store().applyPreset("door-randomizer");
      expect(store().items.bombcapacity).toBe(10);
    });

    it("sets a Door Randomizer setting back to unset, as its absence", () => {
      useGameStore.getState().applyPreset("door-crosskeys");
      useGameStore.getState().updateDoorSettings({ shuffleLinks: false });
      expect(useGameStore.getState().settings.shuffleLinks).toBe(false);

      useGameStore.getState().updateDoorSettings({ shuffleLinks: undefined });

      expect(useGameStore.getState().settings).not.toHaveProperty(
        "shuffleLinks",
      );
      expect(useGameStore.getState().past).toHaveLength(3);
    });

    it("records no step for settings that change nothing", () => {
      const past = useGameStore.getState().past;

      useGameStore.getState().updateSettings({ itemPlacement: "advanced" });

      expect(useGameStore.getState().past).toBe(past);
    });

    it("tells a fresh run from one with anything noted", () => {
      expect(isFreshRun(useGameStore.getState())).toBe(true);
      useGameStore
        .getState()
        .applyRun("keysanity", useGameStore.getState().settings);
      expect(isFreshRun(useGameStore.getState())).toBe(true);

      for (const note of [
        () => useGameStore.getState().handleItemClick("hookshot"),
        () => useGameStore.getState().handleItemClick("chest0"),
        () => useGameStore.getState().toggleChecks(["library"]),
        () => useGameStore.getState().handleSmallKeyClick(3),
        () => useGameStore.getState().handleMedallionChange(8, 1),
      ]) {
        useGameStore.getState().reset();
        note();
        expect(isFreshRun(useGameStore.getState())).toBe(false);
      }
    });
  });

  describe("export and import", () => {
    it("round-trips the progress of a run", () => {
      const { handleItemClick, toggleChecks, handleMedallionChange, reset } =
        useGameStore.getState();
      handleItemClick("hookshot");
      handleItemClick("boss3");
      toggleChecks(["links-house"]);
      handleMedallionChange(8, 2);
      const saved = useGameStore.getState().exportState();

      reset();
      expect(useGameStore.getState().checked).toEqual({});

      importSave(saved);

      const state = useGameStore.getState();
      expect(state.items.hookshot).toBe(true);
      expect(state.items.boss3).toBe(2);
      expect(state.checked).toEqual({ "links-house": true });
      expect(state.medallions[8]).toBe(2);
    });

    it("carries a dungeon's map and compass, and reads a save without them", () => {
      useGameStore.getState().applyPreset("keysanity");
      useGameStore.getState().handleItemClick("map3");
      useGameStore.getState().handleItemClick("compass9");
      const saved = useGameStore.getState().exportState();
      useGameStore.getState().reset();

      importSave(saved);
      expect(useGameStore.getState().items).toMatchObject({
        compass3: 0,
        compass9: 1,
        map3: 1,
      });

      // A save from before them holds neither: they start not found
      const older = JSON.parse(saved);
      delete older.progress.items.compass9;
      delete older.progress.items.map3;
      importSave(JSON.stringify(older));
      expect(useGameStore.getState().items).toMatchObject({
        compass9: 0,
        map3: 0,
      });
    });

    it("keeps this device's display preferences", () => {
      const saved = useGameStore.getState().exportState();
      useGameStore.getState().setMapLayout("stacked");
      useGameStore.getState().setBigKeysVisible(true);

      importSave(saved);

      expect(useGameStore.getState().mapLayout).toBe("stacked");
      expect(useGameStore.getState().bigKeysVisible).toBe(true);
    });

    it("reads a version 1 export, whose map kept its own beaten flags", () => {
      importSave(JSON.stringify(v1Export));

      const { checked, items, medallions } = useGameStore.getState();
      // dungeonsBeaten[0] from the map, boss2 from the grid
      expect(items.boss0).toBe(2);
      expect(items.boss2).toBe(2);
      expect(items.boss1).toBe(1);
      expect(items).toMatchObject({ bow: 3, chest3: 2, hookshot: true });
      expect(items).not.toHaveProperty("dungeon");
      expect(medallions[8]).toBe(2);
      // 65 flags: King's Tomb, Light World Swamp, Kakariko Well, the second
      // West of Sanctuary (folded into the first) and Bridge, which stands
      // for no location
      expect(Object.keys(checked).sort()).toEqual([
        "floodgate-chest",
        "kakariko-well/bottom",
        "kakariko-well/left",
        "kakariko-well/middle",
        "kakariko-well/right",
        "kakariko-well/top",
        "kings-tomb",
        "pegasus-rocks",
        "sunken-treasure",
      ]);
    });

    it("reads a version 2 export the same way", () => {
      importSave(JSON.stringify(v2Export));

      const state = useGameStore.getState();
      expect(state.checked).toEqual(
        expect.objectContaining({ "kings-tomb": true, "pegasus-rocks": true }),
      );
      expect(Object.keys(state.checked)).toHaveLength(9);
      expect(state.items).toMatchObject({ boss0: 2, glove: 1 });
      expect(state.presetId).toBe("open");
    });

    it("moves an older export's chest flags past the removed duplicate chest", () => {
      // 65 flags: the table listed West of Sanctuary at both 18 and 19
      const chestsOpened = Array(65).fill(false);
      chestsOpened[19] = true; // the duplicate West of Sanctuary
      chestsOpened[20] = true; // the chest after it
      chestsOpened[64] = true; // the last chest, Bridge

      importSave(JSON.stringify({ chestsOpened }));

      expect(Object.keys(useGameStore.getState().checked).sort()).toEqual([
        "mini-moldorm-cave/far-left",
        "mini-moldorm-cave/far-right",
        "mini-moldorm-cave/left",
        "mini-moldorm-cave/npc",
        "mini-moldorm-cave/right",
        "pegasus-rocks",
      ]);
    });

    it("reads a version 5 keysanity file, its counters by the items found", () => {
      importSave(JSON.stringify(v5KeysanityExport));

      const state = useGameStore.getState();
      expect(state.presetId).toBe("keysanity");
      // Found 3 of Eastern Palace's 3 and 3 of Palace of Darkness's 5; the
      // counters now count every location, 6 and 14
      expect(state.items.chest0).toBe(3);
      expect(state.items.chest3).toBe(11);
      expect(state.items.chest4).toBe(10);
      expect(state.smallKeys[3]).toBe(2);
      // King's Tomb and Paradox Cave's 7 chests; Bridge stands for none
      expect(Object.keys(state.checked)).toHaveLength(8);
      expect(state.checked).toMatchObject({
        "kings-tomb": true,
        "paradox-cave-upper/right": true,
      });
    });
  });

  describe("persistence", () => {
    it("saves progress and preferences", () => {
      useGameStore.getState().handleItemClick("flute");

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(stored.version).toBe(PERSIST_VERSION);
      expect(stored.state.items.flute).toBe(true);
      expect(stored.state).toHaveProperty("mapLayout");
      expect(stored.state.game).toBe("alttpr");
      expect(stored.state).not.toHaveProperty("chestsOpened");
    });

    it("keeps the map panel's view, which a save without a valid one leaves on the map", async () => {
      useGameStore.getState().setMapView("checks");
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(stored.state.mapView).toBe("checks");

      await useGameStore.persist.rehydrate();
      expect(useGameStore.getState().mapView).toBe("checks");

      useGameStore.setState(useGameStore.getInitialState(), true);
      storeSave({ mapView: "list" }, PERSIST_VERSION);
      await useGameStore.persist.rehydrate();
      expect(useGameStore.getState().mapView).toBe("map");
    });

    it("takes no note of this tab's run from a save that holds none", async () => {
      // An older version's tab starts a New game: its save holds no door,
      // entrance or overworld notes, nor a seed
      useGameStore.setState({
        doors: { links: { a: "b" } },
        entrances: { "links-house": "links-house" },
        overworld: { flute: [0x18] },
      });
      storeSave({ items: { flute: true } }, PERSIST_VERSION);
      await useGameStore.persist.rehydrate();
      const state = useGameStore.getState();
      expect(state.items.flute).toBe(true);
      expect(state.doors).toEqual({});
      expect(state.entrances).toEqual({});
      expect(state.overworld).toEqual({});
      expect(state.seed).toBeNull();
    });

    it("restores the valid fields of a damaged save and resets the rest", async () => {
      storeSave(
        { items: { flute: true }, medallions: "x", smallKeys: [99] },
        PERSIST_VERSION,
      );

      await useGameStore.persist.rehydrate();

      const state = useGameStore.getState();
      expect(state.items.flute).toBe(true);
      expect(state.medallions).toEqual(Array(10).fill(0));
      expect(state.smallKeys).toEqual(Array(13).fill(0));
    });

    it("upgrades a version 1 save, folding map-beaten bosses into the grid", async () => {
      storeSave(
        {
          // Version 1 tables had 65 chests
          chestsOpened: Array.from({ length: 65 }, (_, index) => index === 1),
          dungeonsBeaten: [false, false, false, true],
          items: { boss5: 2 },
          mapLayout: "stacked",
        },
        1,
      );

      await useGameStore.persist.rehydrate();

      const state = useGameStore.getState();
      expect(state.items.boss3).toBe(2);
      expect(state.items.boss5).toBe(2);
      expect(state.items.boss4).toBe(1);
      // Light World Swamp: the Floodgate Chest and the Sunken Treasure
      expect(state.checked).toEqual({
        "floodgate-chest": true,
        "sunken-treasure": true,
      });
      expect(state.mapLayout).toBe("stacked");

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(stored.version).toBe(PERSIST_VERSION);
      expect(stored.state).not.toHaveProperty("dungeonsBeaten");
    });

    it("upgrades the version 5 save a player left, keeping its preferences", async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v5LocalStorage));

      await useGameStore.persist.rehydrate();

      const state = useGameStore.getState();
      // Link's House, Sahasrahla's Hut (3), Hyrule Castle (4)
      expect(Object.keys(state.checked).sort()).toEqual([
        "hyrule-castle/boomerang-chest",
        "hyrule-castle/map-chest",
        "hyrule-castle/zeldas-cell",
        "links-house",
        "sahasrahlas-hut/left",
        "sahasrahlas-hut/middle",
        "sahasrahlas-hut/right",
        "sewers/dark-cross",
      ]);
      expect(state.items).toMatchObject({ chest0: 0, hammer: true });
      expect(state.mapLayout).toBe("stacked");
      // Its keymap gets the half magic's keys, which it left free
      expect(state.shortcuts).toEqual({
        enabled: false,
        keymap: {
          "advance:hookshot": "KeyH",
          "advance:magic": "Slash",
          "back:magic": "Shift+Slash",
        },
      });
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(stored.version).toBe(PERSIST_VERSION);
      expect(stored.state.checked).toEqual(state.checked);
      expect(stored.state).not.toHaveProperty("chestsOpened");
    });
  });

  describe("Run-type presets", () => {
    it("switches preset, turns key cells on for keysanity and clears the board", () => {
      useGameStore.getState().toggleChecks(["kings-tomb"]);

      useGameStore.getState().applyPreset("keysanity");

      const state = useGameStore.getState();
      expect(state.presetId).toBe("keysanity");
      expect(state.settings.dungeonItems).toBe("full");
      expect(state.bigKeysVisible).toBe(true);
      expect(state.checked).toEqual({});
    });

    it("turns key cells off when leaving keysanity", () => {
      useGameStore.getState().applyPreset("keysanity");
      useGameStore.getState().applyPreset("open");

      expect(useGameStore.getState().bigKeysVisible).toBe(false);
    });

    it("keeps the player's key-cell choice between two non-keysanity presets", () => {
      useGameStore.getState().setBigKeysVisible(true);

      useGameStore.getState().applyPreset("standard");

      expect(useGameStore.getState().bigKeysVisible).toBe(true);
    });

    it("keeps the map layout across a preset switch", () => {
      useGameStore.getState().setMapLayout("stacked");

      useGameStore.getState().applyPreset("keysanity");

      expect(useGameStore.getState().mapLayout).toBe("stacked");
    });
  });

  describe("undo and redo", () => {
    it("steps back through changes and forward again", () => {
      const { handleItemClick } = useGameStore.getState();
      handleItemClick("bow");
      handleItemClick("hookshot");

      useGameStore.getState().undo();
      expect(useGameStore.getState().items.hookshot).toBe(false);
      expect(useGameStore.getState().items.bow).toBe(1);

      useGameStore.getState().undo();
      expect(useGameStore.getState().items.bow).toBe(0);

      useGameStore.getState().redo();
      useGameStore.getState().redo();
      expect(useGameStore.getState().items.bow).toBe(1);
      expect(useGameStore.getState().items.hookshot).toBe(true);
    });

    it("records every kind of progress change", () => {
      const state = useGameStore.getState();
      state.toggleChecks(["mimic-cave"]);
      state.handleSmallKeyClick(3);
      state.handleMedallionChange(9, 2);

      useGameStore.getState().undo();
      expect(useGameStore.getState().medallions[9]).toBe(0);
      useGameStore.getState().undo();
      expect(useGameStore.getState().smallKeys[3]).toBe(0);
      useGameStore.getState().undo();
      expect(useGameStore.getState().checked).toEqual({});
    });

    it("can take back a new game, a preset switch and an import", () => {
      useGameStore.getState().handleItemClick("flute");

      useGameStore.getState().reset();
      useGameStore.getState().undo();
      expect(useGameStore.getState().items.flute).toBe(true);

      useGameStore.getState().applyPreset("keysanity");
      useGameStore.getState().undo();
      expect(useGameStore.getState().presetId).toBe("open");
      expect(useGameStore.getState().items.flute).toBe(true);

      importSave(JSON.stringify({ items: { hammer: true } }));
      useGameStore.getState().undo();
      expect(useGameStore.getState().items.hammer).toBe(false);
      expect(useGameStore.getState().items.flute).toBe(true);
    });

    it("forgets the undone branch once a new change is made", () => {
      useGameStore.getState().handleItemClick("bow");
      useGameStore.getState().undo();

      useGameStore.getState().handleItemClick("hammer");

      expect(useGameStore.getState().future).toEqual([]);
      useGameStore.getState().redo();
      expect(useGameStore.getState().items.bow).toBe(0);
    });

    it("leaves display preferences out of the history", () => {
      const state = useGameStore.getState();
      state.setMapLayout("stacked");
      state.setBigKeysVisible(true);

      expect(useGameStore.getState().past).toEqual([]);
    });

    it("does nothing with an empty history", () => {
      const before = useGameStore.getState();

      before.undo();
      before.redo();

      expect(useGameStore.getState()).toBe(before);
    });

    it("keeps the last 200 steps", () => {
      for (let click = 0; click < 210; click++) {
        useGameStore.getState().handleItemClick("hookshot");
      }

      expect(useGameStore.getState().past).toHaveLength(200);
    });

    it("never saves the history", () => {
      useGameStore.getState().handleItemClick("flute");

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(stored.state).not.toHaveProperty("past");
      expect(stored.state).not.toHaveProperty("future");
    });
  });

  describe("what the game says", () => {
    /** Gives the hookshot to a run that lacks it. */
    const hookshot = (progress: Progress) =>
      progress.items.hookshot
        ? null
        : { items: { ...progress.items, hookshot: true } };

    it("is laid on the run and every step of its history, as no step", () => {
      const { handleItemClick } = useGameStore.getState();
      handleItemClick("bow");
      handleItemClick("hammer");
      useGameStore.getState().undo();

      useGameStore.getState().applyGameNews(hookshot);

      const state = useGameStore.getState();
      expect(state.items.hookshot).toBe(true);
      expect(state.past).toHaveLength(1);
      expect(state.past[0].items.hookshot).toBe(true);
      expect(state.future[0].items).toMatchObject({
        hammer: true,
        hookshot: true,
      });
      // Undoing the player's bow keeps the game's hookshot
      state.undo();
      expect(useGameStore.getState().items).toMatchObject({
        bow: 0,
        hookshot: true,
      });
    });

    it("sets nothing, and saves nothing, when it changes nothing", () => {
      useGameStore.getState().applyGameNews(hookshot);
      const before = useGameStore.getState();
      let sets = 0;
      const unsubscribe = useGameStore.subscribe(() => sets++);
      localStorage.clear();

      useGameStore.getState().applyGameNews(hookshot);
      unsubscribe();

      expect(sets).toBe(0);
      expect(useGameStore.getState()).toBe(before);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("syncs the run to the game as one undo step", () => {
      useGameStore.getState().handleItemClick("sword");
      const items = useGameStore.getState().items;

      useGameStore.getState().syncWithGame({ items: { ...items, sword: 0 } });

      expect(useGameStore.getState().items.sword).toBe(0);
      useGameStore.getState().undo();
      expect(useGameStore.getState().items.sword).toBe(1);
      expect(useGameStore.getState().past).toHaveLength(1);
    });
  });

  describe("the run timer", () => {
    const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
    const store = () => useGameStore.getState();

    it("starts, pauses and finishes outside the run's history", () => {
      store().handleItemClick("flute");
      store().startTimer(T0);
      store().pauseTimer(T0 + 5000);
      expect(store().timer).toEqual({
        elapsedMs: 5000,
        finished: false,
        startedAt: null,
      });
      expect(store().past).toHaveLength(1);

      // Undoing the flute leaves the timer as it is
      store().undo();
      expect(store().items.flute).toBe(false);
      expect(store().timer.elapsedMs).toBe(5000);

      store().startTimer(T0 + 6000);
      store().finishTimer(T0 + 9000);
      expect(store().timer).toEqual({
        elapsedMs: 8000,
        finished: true,
        startedAt: null,
      });
    });

    it("starts over with a new game, an import or a run type the player picks", () => {
      const counted = () => {
        store().startTimer(T0);
        store().pauseTimer(T0 + 1000);
      };
      counted();
      store().reset();
      expect(store().timer.elapsedMs).toBe(0);

      counted();
      store().loadProgress({});
      expect(store().timer.elapsedMs).toBe(0);

      counted();
      store().applyPreset("standard");
      expect(store().timer.elapsedMs).toBe(0);
    });

    it.each([
      ["untimed", { elapsedMs: 0, finished: true, startedAt: null }],
      ["timed", { elapsedMs: 477_000, finished: true, startedAt: null }],
    ])(
      "clears a run that ended %s on every way to replace the run",
      (_, ended) => {
        const finished = () => useGameStore.setState({ timer: ended });
        const replace: (() => void)[] = [
          () => store().reset(),
          () => store().loadProgress({}),
          () => store().applyPreset("standard"),
          () => store().applyRun("keysanity", getPreset("keysanity").settings),
          () =>
            store().applyRun(
              "keysanity",
              getPreset("keysanity").settings,
              () => ({ seed: "AbCdEfGhIj" }),
            ),
        ];
        for (const run of replace) {
          finished();
          run();
          expect(store().timer).toEqual({
            elapsedMs: 0,
            finished: false,
            startedAt: null,
          });
        }
      },
    );

    it("goes on through autotracking's switch to the seed's run type", () => {
      store().startTimer(T0);
      const running = store().timer;
      store().applyRun(
        "keysanity",
        getPreset("keysanity").settings,
        undefined,
        true,
      );
      expect(store().timer).toBe(running);
    });

    it("keeps the clock choice with the preferences, real time by default", async () => {
      expect(store().timerClock).toBe("real");
      store().setTimerClock("game");
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(stored.state.timerClock).toBe("game");

      // It survives a new run; a save states it, or leaves the current one
      store().reset();
      expect(store().timerClock).toBe("game");
      storeSave({ timerClock: "real" }, PERSIST_VERSION);
      await useGameStore.persist.rehydrate();
      expect(store().timerClock).toBe("real");
      storeSave({ timerClock: "game" }, PERSIST_VERSION);
      await useGameStore.persist.rehydrate();
      expect(store().timerClock).toBe("game");
      // An older save has none, a damaged one is no choice
      storeSave({}, PERSIST_VERSION);
      await useGameStore.persist.rehydrate();
      expect(store().timerClock).toBe("game");
      storeSave({ timerClock: "ingame" }, PERSIST_VERSION);
      await useGameStore.persist.rehydrate();
      expect(store().timerClock).toBe("game");
    });

    it("sets the timer on the game's clock outside the undo history", () => {
      store().alignTimer({ ms: 5000, status: "running" }, T0);
      const timer = store().timer;
      expect(timer).toEqual({
        elapsedMs: 5000,
        finished: false,
        startedAt: T0,
      });
      expect(store().past).toEqual([]);
      // Already there: the same object, so nothing redraws
      store().alignTimer({ ms: 5100, status: "running" }, T0 + 100);
      expect(store().timer).toBe(timer);
    });

    it("is saved with the run, and the auto setting with the preferences", async () => {
      store().startTimer(T0);
      store().setAutoTimer(false);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(stored.state.timer).toEqual({
        elapsedMs: 0,
        finished: false,
        startedAt: T0,
      });
      expect(stored.state.autoTimer).toBe(false);

      storeSave(
        {
          autoTimer: false,
          timer: { elapsedMs: 7000, finished: true, startedAt: null },
        },
        PERSIST_VERSION,
      );
      await useGameStore.persist.rehydrate();
      expect(store().timer).toEqual({
        elapsedMs: 7000,
        finished: true,
        startedAt: null,
      });
      expect(store().autoTimer).toBe(false);

      // A damaged one reads as no timer
      storeSave({ timer: { elapsedMs: "1:00" } }, PERSIST_VERSION);
      await useGameStore.persist.rehydrate();
      expect(store().timer).toEqual({
        elapsedMs: 0,
        finished: false,
        startedAt: null,
      });
    });

    it("stays out of save files", () => {
      store().startTimer(T0);
      expect(JSON.parse(store().exportState()).progress).not.toHaveProperty(
        "timer",
      );
    });
  });

  describe("the entrances noted", () => {
    const store = () => useGameStore.getState();

    it("notes where an entrance leads, as one undo step", () => {
      store().noteEntrance("kakariko-shop", "elder-house-exit-east");
      expect(store().entrances).toEqual({
        "kakariko-shop": "elder-house-exit-east",
      });
      expect(store().past).toHaveLength(1);
      expect(isFreshRun(store())).toBe(false);

      // The same again records nothing
      store().noteEntrance("kakariko-shop", "elder-house-exit-east");
      expect(store().past).toHaveLength(1);

      store().undo();
      expect(store().entrances).toEqual({});
    });

    it("moves a target noted at another entrance, and forgets one", () => {
      store().noteEntrance("kakariko-shop", "elder-house-exit-east");
      store().noteEntrance("blinds-hideout", "elder-house-exit-east");
      expect(store().entrances).toEqual({
        "blinds-hideout": "elder-house-exit-east",
      });
      store().noteEntrance("blinds-hideout", null);
      expect(store().entrances).toEqual({});
    });

    it("starts each run with none, and saves them with the run", () => {
      store().noteEntrance("kakariko-shop", "elder-house-exit-east");
      const file = JSON.parse(store().exportState());
      expect(file.progress.entrances).toEqual({
        "kakariko-shop": "elder-house-exit-east",
      });
      store().reset();
      expect(store().entrances).toEqual({});
      importSave(JSON.stringify(file));
      expect(store().entrances).toEqual({
        "kakariko-shop": "elder-house-exit-east",
      });
    });
  });

  describe("the doors noted", () => {
    const store = () => useGameStore.getState();
    const DR = getPreset("door-randomizer").settings;

    it("notes a door shuffle as one undo step, and saves it with the run", () => {
      store().applyRun("door-randomizer", { ...DR, doorShuffle: "basic" });
      const past = store().past.length;
      store().noteDoors({
        keys: { "Eastern Palace": 2 },
        kinds: { "eastern-cannonball-n": "small" },
        links: {
          "eastern-cannonball-n": "eastern-courtyard-ledge-s",
          "eastern-courtyard-ledge-s": "eastern-cannonball-n",
        },
        lobbies: { eastern: "eastern-lobby-s" },
      });
      expect(store().past).toHaveLength(past + 1);
      expect(isFreshRun(store())).toBe(false);
      // The same again records nothing
      store().noteDoors({ kinds: { "eastern-cannonball-n": "small" } });
      expect(store().past).toHaveLength(past + 1);
      const file = JSON.parse(store().exportState());
      expect(file.progress.doors.links["eastern-cannonball-n"]).toBe(
        "eastern-courtyard-ledge-s",
      );
      store().noteDoors({ keys: { "Eastern Palace": null } });
      expect(store().doors.keys).toBeUndefined();
      store().undo();
      store().undo();
      expect(store().doors).toEqual({});
      store().reset();
      expect(store().doors).toEqual({});
      importSave(JSON.stringify(file));
      expect(store().doors.lobbies).toEqual({ eastern: "eastern-lobby-s" });
    });
  });

  describe("an OWR run's overworld notes", () => {
    const store = () => useGameStore.getState();

    it("are one undo step each, saved with the run, none in a new one", () => {
      store().applyRun("door-randomizer", {
        ...getPreset("door-randomizer").settings,
        owWhirlpool: true,
        randomizer: "owr",
      });
      const past = store().past.length;
      store().noteOverworld({
        whirlpools: { "C Whirlpool": "Zora Whirlpool" },
      });
      expect(store().past).toHaveLength(past + 1);
      expect(isFreshRun(store())).toBe(false);
      // The same again records nothing
      store().noteOverworld({
        whirlpools: { "Zora Whirlpool": "C Whirlpool" },
      });
      expect(store().past).toHaveLength(past + 1);
      const file = JSON.parse(store().exportState());
      expect(file.progress.overworld.whirlpools["Zora Whirlpool"]).toBe(
        "C Whirlpool",
      );
      store().undo();
      expect(store().overworld).toEqual({});
      store().reset();
      expect(store().overworld).toEqual({});
      importSave(JSON.stringify(file));
      expect(store().overworld.whirlpools?.["C Whirlpool"]).toBe(
        "Zora Whirlpool",
      );
    });
  });

  describe("a Mystery run's settings", () => {
    const store = () => useGameStore.getState();

    it("start hidden, and a setting set is no longer, as one undo step", () => {
      store().applyPreset("mystery");
      expect(store().settings.hidden).toContain("crystalsTower");
      const steps = store().past.length;

      store().updateSettings({ crystalsTower: 5 });
      expect(store().settings.crystalsTower).toBe(5);
      expect(store().settings.hidden).not.toContain("crystalsTower");
      expect(store().past).toHaveLength(steps + 1);
      // Setting it to the value that stood in still reveals it
      store().updateSettings({ goal: "ganon" });
      expect(store().settings.hidden).not.toContain("goal");

      store().undo();
      store().undo();
      expect(store().settings.hidden).toContain("crystalsTower");
    });

    it("hide a setting again, and forget the list once all are known", () => {
      store().updateSettings({ swordless: true });
      expect(store().settings).not.toHaveProperty("hidden");
      store().hideSetting("swordless");
      expect(store().settings.hidden).toEqual(["swordless"]);
      store().hideSetting("swordless");
      expect(store().settings.hidden).toEqual(["swordless"]);
      store().updateSettings({ swordless: false });
      expect(store().settings).not.toHaveProperty("hidden");
    });

    it("keep each counter's items found when the dungeon items change", () => {
      // Eastern Palace's 3 items, 2 found
      store().handleItemClick("chest0");
      store().handleItemClick("chest0");
      expect(store().items.chest0).toBe(1);

      store().updateSettings({ dungeonItems: "full" });
      // Its 6 locations in Full Shuffle, the same 2 found
      expect(store().items.chest0).toBe(4);
      // Its maps and compasses now leave their dungeons: the key cells show
      expect(store().bigKeysVisible).toBe(true);
      store().updateSettings({ dungeonItems: "standard" });
      expect(store().items.chest0).toBe(1);
    });

    it("take what the game reveals as no step, the history too", () => {
      store().applyPreset("mystery");
      store().handleItemClick("hookshot");
      const steps = store().past.length;

      store().revealSettings({ crystalsTower: 3, dungeonItems: "mc" });
      expect(store().past).toHaveLength(steps);
      expect(store().settings).toMatchObject({
        crystalsTower: 3,
        dungeonItems: "mc",
      });
      // Undoing the hookshot keeps what the game revealed
      store().undo();
      expect(store().items.hookshot).toBe(false);
      expect(store().settings.crystalsTower).toBe(3);
      expect(store().settings.hidden).not.toContain("crystalsTower");
    });

    it("are saved and read back, and a damaged list is refused", () => {
      store().applyPreset("mystery");
      importSave(store().exportState());
      expect(store().settings.hidden).toContain("goal");

      const file = JSON.parse(store().exportState());
      file.progress.settings.hidden = ["mode"];
      expect(parseSave(JSON.stringify(file))).toMatchObject({ ok: false });
      file.progress.settings.hidden = ["goal", "goal"];
      expect(parseSave(JSON.stringify(file))).toMatchObject({ ok: false });
    });

    it("read an Ambrosia run, the placeholder it replaced, as Mystery", () => {
      const file = JSON.parse(store().exportState());
      file.progress.presetId = "ambrosia";
      const save = parseSave(JSON.stringify(file));
      expect(save.ok && save.progress.presetId).toBe("mystery");
    });
  });

  describe("setItem and setSmallKeys", () => {
    const store = () => useGameStore.getState();

    it("set a value as one undo step, and nothing when it is already so", () => {
      store().setItem("sword", 3);
      expect(store().items.sword).toBe(3);
      expect(store().past).toHaveLength(1);
      store().setItem("sword", 3);
      expect(store().past).toHaveLength(1);

      store().setSmallKeys(1, 1);
      expect(store().smallKeys[1]).toBe(1);
      expect(store().past).toHaveLength(2);
    });

    it("refuse a value the control cannot hold", () => {
      store().setItem("sword", 5);
      store().setItem("hookshot", 1);
      store().setItem("nothing", true);
      // Eastern Palace has no small key
      store().setSmallKeys(0, 1);
      store().setSmallKeys(1, -1);
      expect(store().past).toHaveLength(0);
    });
  });

  describe("the timeline", () => {
    const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);
    const store = () => useGameStore.getState();
    const at = (ms: number) => vi.setSystemTime(T0 + ms);

    beforeEach(() => {
      vi.useFakeTimers({ now: T0 });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("stamps the player's finds with the timer's time, none before it starts", () => {
      store().handleItemClick("hammer");
      expect(store().timeline).toEqual({
        "item:hammer": { at: T0, ms: null },
      });

      store().startTimer(T0);
      at(30_000);
      store().toggleChecks(["kings-tomb"]);
      store().handleItemClick("sword");
      expect(store().timeline).toEqual({
        "check:kings-tomb": { at: T0 + 30_000, ms: 30_000 },
        "item:hammer": { at: T0, ms: null },
        "item:sword:1": { at: T0 + 30_000, ms: 30_000 },
      });
    });

    it("loses a find's time with an undo, and finds the very same with a redo", () => {
      store().startTimer(T0);
      at(10_000);
      store().handleItemClick("hookshot");
      const found = store().timeline["item:hookshot"];

      at(20_000);
      store().undo();
      expect(store().timeline).toEqual({});
      at(30_000);
      store().redo();
      expect(store().timeline["item:hookshot"]).toBe(found);
    });

    it("stamps the game's finds now, on the run and every step of its history", () => {
      const hookshot = (progress: Progress) =>
        progress.items.hookshot
          ? null
          : { items: { ...progress.items, hookshot: true } };
      store().handleItemClick("bow");
      store().handleItemClick("hammer");
      const hammer = store().timeline["item:hammer"];
      store().undo();

      store().startTimer(T0);
      at(45_000);
      store().applyGameNews(hookshot);

      const stamp = { at: T0 + 45_000, ms: 45_000 };
      expect(store().timeline["item:hookshot"]).toEqual(stamp);
      expect(store().past[0].timeline).toEqual({ "item:hookshot": stamp });
      expect(store().future[0].timeline).toEqual({
        "item:bow:1": { at: T0, ms: null },
        "item:hammer": hammer,
        "item:hookshot": stamp,
      });
    });

    it("starts empty with a new game or a run type, and keeps an import's", () => {
      store().handleItemClick("hammer");
      store().reset();
      expect(store().timeline).toEqual({});

      store().handleItemClick("hammer");
      store().applyPreset("standard");
      expect(store().timeline).toEqual({});

      const timeline = { "item:hammer": { at: T0 - 5000, ms: 1000 } };
      store().loadProgress({
        items: { ...store().items, hammer: true },
        timeline,
      });
      expect(store().timeline).toEqual(timeline);
      // An older save, which kept none, dates nothing it held
      store().loadProgress({ items: { ...store().items, flute: true } });
      expect(store().timeline).toEqual({});
    });

    it("is saved and exported with the run, and read back", async () => {
      store().startTimer(T0);
      at(2000);
      store().handleItemClick("hammer");
      const stamp = { at: T0 + 2000, ms: 2000 };
      expect(JSON.parse(store().exportState()).progress.timeline).toEqual({
        "item:hammer": stamp,
      });

      importSave(store().exportState());
      expect(store().timeline).toEqual({ "item:hammer": stamp });

      // localStorage keeps the valid entries of a damaged one
      storeSave(
        {
          timeline: {
            "check:kings-tomb": { at: T0, ms: 0 },
            "item:hammer": { at: "noon" },
          },
        },
        PERSIST_VERSION,
      );
      await useGameStore.persist.rehydrate();
      expect(store().timeline).toEqual({
        "check:kings-tomb": { at: T0, ms: 0 },
      });
    });

    it("keeps an earlier release's stamps through a reload, and the cells added since date nothing", async () => {
      // A run as a release before the hearts cell saved it: no `hearts`,
      // `tenbombs`, `escape`, `fluteactive` or `held*` among its items
      const added = ["hearts", "tenbombs", "escape", "fluteactive"];
      const earlier = Object.fromEntries(
        Object.entries(store().items).filter(
          ([id]) => !added.includes(id) && !id.startsWith("held"),
        ),
      );
      const { hearts } = store().items;
      expect(Object.keys(store().items)).toEqual(
        expect.arrayContaining([...added, "heldcrystals"]),
      );
      const timeline = {
        "check:eastern-palace/boss": { at: T0 + 1000, ms: 900 },
        "check:links-house": { at: T0, ms: 0 },
        "item:boss0:2": { at: T0 + 1000, ms: 900 },
        "item:bow:2": { at: T0 + 2000, ms: 1900 },
        "item:hookshot": { at: T0 + 3000, ms: null },
        "item:sword:1": { at: T0 + 4000, ms: 3900 },
        "item:sword:2": { at: T0 + 5000, ms: 4900 },
      };
      storeSave(
        {
          checked: { "eastern-palace/boss": true, "links-house": true },
          items: { ...earlier, boss0: 2, bow: 2, hookshot: true, sword: 2 },
          timeline,
        },
        PERSIST_VERSION,
      );

      await useGameStore.persist.rehydrate();
      expect(store().timeline).toEqual(timeline);
      expect(store().items.hearts).toBe(hearts);

      // What autotracking reads of the cells added since dates nothing, and
      // takes no stamp away
      store().startTimer(T0);
      at(60_000);
      store().applyGameNews((progress) => ({
        items: {
          ...progress.items,
          escape: 2,
          fluteactive: 3,
          hearts: 9,
          heldcrystals: 2,
          tenbombs: 2,
        },
      }));
      expect(store().timeline).toEqual(timeline);

      // A find then is stamped beside them, and the whole is saved
      store().handleItemClick("hammer");
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(saved.state.timeline).toEqual({
        ...timeline,
        "item:hammer": { at: T0 + 60_000, ms: 60_000 },
      });
      useGameStore.setState(useGameStore.getInitialState(), true);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      await useGameStore.persist.rehydrate();
      expect(Object.keys(store().timeline)).toHaveLength(8);
    });

    it("refuses a save file whose timeline holds what is not a time", () => {
      const file = JSON.parse(store().exportState());
      file.progress.timeline = { "item:hammer": { at: T0, ms: "1:00" } };
      expect(parseSave(JSON.stringify(file))).toEqual({
        ok: false,
        reason:
          'This save holds invalid data: timeline["item:hammer"] must be a time.',
      });

      file.progress.timeline = [];
      expect(parseSave(JSON.stringify(file))).toMatchObject({
        reason: "This save holds invalid data: timeline must be an object.",
      });

      // A key this version does not know is dropped, as a location is
      file.progress.timeline = {
        "check:nowhere": { at: T0, ms: null },
        "item:hammer": { at: T0, ms: null },
      };
      const save = parseSave(JSON.stringify(file));
      expect(save.ok && save.progress.timeline).toEqual({
        "item:hammer": { at: T0, ms: null },
      });
    });
  });

  describe("map layout", () => {
    it("switches to the stacked layout", () => {
      useGameStore.getState().setMapLayout("stacked");

      expect(useGameStore.getState().mapLayout).toBe("stacked");
    });
  });

  describe("keyboard shortcuts", () => {
    const keymap = { "advance:hookshot": "KeyK", "back:chest3": "Alt+KeyK" };

    it("start with the default keymap, switched on", () => {
      expect(useGameStore.getState().shortcuts).toEqual(DEFAULT_SHORTCUTS);
    });

    it("round-trip through localStorage", async () => {
      useGameStore.getState().setKeymap(keymap);
      useGameStore.getState().setShortcutsEnabled(false);
      const saved = localStorage.getItem(STORAGE_KEY) ?? "{}";
      expect(JSON.parse(saved).state.shortcuts).toEqual({
        enabled: false,
        keymap,
      });

      // A fresh page: default state, then what localStorage holds
      useGameStore.setState(useGameStore.getInitialState(), true);
      expect(useGameStore.getState().shortcuts).toEqual(DEFAULT_SHORTCUTS);
      localStorage.setItem(STORAGE_KEY, saved);
      await useGameStore.persist.rehydrate();

      expect(useGameStore.getState().shortcuts).toEqual({
        enabled: false,
        keymap,
      });
    });

    it("give a version 4 save the defaults and store it as the current version", async () => {
      storeSave({ items: { flute: true }, mapLayout: "stacked" }, 4);

      await useGameStore.persist.rehydrate();

      const state = useGameStore.getState();
      expect(state.items.flute).toBe(true);
      expect(state.mapLayout).toBe("stacked");
      expect(state.shortcuts).toEqual(DEFAULT_SHORTCUTS);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(stored.version).toBe(PERSIST_VERSION);
      expect(stored.state.shortcuts.keymap).toEqual(DEFAULT_KEYMAP);
    });

    it("restore the valid part of a damaged keymap", async () => {
      storeSave(
        {
          shortcuts: {
            enabled: "yes",
            keymap: { "advance:bow": "KeyA", "advance:nothing": "KeyB" },
          },
        },
        PERSIST_VERSION,
      );

      await useGameStore.persist.rehydrate();

      expect(useGameStore.getState().shortcuts).toEqual({
        enabled: true,
        keymap: { "advance:bow": "KeyA" },
      });
    });

    it("survive a new game, a preset switch and an import", () => {
      useGameStore.getState().setKeymap(keymap);

      useGameStore.getState().reset();
      useGameStore.getState().applyPreset("keysanity");
      importSave(JSON.stringify({ items: { hammer: true } }));

      expect(useGameStore.getState().shortcuts.keymap).toEqual(keymap);
    });

    it("stay out of the undo history and out of save files", () => {
      useGameStore.getState().setKeymap(keymap);
      useGameStore.getState().setShortcutsEnabled(false);

      expect(useGameStore.getState().past).toEqual([]);
      expect(
        JSON.parse(useGameStore.getState().exportState()).progress,
      ).not.toHaveProperty("shortcuts");
    });
  });

  describe("tricks", () => {
    const store = () => useGameStore.getState();
    const all = [
      "darkRooms",
      "fakeFlipper",
      "waterWalk",
      "superBunny",
      "bunnyRevive",
      "dungeonRevive",
    ];

    it("start off, with all six known once on", () => {
      expect(store().tricks).toEqual({ enabled: false, techniques: all });
    });

    it("round-trip through localStorage, leniently restored", async () => {
      store().setTricks({
        enabled: true,
        techniques: ["waterWalk", "darkRooms"],
      });
      const saved = localStorage.getItem(STORAGE_KEY) ?? "{}";
      expect(JSON.parse(saved).state.tricks).toEqual({
        enabled: true,
        techniques: ["waterWalk", "darkRooms"],
      });

      useGameStore.setState(useGameStore.getInitialState(), true);
      localStorage.setItem(STORAGE_KEY, saved);
      await useGameStore.persist.rehydrate();
      // Kept in the pack's order
      expect(store().tricks).toEqual({
        enabled: true,
        techniques: ["darkRooms", "waterWalk"],
      });

      // A save without it, or a damaged one, changes nothing
      storeSave({}, PERSIST_VERSION);
      await useGameStore.persist.rehydrate();
      expect(store().tricks.enabled).toBe(true);
      storeSave(
        {
          tricks: {
            enabled: "yes",
            techniques: ["superBunny", "superBunny", "x"],
          },
        },
        PERSIST_VERSION,
      );
      await useGameStore.persist.rehydrate();
      expect(store().tricks).toEqual({
        enabled: true,
        techniques: ["superBunny"],
      });
    });

    it("are a preference: no undo step, no export, a new game keeps them", () => {
      store().handleItemClick("boots");
      const past = store().past.length;
      store().setTricks({ enabled: true, techniques: all as never });
      expect(store().past).toHaveLength(past);
      expect(JSON.parse(store().exportState()).progress).not.toHaveProperty(
        "tricks",
      );
      store().undo();
      expect(store().tricks.enabled).toBe(true);
      store().reset();
      expect(store().tricks.enabled).toBe(true);
    });
  });
});
