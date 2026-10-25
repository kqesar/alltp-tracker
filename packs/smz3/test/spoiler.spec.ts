import { readFileSync } from "node:fs";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { renderDownload } from "../scripts/spoiler-fixtures.mjs";
import { fromUpstream, ITEM_IDS, ITEMS } from "../src/items";
import { REGION_MODULES } from "../src/regions";
import ITEM_TYPES from "../src/spoiler/item-types.json";
import { parseSpoiler, REWARDS } from "../src/spoiler/parse";

// A seed generated on samus.link: the API's answer as received, and the
// Download file rebuilt from it with the site's own code (provenance.json).
const read = (name: string) =>
  readFileSync(new URL(`./spoilers/${name}`, import.meta.url), "utf8");
const YAML_FILE = read("hQa77ywrRDKvN4tXHGyRMw.txt");
const API_FILE = read("hQa77ywrRDKvN4tXHGyRMw.json");
const NAME =
  "Super Metroid & A Link to the Past Combo Randomizer v11.3.2 - hQa77ywrRDKvN4tXHGyRMw - Spoiler.txt";
const GUID = "8506bbef2c2b4432af378b571c6c9133";

type Api = {
  seed: {
    players: number;
    gameId: string;
    guid: string;
    spoiler: string;
    worlds: { settings: string; worldState: string }[];
  };
  locations: { locationName: string; itemName: string }[];
};
const api = (): Api => JSON.parse(API_FILE);
/** The API's answer with a change, as text. */
const edit = (change: (a: Api) => void) => {
  const a = api();
  change(a);
  return JSON.stringify(a);
};
const must = (text: string, fileName = "") => {
  const result = parseSpoiler(text, fileName);
  if (!result.ok) throw new Error(`${result.error}: ${result.detail}`);
  return result.value;
};

