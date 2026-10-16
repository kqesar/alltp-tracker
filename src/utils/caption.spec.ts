import { describe, expect, it } from "vitest";
import { chests } from "@/data/chests";
import { dungeons } from "@/data/dungeons";
import { icon } from "@/data/logic";
import { captionToText, iconLabel, placeName } from "@/utils/caption";

describe("captionToText", () => {
  it("reads each icon as the item it stands for", () => {
    expect(
      captionToText(
        `King's Tomb ${icon("boots.png")} + ${icon("glove2.png")}/${icon("mirror.png")}`,
      ),
    ).toBe("King's Tomb Pegasus Boots + Titan's Mitt/Magic Mirror");
  });

  it("names the medallion a dungeon asks for", () => {
    expect(captionToText(`Misery Mire ${icon("medallion2.png")}`)).toBe(
      "Misery Mire Ether",
    );
  });

  it("leaves plain text alone", () => {
    expect(captionToText("Tavern")).toBe("Tavern");
  });

  it("turns every chest and dungeon name into words, with no markup left", () => {
    for (const { name } of [...chests, ...dungeons]) {
      const text = captionToText(name);

      expect(text).not.toMatch(/[<>]/);
      expect(text).not.toMatch(/\bundefined\b/);
    }
  });
});

describe("iconLabel", () => {
  it("falls back to the item's own label", () => {
    expect(iconLabel("moonpearl")).toBe("Moon Pearl");
    expect(iconLabel("hookshot")).toBe("Hookshot");
  });
});

describe("placeName", () => {
  it("keeps only the name of the place", () => {
    expect(placeName(dungeons[0].name)).toBe("Eastern Palace");
    expect(placeName(dungeons[9].name)).toBe("Turtle Rock");
  });
});
