import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  downloadName,
  provenance,
  renderDownload,
  slug,
} from "../scripts/spoiler-fixtures.mjs";
import ITEM_TYPES from "../src/spoiler/item-types.json";
import UPSTREAM from "../upstream.json";

const read = (name: string) =>
  readFileSync(new URL(`./spoilers/${name}`, import.meta.url), "utf8");

// The fixtures are written by scripts/spoiler-fixtures.mjs and never edited:
// the YAML is the script's rendering of the JSON, byte for byte.
describe("the spoiler fixtures", () => {
  const api = JSON.parse(read("hQa77ywrRDKvN4tXHGyRMw.json"));

  it("hold the YAML the script renders from the JSON", () => {
    expect(read("hQa77ywrRDKvN4tXHGyRMw.txt")).toBe(renderDownload(api));
  });

  it("are named by the seed's slug, as the site names its download", () => {
    expect(slug(api.seed.guid)).toBe("hQa77ywrRDKvN4tXHGyRMw");
    expect(downloadName(api)).toBe(
      "Super Metroid & A Link to the Past Combo Randomizer v11.3.2 - hQa77ywrRDKvN4tXHGyRMw - Spoiler.txt",
    );
  });

  it("say the YAML was rebuilt, not downloaded", () => {
    const written = JSON.parse(read("provenance.json"));
    expect(written).toEqual(provenance(api, "fetched from the API"));
    expect(written.note).toContain("REBUILT");
    expect(written.guid).toBe(api.seed.guid);
  });

  it("carry no personal data: a guid, a hash and a player named Player", () => {
    expect(api.seed.worlds).toHaveLength(1);
    expect(api.seed.worlds[0].player).toBe("Player");
    expect(read("hQa77ywrRDKvN4tXHGyRMw.txt")).not.toMatch(/@|\/home\//);
    expect(read("hQa77ywrRDKvN4tXHGyRMw.json")).not.toMatch(/@|\/home\//);
  });
});

describe("item-types.json", () => {
  it("is read from the commit upstream.json pins", () => {
    expect(ITEM_TYPES.header).toMatchObject({
      commit: UPSTREAM.commit,
      file: "Randomizer.SMZ3/Item.cs",
      repo: UPSTREAM.repo,
    });
  });

  it("is listed among the files the drift workflow watches", () => {
    expect(UPSTREAM.rules.map(({ file }) => file)).toContain(
      ITEM_TYPES.header.file,
    );
  });
});