describe("a samus.link spoiler log", () => {
  const log = must(YAML_FILE, NAME);

  it("holds every location of the pack, once, with the pack's id", () => {
    const ids = REGION_MODULES.flatMap(({ region }) =>
      region.locations.map(({ id }) => id),
    );
    expect(ids).toHaveLength(316);
    expect(log.placements.map((p) => p.location).sort()).toEqual(
      [...ids].sort(),
    );
    expect(log.skipped).toEqual([]);
  });

  it("maps the names of the seed to the pack's items", () => {
    const at = (name: string) =>
      log.placements.find((p) => p.locationName === name);
    expect(at("Castle Tower - Foyer")).toMatchObject({
      area: "Castle Tower",
      item: "keyCT",
      itemName: "Castle Tower Key",
      location: "castle-tower/foyer",
      sphere: null,
    });
    expect(at("Secret Passage")).toMatchObject({
      item: "glove",
      itemName: "Progressive Glove",
      sphere: 1,
    });
    expect(at("Mini Moldorm Cave - Far Right")).toMatchObject({
      item: "gravity",
      sphere: 1,
    });
    expect(at("Sewers - Secret Room - Middle")).toMatchObject({
      item: "hiJump",
      sphere: 2,
    });
    expect(at("Energy Tank, Terminator")).toMatchObject({
      item: "bow",
      sphere: 2,
    });
    expect(at("Turtle Rock - Big Key Chest")).toMatchObject({
      item: "bottle",
      sphere: 7,
    });
    // An item the logic never reads has no id, its name stays
    expect(at("Kakariko Well - Middle")).toMatchObject({
      item: null,
      itemName: "Bug Catching Net",
    });
    expect(at("Energy Tank, Gauntlet")).toMatchObject({ item: "bottle" });
  });

  it("numbers the spheres without the empty ones, as the site's page does", () => {
    expect(log.spheres).toBe(7);
    const sizes = Array.from(
      { length: 7 },
      (_, i) => log.placements.filter((p) => p.sphere === i + 1).length,
    );
    expect(sizes).toEqual([10, 16, 11, 8, 6, 3, 2]);
    // The API keeps its empty spheres: the same numbers
    expect(
      JSON.parse(api().seed.spoiler).map((s: object) => Object.keys(s).length),
    ).toContain(0);
  });

  it("states the seed and what it asks", () => {
    expect(log).toMatchObject({
      format: "smz3-yaml",
      game: "smz3",
      seed: { from: "content", id: GUID },
      start: [],
    });
    expect(log.extra).toMatchObject({
      goal: "defeatboth",
      guid: GUID,
      hash: "KAGO KAGO RINKA BABUSU",
      medallions: { mire: "ether", turtleRock: "ether" },
      settings: {
        ganonCrystals: 7,
        keysanity: false,
        smLogic: "normal",
        tourianBosses: 4,
        towerCrystals: 7,
      },
      version: "11.3.2",
    });
    expect(Object.keys(log.extra.prizes)).toHaveLength(14);
    expect(log.extra.prizes).toMatchObject({
      "Dark Palace": "pendantNonGreen",
      "Eastern Palace": "crystalBlue",
      "Norfair Lower": "crystalBlue",
      "Skull Woods": "pendantGreen",
      "Turtle Rock": "tokenDraygon",
    });
    for (const reward of Object.values(log.extra.prizes)) {
      expect(ITEM_IDS).toContain(reward);
    }
  });

  it("reads the API's JSON as the same log", () => {
    const fromApi = must(API_FILE);
    expect(fromApi.format).toBe("smz3-api");
    expect({ ...fromApi, format: "smz3-yaml" }).toEqual(log);
  });

  it("reads the settings the file states", () => {
    const hard = must(
      YAML_FILE.replace("smlogic: normal", "smlogic: hard")
        .replace("keyshuffle: none", "keyshuffle: keysanity")
        .replace("towerCrystals: 7", "towerCrystals: 0")
        .replace("tourianBossTokens: 4", "tourianBossTokens: 2"),
    );
    expect(hard.extra.settings).toEqual({
      ganonCrystals: 7,
      keysanity: true,
      smLogic: "hard",
      tourianBosses: 2,
      towerCrystals: 0,
    });
  });

  it("falls back to samus.link's defaults for counts an old seed lacks", () => {
    const bare = must(
      edit((a) => {
        const [world] = a.seed.worlds;
        if (world === undefined) throw new Error("no world");
        world.worldState = JSON.stringify({
          ...JSON.parse(world.worldState),
          ganonCrystals: undefined,
          tourianBossTokens: undefined,
          towerCrystals: undefined,
        });
      }),
    );
    expect(bare.extra.settings).toMatchObject({
      ganonCrystals: 7,
      tourianBosses: 4,
      towerCrystals: 7,
    });
  });
});

