import { describe, expect, it } from "vitest";
import { checkSize, MAX_SPOILER_BYTES } from "./limits";
import { accept, MAX_DETAIL_LENGTH, refuse } from "./result";

describe("results", () => {
  it("accepts a value", () => {
    expect(accept(3)).toEqual({ ok: true, value: 3 });
  });

  it("refuses with a code, and a detail only when given one", () => {
    expect(refuse("stripped")).toEqual({ error: "stripped", ok: false });
    expect(refuse("unsupported", "multiworld")).toEqual({
      detail: "multiworld",
      error: "unsupported",
      ok: false,
    });
  });

  it("cuts a long detail to the bound, ellipsis included", () => {
    const got = refuse("not-a-spoiler", "x".repeat(1000));
    expect(got.detail).toHaveLength(MAX_DETAIL_LENGTH);
    expect(got.detail?.endsWith("…")).toBe(true);
    expect(
      refuse("not-a-spoiler", "y".repeat(MAX_DETAIL_LENGTH)).detail,
    ).toHaveLength(MAX_DETAIL_LENGTH);
    expect(
      refuse("not-a-spoiler", "y".repeat(MAX_DETAIL_LENGTH)).detail,
    ).not.toContain("…");
  });
});

describe("checkSize", () => {
  it("lets a file at the bound through and refuses one byte over", () => {
    for (const game of ["alttpr", "sm", "smz3"] as const) {
      expect(checkSize(game, MAX_SPOILER_BYTES[game])).toBeNull();
      expect(checkSize(game, MAX_SPOILER_BYTES[game] + 1)).toMatchObject({
        error: "too-large",
        ok: false,
      });
    }
  });

  it("gives Map Rando room for its 21 MB log and the others for 1 MiB", () => {
    expect(checkSize("sm", 21 * 1024 * 1024)).toBeNull();
    expect(checkSize("alttpr", 21 * 1024 * 1024)).toMatchObject({
      detail: "1 MiB",
      error: "too-large",
    });
    expect(checkSize("smz3", 2 * 1024 * 1024)).toMatchObject({
      error: "too-large",
    });
  });
});
