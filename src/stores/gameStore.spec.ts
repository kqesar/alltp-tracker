import { beforeEach, describe, expect, it } from "vitest";
import { chests } from "@/data/chests";
import { dungeons } from "@/data/dungeons";
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
    expect(state.caption).toBe("");
    expect(state.medallions).toEqual(Array(10).fill(0));
    expect(state.smallKeys).toEqual(Array(10).fill(0));
    expect(state.chestsOpened).toEqual(chests.map(() => false));
    expect(state.items.boss0).toBe(1);
    expect(state.bigKeysVisible).toBe(false);
    expect(state.mapLayout).toBe("side-by-side");
  });

  it("updates caption", () => {
    useGameStore.getState().setCaption("Test caption");

    expect(useGameStore.getState().caption).toBe("Test caption");
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

    it("refreshes the caption of the dungeon on screen", () => {
      const { setCaption, handleMedallionChange } = useGameStore.getState();

      setCaption(dungeons[8].name);
      handleMedallionChange(8, 1);

      const { caption } = useGameStore.getState();
      expect(caption).toContain("medallion1.png");
      expect(caption).toContain("Misery Mire");
    });
  });

  it("toggles one chest and leaves the others alone", () => {
    useGameStore.getState().toggleChest(2);

    const opened = useGameStore.getState().chestsOpened;
    expect(opened[2]).toBe(true);
    expect(opened.filter(Boolean)).toHaveLength(1);

    useGameStore.getState().toggleChest(2);
    expect(useGameStore.getState().chestsOpened[2]).toBe(false);
  });

  describe("Small Keys", () => {
    it("counts each dungeon's keys up to its maximum, then back to 0", () => {
      const maxValues = [1, 1, 1, 6, 1, 3, 1, 2, 3, 4];

      maxValues.forEach((max, dungeonIndex) => {
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
      state.toggleChest(0);
      state.handleItemClick("boss0");
      state.handleItemClick("hookshot");
      state.handleSmallKeyClick(3);
      state.handleMedallionChange(8, 3);

      useGameStore.getState().reset();

      const after = useGameStore.getState();
      expect(after.chestsOpened[0]).toBe(false);
      expect(after.items.boss0).toBe(1);
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
      const { handleItemClick, toggleChest, handleMedallionChange, reset } =
        useGameStore.getState();
      handleItemClick("hookshot");
      handleItemClick("boss3");
      toggleChest(2);
      handleMedallionChange(8, 2);
      const saved = useGameStore.getState().exportState();

      reset();
      expect(useGameStore.getState().chestsOpened[2]).toBe(false);

      importSave(saved);

      const state = useGameStore.getState();
      expect(state.items.hookshot).toBe(true);
      expect(state.items.boss3).toBe(2);
      expect(state.chestsOpened[2]).toBe(true);
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
      const v1Export = JSON.stringify({
        // Version 1 tables had 65 chests
        chestsOpened: [true, ...Array(64).fill(false)],
        dungeonsBeaten: [false, true],
        items: { boss0: 2, hookshot: true },
      });

      importSave(v1Export);

      const { items, chestsOpened } = useGameStore.getState();
      expect(items.boss0).toBe(2);
      expect(items.boss1).toBe(2);
      expect(items.boss2).toBe(1);
      expect(items.hookshot).toBe(true);
      expect(chestsOpened[0]).toBe(true);
    });

    it("moves an older export's chest flags past the removed duplicate chest", () => {
      // 65 flags: the table listed West of Sanctuary at both 18 and 19
      const chestsOpened = Array(65).fill(false);
      chestsOpened[19] = true; // the duplicate West of Sanctuary
      chestsOpened[20] = true; // the chest after it
      chestsOpened[64] = true; // the last chest

      importSave(JSON.stringify({ chestsOpened }));

      const opened = useGameStore.getState().chestsOpened;
      expect(opened).toHaveLength(chests.length);
      expect(opened[18]).toBe(true);
      expect(opened[19]).toBe(true);
      expect(opened[63]).toBe(true);
      expect(opened.filter(Boolean)).toHaveLength(3);
    });
  });

  describe("persistence", () => {
    it("saves progress and preferences, but not the caption", () => {
      useGameStore.getState().setCaption("hovered");
      useGameStore.getState().handleItemClick("flute");

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(stored.version).toBe(PERSIST_VERSION);
      expect(stored.state.items.flute).toBe(true);
      expect(stored.state).toHaveProperty("mapLayout");
      expect(stored.state).not.toHaveProperty("caption");
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
      expect(state.chestsOpened[1]).toBe(true);
      expect(state.mapLayout).toBe("stacked");

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      expect(stored.version).toBe(PERSIST_VERSION);
      expect(stored.state).not.toHaveProperty("dungeonsBeaten");
    });
  });

  describe("Run-type presets", () => {
    it("switches preset, turns key cells on for keysanity and clears the board", () => {
      useGameStore.getState().toggleChest(0);

      useGameStore.getState().applyPreset("keysanity");

      const state = useGameStore.getState();
      expect(state.presetId).toBe("keysanity");
      expect(state.settings.keysanity).toBe(true);
      expect(state.bigKeysVisible).toBe(true);
      expect(state.chestsOpened[0]).toBe(false);
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

  describe("map layout", () => {
    it("switches to the stacked layout", () => {
      useGameStore.getState().setMapLayout("stacked");

      expect(useGameStore.getState().mapLayout).toBe("stacked");
    });
  });
});
