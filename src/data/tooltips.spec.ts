import { describe, expect, it } from "vitest";
import {
  type DungeonTooltipData,
  dungeonTooltips,
  helpContent,
  itemTooltips,
  type TooltipData,
} from "./tooltips";

describe("tooltips data", () => {
  describe("itemTooltips", () => {
    it("contains required items", () => {
      const requiredItems = [
        "sword",
        "shield",
        "bow",
        "boomerang",
        "hookshot",
        "hammer",
        "lantern",
        "firerod",
        "icerod",
        "bombos",
        "ether",
        "quake",
        "moonpearl",
        "mirror",
        "flippers",
        "boots",
        "glove",
        "flute",
        "shovel",
      ];

      requiredItems.forEach((item) => {
        expect(itemTooltips).toHaveProperty(item);
        expect(itemTooltips[item]).toBeDefined();
      });
    });

    it("has valid TooltipData structure for all items", () => {
      Object.entries(itemTooltips).forEach(
        ([, data]: [string, TooltipData]) => {
          expect(data.title).toBeDefined();
          expect(typeof data.title).toBe("string");
          expect(data.title.length).toBeGreaterThan(0);

          expect(data.description).toBeDefined();
          expect(typeof data.description).toBe("string");
          expect(data.description.length).toBeGreaterThan(0);

          if (data.mechanics) {
            expect(typeof data.mechanics).toBe("string");
            expect(data.mechanics.length).toBeGreaterThan(0);
          }

          if (data.tips) {
            expect(typeof data.tips).toBe("string");
            expect(data.tips.length).toBeGreaterThan(0);
          }

          if (data.shortcuts) {
            expect(Array.isArray(data.shortcuts)).toBe(true);
            data.shortcuts.forEach((shortcut) => {
              expect(typeof shortcut).toBe("string");
              expect(shortcut.length).toBeGreaterThan(0);
            });
          }
        },
      );
    });

    it("contains detailed information for progressive items", () => {
      const progressiveItems = ["sword", "shield", "bow", "boomerang", "glove"];

      progressiveItems.forEach((item) => {
        const data = itemTooltips[item];
        expect(data.mechanics).toBeDefined();
        expect(data.mechanics).toContain("Level");
      });
    });

    it("includes keyboard shortcuts for applicable items", () => {
      Object.values(itemTooltips).forEach((data: TooltipData) => {
        if (data.shortcuts) {
          expect(data.shortcuts.length).toBeGreaterThan(0);
          expect(
            data.shortcuts.some(
              (shortcut) =>
                shortcut.includes("Space") ||
                shortcut.includes("Enter") ||
                shortcut.includes("Arrow"),
            ),
          ).toBe(true);
        }
      });
    });
  });

  describe("dungeonTooltips", () => {
    it("contains all boss dungeons", () => {
      const dungeonKeys = [
        "boss0",
        "boss1",
        "boss2",
        "boss3",
        "boss4",
        "boss5",
        "boss6",
        "boss7",
        "boss8",
        "boss9",
        "agahnim",
      ];

      dungeonKeys.forEach((key) => {
        expect(dungeonTooltips).toHaveProperty(key);
        expect(dungeonTooltips[key]).toBeDefined();
      });
    });

    it("has valid DungeonTooltipData structure", () => {
      Object.entries(dungeonTooltips).forEach(
        ([, data]: [string, DungeonTooltipData]) => {
          // Base TooltipData properties
          expect(data.title).toBeDefined();
          expect(typeof data.title).toBe("string");
          expect(data.title.length).toBeGreaterThan(0);

          expect(data.description).toBeDefined();
          expect(typeof data.description).toBe("string");
          expect(data.description.length).toBeGreaterThan(0);

          // Dungeon-specific properties
          if (data.requirements) {
            expect(Array.isArray(data.requirements)).toBe(true);
            data.requirements.forEach((req) => {
              expect(typeof req).toBe("string");
              expect(req.length).toBeGreaterThan(0);
            });
          }

          if (data.medallion) {
            expect(typeof data.medallion).toBe("string");
            expect(data.medallion.length).toBeGreaterThan(0);
          }

          if (data.chestCount !== undefined) {
            expect(typeof data.chestCount).toBe("number");
            expect(data.chestCount).toBeGreaterThanOrEqual(0);
          }
        },
      );
    });

    it("includes requirements for most dungeons", () => {
      const dungeonsWithRequirements = Object.values(dungeonTooltips).filter(
        (data) => data.requirements,
      );

      expect(dungeonsWithRequirements.length).toBeGreaterThan(5);
    });

    it("includes chest counts for most dungeons", () => {
      const dungeonsWithChests = Object.values(dungeonTooltips).filter(
        (data) => data.chestCount !== undefined,
      );

      expect(dungeonsWithChests.length).toBeGreaterThan(5);
    });

    it("has medallion information for special dungeons", () => {
      expect(dungeonTooltips.boss8.medallion).toBeDefined(); // Misery Mire
      expect(dungeonTooltips.boss9.medallion).toBeDefined(); // Turtle Rock
    });
  });

  describe("helpContent", () => {
    it("has keyboardShortcuts section", () => {
      expect(helpContent.keyboardShortcuts).toBeDefined();
      expect(helpContent.keyboardShortcuts.title).toBe("Keyboard Shortcuts");
      expect(Array.isArray(helpContent.keyboardShortcuts.sections)).toBe(true);
    });

    it("has gameplayTips section", () => {
      expect(helpContent.gameplayTips).toBeDefined();
      expect(helpContent.gameplayTips.title).toBe("Gameplay Tips");
      expect(Array.isArray(helpContent.gameplayTips.sections)).toBe(true);
    });

    it("keyboard shortcuts have proper structure", () => {
      helpContent.keyboardShortcuts.sections.forEach((section) => {
        expect(section.title).toBeDefined();
        expect(typeof section.title).toBe("string");
        expect(section.title.length).toBeGreaterThan(0);

        expect(Array.isArray(section.shortcuts)).toBe(true);
        section.shortcuts.forEach((shortcut) => {
          expect(shortcut.keys).toBeDefined();
          expect(Array.isArray(shortcut.keys)).toBe(true);
          expect(shortcut.keys.length).toBeGreaterThan(0);

          expect(shortcut.description).toBeDefined();
          expect(typeof shortcut.description).toBe("string");
          expect(shortcut.description.length).toBeGreaterThan(0);
        });
      });
    });

    it("gameplay tips have proper structure", () => {
      helpContent.gameplayTips.sections.forEach((section) => {
        expect(section.title).toBeDefined();
        expect(typeof section.title).toBe("string");
        expect(section.title.length).toBeGreaterThan(0);

        expect(Array.isArray(section.tips)).toBe(true);
        section.tips.forEach((tip) => {
          expect(typeof tip).toBe("string");
          expect(tip.length).toBeGreaterThan(0);
        });
      });
    });

    it("includes essential keyboard shortcuts", () => {
      const allShortcuts = helpContent.keyboardShortcuts.sections
        .flatMap((section) => section.shortcuts)
        .flatMap((shortcut) => shortcut.keys);

      expect(allShortcuts).toContain("←");
      expect(allShortcuts).toContain("→");
      expect(allShortcuts).toContain("↑");
      expect(allShortcuts).toContain("↓");
      expect(allShortcuts).toContain("Space");
      expect(allShortcuts).toContain("Enter");
      expect(allShortcuts).toContain("Tab");
    });

    it("includes essential gameplay tips", () => {
      const allTips = helpContent.gameplayTips.sections.flatMap(
        (section) => section.tips,
      );

      expect(allTips.some((tip) => tip.includes("Moon Pearl"))).toBe(true);
      expect(allTips.some((tip) => tip.includes("Lantern"))).toBe(true);
      expect(allTips.some((tip) => tip.includes("medallion"))).toBe(true);
    });

    it("has multiple sections for both help types", () => {
      expect(
        helpContent.keyboardShortcuts.sections.length,
      ).toBeGreaterThanOrEqual(3);
      expect(helpContent.gameplayTips.sections.length).toBeGreaterThanOrEqual(
        3,
      );
    });
  });

  describe("data consistency", () => {
    it("tooltip data keys match expected game items", () => {
      // Check that we have tooltips for core game progression items
      const coreItems = [
        "sword",
        "bow",
        "moonpearl",
        "mirror",
        "lantern",
        "hammer",
        "hookshot",
        "flippers",
        "boots",
        "glove",
      ];

      coreItems.forEach((item) => {
        expect(itemTooltips[item]).toBeDefined();
      });
    });

    it("dungeon names are descriptive", () => {
      Object.values(dungeonTooltips).forEach((data) => {
        expect(data.title).not.toBe("");
        expect(data.title).not.toMatch(/^boss\d+$/); // Should not be just "boss0", etc.
      });
    });

    it("no empty or placeholder content", () => {
      const allTooltips = [
        ...Object.values(itemTooltips),
        ...Object.values(dungeonTooltips),
      ];

      allTooltips.forEach((data) => {
        expect(data.title).not.toMatch(/TODO|PLACEHOLDER|TBD/i);
        expect(data.description).not.toMatch(/TODO|PLACEHOLDER|TBD/i);

        if (data.mechanics) {
          expect(data.mechanics).not.toMatch(/TODO|PLACEHOLDER|TBD/i);
        }

        if (data.tips) {
          expect(data.tips).not.toMatch(/TODO|PLACEHOLDER|TBD/i);
        }
      });
    });
  });
});
