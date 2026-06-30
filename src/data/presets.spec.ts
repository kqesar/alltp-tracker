import { describe, expect, it } from "vitest";
import { DEFAULT_PRESET_ID, getPreset, presets } from "@/data/presets";

describe("presets", () => {
  it("each preset has a unique id and the required fields", () => {
    const ids = new Set<string>();
    for (const preset of presets) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);
    }
  });

  it("getPreset returns the matching preset", () => {
    expect(getPreset("keysanity").id).toBe("keysanity");
  });

  it("getPreset falls back to the default for an unknown id", () => {
    expect(getPreset("nope").id).toBe(DEFAULT_PRESET_ID);
  });

  it("the keysanity preset enables keysanity", () => {
    expect(getPreset("keysanity").settings.keysanity).toBe(true);
  });

  it("the default preset exists", () => {
    expect(presets.some((preset) => preset.id === DEFAULT_PRESET_ID)).toBe(
      true,
    );
  });
});
