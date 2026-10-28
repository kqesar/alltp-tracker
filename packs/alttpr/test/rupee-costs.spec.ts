import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OFFER_KEYS, offersIn } from "../scripts/import-rupee-texts.mjs";
import { MAP_LOCATIONS } from "../src/markers";
import { RUPEE_COSTS, rupeeCostOf } from "../src/rupee-costs";
import { loadManifest } from "./manifest";

interface Texts {
  readonly texts: Readonly<Record<string, { line: number; text: string }>>;
  readonly upstream: { commit: string; repo: string };
}

const fixture = JSON.parse(
  readFileSync(new URL("./upstream/rupee-texts.json", import.meta.url), "utf8"),
) as Texts;

/** The dialogue key that states each paid check's price. */
const OFFER_OF: Readonly<Record<string, string>> = {
  blacksmith: "blacksmiths_paywall",
  "bomb-merchant": "bomb_shop_big_bomb",
  "bottle-merchant": "bottle_vendor_choice",
  "chest-game": "game_chest_village_of_outcasts",
  "digging-game": "game_digging_choice",
  "king-zora": "zora_tells_cost",
};

describe("RUPEE_COSTS", () => {
  it("is exactly the six paid checks, each a check of the map", () => {
    expect(Object.keys(RUPEE_COSTS).sort()).toEqual(Object.keys(OFFER_OF));
    for (const id of Object.keys(RUPEE_COSTS)) {
      expect(MAP_LOCATIONS.has(id), id).toBe(true);
    }
  });

  it("holds each price to the dialogue that states it", () => {
    for (const [id, offer] of Object.entries(OFFER_OF)) {
      const { rupees, source } = RUPEE_COSTS[id] ?? { rupees: 0, source: "" };
      const text = fixture.texts[offer];
      expect(text, offer).toBeDefined();
      expect(source, id).toBe(`app/Text.php:${text?.line}`);
      expect(text?.text.toLowerCase(), id).toContain(`${rupees} rupees`);
    }
    // No dialogue is cited twice, nor left unused
    expect(Object.keys(fixture.texts).sort()).toEqual(
      Object.values(OFFER_OF).sort(),
    );
  });

  it("is read from the commit upstream.json pins", () => {
    const manifest = loadManifest();
    expect(fixture.upstream).toMatchObject({
      commit: manifest.commit,
      repo: manifest.repo,
    });
  });

  it("answers a price for a paid check and none for a free one", () => {
    expect(rupeeCostOf("bottle-merchant")).toBe(100);
    expect(rupeeCostOf("king-zora")).toBe(500);
    expect(rupeeCostOf("hobo")).toBeUndefined();
    expect(rupeeCostOf("kakariko-well/top")).toBeUndefined();
  });
});

describe("the importer", () => {
  const line = (key: string, text: string) =>
    `            '${key}' => $converter->convertDialogCompressed("${text}"),`;

  it("reads each offer's line and text, in key order", () => {
    const source = [
      "<?php",
      line("other_text", "No price"),
      ...OFFER_KEYS.map((key) => line(key, `${key}\\n 5 rupees`)),
    ].join("\n");
    const offers = offersIn(source);
    expect(Object.keys(offers)).toEqual([...OFFER_KEYS].sort());
    expect(offers.zora_tells_cost).toEqual({
      line: 3 + OFFER_KEYS.indexOf("zora_tells_cost"),
      text: "zora_tells_cost\n 5 rupees",
    });
  });

  it("stops at an offer the file no longer has", () => {
    expect(() => offersIn(line("zora_tells_cost", "500 rupees"))).toThrow(
      /no line for blacksmiths_paywall/,
    );
  });
});
