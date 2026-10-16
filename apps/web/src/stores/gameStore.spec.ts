import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_KEYMAP, DEFAULT_SHORTCUTS } from "@/data/keymap";
import v1Export from "@/stores/fixtures/v1-export.json";
import v2Export from "@/stores/fixtures/v2-export.json";
import v5KeysanityExport from "@/stores/fixtures/v5-keysanity-export.json";
import v5LocalStorage from "@/stores/fixtures/v5-local-storage.json";
import { useGameStore } from "@/stores/gameStore";
import { PERSIST_VERSION, parseSave } from "@/stores/persistence";

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

  it("starts a fresh Open run with nothing found", () => {
    const state = useGameStore.getState();

    expect(state.presetId).toBe("open");
    expect(state.medallions).toEqual(Array(10).fill(0));
    expect(state.smallKeys).toEqual(Array(10).fill(0));
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

    it("restores the valid fields of a damaged save and resets the rest", async () => {
      storeSave(
        { items: { flute: true }, medallions: "x", smallKeys: [99] },
        PERSIST_VERSION,
      );

      await useGameStore.persist.rehydrate();

      const state = useGameStore.getState();
      expect(state.items.flute).toBe(true);
      expect(state.medallions).toEqual(Array(10).fill(0));
      expect(state.smallKeys).toEqual(Array(10).fill(0));
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
      expect(state.shortcuts).toEqual({
        enabled: false,
        keymap: { "advance:hookshot": "KeyH" },
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
      expect(state.settings.keysanity).toBe(true);
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
});
