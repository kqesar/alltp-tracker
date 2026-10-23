import { describe, expect, it } from "vitest";
import * as z from "zod/mini";
import { createSaveFormat } from "@/games/saveFormat";

const schema = z.object({ items: z.record(z.string(), z.number()) });
type Run = z.infer<typeof schema>;

const { exportSave, IMPORT_ERRORS, parseSave } = createSaveFormat<Run>({
  complete: (run) => ({ items: { a: 0, ...run.items } }),
  game: "toy",
  progressOf: (state) => ({ items: state.items }),
  schema,
  version: 2,
  within: (run) => Object.values(run.items).every((count) => count <= 3),
});

const save = (over: object = {}) =>
  JSON.stringify({
    format: "alltp-tracker-save",
    game: "toy",
    progress: { items: { b: 1 } },
    version: 2,
    ...over,
  });

describe("a save file", () => {
  it("writes the run alone, the game and the version beside it", () => {
    const text = exportSave({ items: { b: 1 }, past: [] } as Run);

    expect(JSON.parse(text)).toEqual({
      format: "alltp-tracker-save",
      game: "toy",
      progress: { items: { b: 1 } },
      version: 2,
    });
    expect(text.endsWith("}\n")).toBe(true);
  });

  it("reads back what it wrote, completed", () => {
    expect(parseSave(exportSave({ items: { b: 1 } }))).toEqual({
      ok: true,
      progress: { items: { a: 0, b: 1 } },
    });
  });

  it.each([
    ["not-json", "{"],
    ["not-a-save", JSON.stringify({ hello: 1 })],
    ["other-game", save({ game: "else" })],
    ["newer-version", save({ version: 3 })],
    ["invalid", save({ progress: { items: "none" } })],
    ["invalid", save({ progress: { items: { b: 4 } } })],
  ])("refuses with %s", (error, text) => {
    expect(parseSave(text)).toEqual({ error, ok: false });
  });

  it("tells the player what each reason means", () => {
    expect(IMPORT_ERRORS["other-game"]).toBe(
      "This save is for another game: switch game to import it there.",
    );
    expect(Object.keys(IMPORT_ERRORS)).toHaveLength(5);
  });
});
