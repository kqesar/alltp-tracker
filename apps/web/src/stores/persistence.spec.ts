import { describe, expect, it } from "vitest";
import { DEFAULT_SHORTCUTS } from "@/data/keymap";
import { getPreset } from "@/data/presets";
import {
  migrate,
  PERSIST_VERSION,
  parseSave,
  SAVE_FORMAT,
  toSaveFile,
  validateProgress,
} from "@/stores/persistence";

/** The reason a save was refused; fails the test if it was accepted. */
const refusal = (json: string) => {
  const save = parseSave(json);
  if (save.ok) throw new Error("expected the save to be refused");
  return save.reason;
};

/** A save file in the current format around the given progress fields. */
const saveFile = (progress: object, version = PERSIST_VERSION) =>
  JSON.stringify({ format: SAVE_FORMAT, progress, version });

/** What version 9 adds to every earlier run's settings. */
const LOGIC_DEFAULTS = {
  accessibility: "items",
  itemFunctionality: "normal",
  itemPlacement: "advanced",
  itemPool: "normal",
};

describe("parseSave", () => {
  it("reads a file written by the current version", () => {
    const save = parseSave(
      saveFile({ items: { bow: 2, hookshot: true }, presetId: "keysanity" }),
    );

    expect(save).toEqual({
      ok: true,
      progress: { items: { bow: 2, hookshot: true }, presetId: "keysanity" },
    });
  });

  it("round-trips what toSaveFile writes", () => {
    const progress = {
      checked: { "kakariko-tavern": true, "mire-shed/left": true },
      items: { boss2: 2, glove: 2 },
      medallions: [0, 0, 0, 0, 0, 0, 0, 0, 1, 3],
      presetId: "open",
      settings: {
        accessibility: "locations",
        crystalsGanon: 6,
        crystalsTower: 5,
        dungeonItems: "mcs",
        entranceShuffle: "none",
        goal: "ganon",
        itemFunctionality: "hard",
        itemPlacement: "basic",
        itemPool: "expert",
        mode: "open",
        swordless: true,
      },
      smallKeys: [0, 1, 0, 6, 0, 0, 0, 0, 0, 0],
    } as const;

    const save = parseSave(JSON.stringify(toSaveFile(progress as never)));

    expect(save).toEqual({ ok: true, progress });
  });

  it("refuses text that is not JSON", () => {
    expect(refusal("not valid json")).toMatch(/not valid JSON/);
  });

  it.each([
    ["null", "null"],
    ["an array", "[]"],
    ["an empty object", "{}"],
    ["an unrelated object", '{"name":"package.json"}'],
  ])("refuses %s as not a tracker save", (_, json) => {
    expect(refusal(json)).toMatch(/not a tracker save/);
  });

  it("refuses a file from a newer version", () => {
    expect(refusal(saveFile({}, PERSIST_VERSION + 1))).toMatch(/newer version/);
  });

  it("names its game, and refuses a file of another game", () => {
    const file = JSON.parse(saveFile({ items: { bow: 2 } }));
    expect(toSaveFile({} as never).game).toBe("alttpr");

    expect(
      parseSave(JSON.stringify({ ...file, game: "alttpr" })),
    ).toMatchObject({ ok: true });
    expect(refusal(JSON.stringify({ ...file, game: "smz3" }))).toMatch(
      /game this tracker does not track/,
    );
  });

  it("checks a dungeon counter against the run's settings", () => {
    const keysanity = { ...getPreset("keysanity").settings };

    expect(
      parseSave(saveFile({ items: { chest3: 14 }, settings: keysanity })),
    ).toMatchObject({ ok: true });
    expect(refusal(saveFile({ items: { chest3: 14 } }))).toMatch(
      /items\.chest3 must be a whole number from 0 to 5/,
    );
  });

  it("names the field that holds a value the tracker cannot show", () => {
    expect(refusal(saveFile({ items: { flute: 1 } }))).toMatch(
      /items\.flute must be true or false/,
    );
    expect(refusal(saveFile({ items: { bow: 9 } }))).toMatch(
      /items\.bow must be a whole number from 0 to 3/,
    );
    expect(refusal(saveFile({ medallions: "x" }))).toMatch(/medallions/);
    expect(refusal(saveFile({ presetId: "nope" }))).toMatch(/presetId "nope"/);
  });

  it("ignores items this version no longer tracks", () => {
    const save = parseSave(saveFile({ items: { dungeon: 3, hookshot: true } }));

    expect(save).toEqual({ ok: true, progress: { items: { hookshot: true } } });
  });

  it("migrates a bare version 1 export", () => {
    const save = parseSave(
      JSON.stringify({ dungeonsBeaten: [true], items: { hookshot: true } }),
    );

    expect(save).toEqual({
      ok: true,
      progress: { items: { boss0: 2, hookshot: true } },
    });
  });
});