describe("refusals", () => {
  const code = (text: string, fileName = "") => {
    const result = parseSpoiler(text, fileName);
    return result.ok
      ? "ok"
      : `${result.error}${result.detail ? `: ${result.detail}` : ""}`;
  };

  it("names a Super Metroid-only samus.link file and Archipelago's as unsupported", () => {
    expect(code("- SM 11.3.2 AAAA BBBB CCCC\n- Playthrough:\n")).toBe(
      "unsupported: Super Metroid alone",
    );
    expect(code(edit((a) => (a.seed.gameId = "sm")))).toBe(
      "unsupported: Super Metroid alone",
    );
    expect(code("Archipelago Version 0.6.8  -  Seed: 1\n")).toBe(
      "unsupported: Archipelago",
    );
  });

  it("refuses a multiworld, by its flag and by its names", () => {
    expect(code(edit((a) => (a.seed.players = 2)))).toBe(
      "unsupported: multiworld",
    );
    const suffixed = JSON.parse(API_FILE) as Api;
    for (const l of suffixed.locations) {
      l.locationName += " - Sam";
      l.itemName += " - Sam";
    }
    expect(code(renderDownload(suffixed))).toBe("unsupported: multiworld");
    expect(code(JSON.stringify(suffixed))).toBe("unsupported: multiworld");
  });

  it("refuses the server's own YAML layout, which no button saves", () => {
    expect(
      code(
        "Game: SMZ3 11.3.2 KAGO KAGO RINKA BABUSU\nMeta:\n  guid: 8506bbef2c2b4432af378b571c6c9133\n",
      ),
    ).toBe("unsupported: samus.link's server YAML layout");
  });

  it("tells another randomizer's file from a log it cannot read", () => {
    expect(code('{\n    "meta": {\n        "goal": "ganon"')).toBe(
      "other-game: alttpr",
    );
    expect(code('{"foo": 1}')).toBe("not-a-spoiler");
    expect(
      code('{"item_priority":["ReserveTank"],"summary":[]}', "spoiler.json"),
    ).toBe("other-game: sm");
    expect(code(YAML_FILE.slice(0, 2000), "rom.sfc")).toBe("not-a-spoiler");
    expect(code("")).toBe("not-a-spoiler");
    expect(code("\0\0\0\0")).toBe("not-a-spoiler");
  });

  it("refuses a file over its bound without reading it", () => {
    expect(code(`${YAML_FILE}${"#".repeat(1024 * 1024)}`)).toBe(
      "too-large: 1 MiB",
    );
  });

  it("refuses a file cut anywhere before its end", () => {
    for (const text of [YAML_FILE, API_FILE]) {
      const end =
        text === YAML_FILE ? text.indexOf("- Meta:") : text.length - 1;
      for (let i = 1; i <= 40; i++) {
        const cut = Math.floor((end * i) / 41);
        expect(code(text.slice(0, cut))).not.toBe("ok");
      }
    }
  });

  it("refuses an alias and a tag", () => {
    expect(code(`${YAML_FILE}\n- &a x\n- *a\n`)).toMatch(
      /^not-a-spoiler: invalid YAML/,
    );
    expect(
      code(YAML_FILE.replace("- Meta:", "- !!js/function f\n- Meta:")),
    ).toMatch(/^not-a-spoiler: invalid YAML/);
  });

  it("refuses a Meta block that cannot be", () => {
    for (const [from, to] of [
      ["towerCrystals: 7", "towerCrystals: 8"],
      ["towerCrystals: 7", "towerCrystals: seven"],
      ["tourianBossTokens: 4", "tourianBossTokens: 5"],
      ["smlogic: normal", "smlogic: expert"],
      ["keyshuffle: none", "keyshuffle: some"],
      [`guid: ${GUID}`, "guid: nope"],
      ["    goal: defeatboth\n", ""],
    ] as const) {
      expect(code(YAML_FILE.replace(from, to))).toMatch(/^not-a-spoiler/);
    }
    expect(code(YAML_FILE.replace(/- Meta:[\s\S]*/, ""))).toBe(
      "not-a-spoiler: no Meta",
    );
  });

  it("refuses a log without its medallions or with one it does not know", () => {
    expect(
      code(
        YAML_FILE.replace("    Medallion Required - Misery Mire: Ether\n", ""),
      ),
    ).toBe("not-a-spoiler: medallions");
    expect(
      code(YAML_FILE.replace("Misery Mire: Ether", "Misery Mire: Fire")),
    ).toBe("not-a-spoiler: medallion");
  });

  it("refuses a location listed twice", () => {
    expect(
      code(
        edit((a) => {
          const [first] = a.locations;
          if (first) a.locations.push({ ...first });
        }),
      ),
    ).toBe("not-a-spoiler: Castle Tower - Foyer twice");
  });

  it("refuses a log with no section it needs", () => {
    expect(
      code(
        YAML_FILE.replace(
          /- Playthrough:[\s\S]*?(?=- Prizes and Requirements:)/,
          "",
        ),
      ),
    ).toBe("not-a-spoiler: no Playthrough");
    expect(
      code(YAML_FILE.replace("- Prizes and Requirements:", "- Prizes:")),
    ).toBe("not-a-spoiler: no prizes");
    expect(code(YAML_FILE.replace(" KAGO KAGO RINKA BABUSU", ""))).toBe(
      "not-a-spoiler: title line",
    );
  });

  it("refuses an API answer of another shape", () => {
    expect(code('{"seed":{"id":1}}')).toBe(
      "not-a-spoiler: samus.link API shape",
    );
    expect(code(edit((a) => (a.seed.spoiler = "not json")))).toBe(
      "not-a-spoiler: spoiler or settings",
    );
    expect(code(`${API_FILE.slice(0, 60)}`)).toBe(
      "not-a-spoiler: invalid JSON",
    );
  });
});

describe("names the pack does not know", () => {
  /** The API's answer with `n` locations renamed (their sphere entries keep the old name). */
  const renamed = (n: number, item = false) =>
    edit((a) => {
      a.locations.slice(0, n).forEach((l, i) => {
        if (item) l.itemName = `Future Item ${i}`;
        else l.locationName = `Future Place ${i}`;
      });
    });

  it("skips a few and lists them", () => {
    const places = must(renamed(2));
    expect(places.placements).toHaveLength(314);
    expect(places.skipped).toEqual(["Future Place 0", "Future Place 1"]);
    const items = must(renamed(2, true));
    expect(items.placements).toHaveLength(316);
    expect(items.skipped).toEqual(["Future Item 0", "Future Item 1"]);
    expect(
      items.placements.filter(
        (p) => p.item === null && p.itemName.startsWith("Future"),
      ),
    ).toHaveLength(2);
  });

  it("calls many a newer version's", () => {
    // 5 unknown locations plus the 5 playthrough names that lost their place
    const six = parseSpoiler(renamed(6));
    expect(six).toMatchObject({ error: "newer-version", ok: false });
    expect(parseSpoiler(renamed(6, true))).toEqual({
      detail: "6 names unknown",
      error: "newer-version",
      ok: false,
    });
    expect(parseSpoiler(renamed(5, true)).ok).toBe(true);
  });

  it("skips a prize it does not know and keeps the rest", () => {
    const odd = must(YAML_FILE.replace("Blue Crystal", "Purple Crystal"));
    expect(odd.skipped).not.toEqual([]);
    expect(Object.keys(odd.extra.prizes).length).toBeLessThan(14);
  });

  it("keeps a location named __proto__ as data", () => {
    const text = edit((a) => {
      const [first] = a.locations;
      if (first) first.locationName = "__proto__";
    });
    const odd = must(text);
    expect(odd.skipped).toEqual(["__proto__"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("the item names", () => {
  it("reach every item the pack counts, but the rewards", () => {
    const reached = new Set(
      Object.values(ITEM_TYPES.items).flatMap(
        (type) => fromUpstream(type) ?? [],
      ),
    );
    const rewards = new Set(Object.values(REWARDS));
    const missing = ITEMS.filter(
      ({ id }) => !reached.has(id) && !rewards.has(id),
    ).map(({ id }) => id);
    expect(missing).toEqual([]);
    for (const reward of rewards) {
      expect(ITEM_IDS).toContain(reward);
      expect(reached.has(reward)).toBe(false);
    }
  });

  it("are the seed's: none of the 150 is unknown to the pack's table", () => {
    const names = new Set(api().locations.map((l) => l.itemName));
    for (const name of names) {
      expect(Object.hasOwn(ITEM_TYPES.items, name)).toBe(true);
    }
  });
});

describe("never throws", () => {
  const cases: [string, string][] = [
    ["a YAML title", "- SMZ3 11.3.2 A B C D\n"],
    ["an API head", '{"seed":{"id":1,"guid":"'],
    ["nothing", ""],
  ];
  it.each(cases)("after %s, whatever follows", (_name, head) => {
    fc.assert(
      fc.property(fc.string({ maxLength: 600 }), (tail) => {
        expect(typeof parseSpoiler(head + tail).ok).toBe("boolean");
      }),
      { numRuns: 200 },
    );
  });

  it("on any JSON value in the API's place", () => {
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 4 }), (value) => {
        const text = `{"seed":{"id":1,"x":${JSON.stringify(value)}}}`;
        expect(parseSpoiler(text).ok).toBe(false);
      }),
      { numRuns: 200 },
    );
  });
});