describe("validateProgress", () => {
  it("keeps the valid fields and reports each invalid one", () => {
    const { value, errors } = validateProgress({
      checked: { "kings-tomb": "yes", "links-house": true },
      items: { hookshot: true },
      smallKeys: Array(10).fill(9),
    });

    expect(value).toEqual({
      checked: { "links-house": true },
      items: { hookshot: true },
    });
    expect(errors).toEqual([
      'checked["kings-tomb"] must be true',
      "smallKeys must hold 10 counts within each dungeon's keys",
    ]);
  });

  it("drops the checked locations it does not know, as it does items", () => {
    expect(
      validateProgress({ checked: { "kings-tomb": true, nowhere: true } }),
    ).toEqual({ errors: [], value: { checked: { "kings-tomb": true } } });
    expect(validateProgress({ checked: [] }).errors).toEqual([
      "checked must be an object",
    ]);
  });
});

describe("migrate", () => {
  it("moves a version 3 side-by-side layout, the old default, to auto", () => {
    expect(migrate({ mapLayout: "side-by-side" }, 3)).toEqual({
      mapLayout: "auto",
      shortcuts: DEFAULT_SHORTCUTS,
    });
  });

  it("keeps a stacked layout, which was always a choice", () => {
    expect(migrate({ mapLayout: "stacked" }, 3)).toEqual({
      mapLayout: "stacked",
      shortcuts: DEFAULT_SHORTCUTS,
    });
  });

  it("gives a version 4 save, which had no shortcuts, the default ones", () => {
    expect(migrate({ mapLayout: "stacked" }, 4)).toEqual({
      mapLayout: "stacked",
      shortcuts: DEFAULT_SHORTCUTS,
    });
  });

  it("keeps the shortcuts a version 4 save somehow already holds", () => {
    const shortcuts = { enabled: false, keymap: {} };

    expect(migrate({ shortcuts }, 4)).toEqual({ shortcuts });
  });

  it("checks every location an opened version 5 marker stood for", () => {
    const chestsOpened = Array(64).fill(false);
    chestsOpened[11] = true; // DW Death Mountain (2): Superbunny Cave
    chestsOpened[30] = "yes"; // not a flag: Ether Tablet stays unchecked
    chestsOpened[63] = true; // Bridge, where v31 has no check

    expect(migrate({ chestsOpened }, 5)).toEqual({
      checked: {
        "superbunny-cave/bottom": true,
        "superbunny-cave/top": true,
      },
    });
  });

  it("carries a keysanity counter's items found, not its items left", () => {
    const run = (keysanity: boolean) => ({
      entranceShuffle: "none",
      goal: "ganon",
      keysanity,
      mode: "standard",
    });
    const items = { chest0: 1, chest3: 5, chest9: -1, hookshot: true };
    // What versions 8 and 9 add to every earlier run's settings
    const v8 = {
      accessibility: "items",
      crystalsGanon: 7,
      crystalsTower: 7,
      itemFunctionality: "normal",
      itemPlacement: "advanced",
      itemPool: "normal",
      swordless: false,
    };

    // Version 10 then names the dungeon items
    const named = (keysanity: boolean) => {
      const { keysanity: _, ...rest } = run(keysanity);
      return { ...rest, dungeonItems: keysanity ? "full" : "standard" };
    };

    expect(migrate({ items, settings: run(true) }, 5)).toEqual({
      // 2 of 3 found in Eastern Palace, none in Palace of Darkness; a value
      // out of the legacy range is left for validation to refuse
      items: { chest0: 4, chest3: 14, chest9: -1, hookshot: true },
      settings: { ...named(true), ...v8 },
    });
    expect(migrate({ items, settings: run(false) }, 5)).toEqual({
      items,
      settings: { ...named(false), ...v8 },
    });
  });

  it("takes back the small key a version 6 save gave Eastern Palace", () => {
    const smallKeys = [1, 1, 0, 6, 0, 0, 0, 0, 0, 4];

    const migrated = migrate({ smallKeys }, 6);

    expect(migrated).toEqual({ smallKeys: [0, 1, 0, 6, 0, 0, 0, 0, 0, 4] });
    expect(validateProgress(migrated).errors).toEqual([]);
    // Unmigrated, the whole field fails, every dungeon's keys with it
    expect(validateProgress({ smallKeys }).errors).toEqual([
      "smallKeys must hold 10 counts within each dungeon's keys",
    ]);
    expect(migrate({ smallKeys: [0, 1] }, 6)).toEqual({ smallKeys: [0, 1] });
    expect(migrate({ smallKeys: "none" }, 6)).toEqual({ smallKeys: "none" });
  });

  it("gives a version 7 run swords and 7 crystals for the tower and Ganon", () => {
    const settings = {
      entranceShuffle: "none",
      goal: "fast-ganon",
      keysanity: true,
      mode: "standard",
    };

    const migrated = migrate({ presetId: "keysanity", settings }, 7);

    const { keysanity: _, ...named } = settings;
    expect(migrated).toEqual({
      presetId: "keysanity",
      settings: {
        ...named,
        ...LOGIC_DEFAULTS,
        crystalsGanon: 7,
        crystalsTower: 7,
        dungeonItems: "full",
        swordless: false,
      },
    });
    expect(validateProgress(migrated).errors).toEqual([]);
    // Unmigrated, the settings fail
    expect(validateProgress({ settings }).errors).toHaveLength(1);
    expect(migrate({ settings: "none" }, 7)).toEqual({ settings: "none" });
  });

  it("gives a version 8 run the site's item placement, pool, functionality and accessibility", () => {
    const {
      accessibility,
      dungeonItems,
      itemFunctionality,
      itemPlacement,
      itemPool,
      ...current
    } = getPreset("swordless").settings;
    const v8 = { ...current, keysanity: false };

    const migrated = migrate({ settings: v8 }, 8);

    expect(migrated).toEqual({
      settings: { ...current, ...LOGIC_DEFAULTS, dungeonItems: "standard" },
    });
    expect(validateProgress(migrated).errors).toEqual([]);
    // Unmigrated, the settings fail
    expect(validateProgress({ settings: v8 }).errors).toHaveLength(1);
  });

  it("names a version 9 run's dungeon items as alttpr.com does", () => {
    const { dungeonItems, ...v9 } = getPreset("open").settings;

    expect(migrate({ settings: { ...v9, keysanity: true } }, 9)).toEqual({
      settings: { ...v9, dungeonItems: "full" },
    });
    expect(migrate({ settings: { ...v9, keysanity: false } }, 9)).toEqual({
      settings: { ...v9, dungeonItems: "standard" },
    });
    // A keysanity that is no flag is left for validation to refuse
    const odd = migrate({ settings: { ...v9, keysanity: "yes" } }, 9);
    expect(validateProgress(odd).errors).toHaveLength(1);
  });

  it("refuses a logic setting alttpr.com has no option for", () => {
    const settings = getPreset("open").settings;

    for (const wrong of [
      { itemPlacement: "random" },
      { accessibility: "all" },
      { itemPool: "toString" },
      { itemFunctionality: 3 },
    ]) {
      expect(
        refusal(saveFile({ settings: { ...settings, ...wrong } })),
        JSON.stringify(wrong),
      ).toMatch(/item placement, accessibility, item pool and functionality/);
    }
  });

  it("refuses crystal counts beyond the seven crystals", () => {
    const settings = { ...getPreset("open").settings, crystalsGanon: 8 };

    expect(refusal(saveFile({ settings }))).toMatch(
      /crystal counts from 0 to 7/,
    );
    expect(
      parseSave(saveFile({ settings: { ...settings, crystalsGanon: 0 } })),
    ).toMatchObject({ ok: true });
  });

  it("leaves a current save alone", () => {
    expect(migrate({ mapLayout: "side-by-side" }, PERSIST_VERSION)).toEqual({
      mapLayout: "side-by-side",
    });
  });
});
