import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/** Phone, tablet, laptop and desktop: the widths every layout must hold at. */
const WIDTHS = [390, 820, 1440, 1920] as const;

/** Regions that must never cover one another, by data-testid. */
const REGIONS = [
  "toolbar",
  "item-grid",
  "map-tracker",
  "map-legend",
  "caption",
] as const;

/** Load the tracker with nothing tracked. */
const openTracker = async (page: Page) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

/** Clickable-looking elements a keyboard can never reach. */
const unreachableClickables = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter(
        (element) =>
          getComputedStyle(element).cursor === "pointer" &&
          (element as HTMLElement).tabIndex < 0 &&
          !element.closest("button, a, label, summary, input, select"),
      )
      .map(
        (element) => element.getAttribute("data-testid") ?? element.className,
      ),
  );

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    const phone = width < 600;
    test.use({
      hasTouch: phone,
      isMobile: phone,
      viewport: { height: phone ? 844 : 900, width },
    });

    test("loads cleanly and passes axe", async ({ page }) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(message.text());
      });
      page.on("response", (response) => {
        if (response.status() >= 400) {
          problems.push(`${response.status()} ${response.url()}`);
        }
      });

      await openTracker(page);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      expect(problems).toEqual([]);
      expect(
        violations.map(({ id, nodes }) => `${id} ×${nodes.length}`),
      ).toEqual([]);
    });

    test("fits the viewport with no region covering another", async ({
      page,
    }) => {
      await openTracker(page);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      const boxes = await Promise.all(
        REGIONS.map(async (id) => ({
          box: await page.getByTestId(id).boundingBox(),
          id,
        })),
      );
      const overlaps = boxes.flatMap((a, index) =>
        boxes
          .slice(index + 1)
          .filter(
            (b) =>
              a.box &&
              b.box &&
              a.box.x < b.box.x + b.box.width &&
              b.box.x < a.box.x + a.box.width &&
              a.box.y < b.box.y + b.box.height &&
              b.box.y < a.box.y + a.box.height,
          )
          .map((b) => `${a.id} / ${b.id}`),
      );

      expect(overflow).toBeLessThanOrEqual(0);
      expect(overlaps).toEqual([]);
    });

    test("lets a keyboard reach everything a pointer can click", async ({
      page,
    }) => {
      test.fail(true, "Map markers and overlays become buttons (PR C)");
      await openTracker(page);

      expect(await unreachableClickables(page)).toEqual([]);
    });
  });
}

test.describe("a run", () => {
  test.beforeEach(({ page }) => openTracker(page));

  test("undoes and redoes from the keyboard", async ({ page }) => {
    const flute = page.getByTestId("item-flute");

    await flute.click();
    await expect(flute).toHaveAccessibleName(/^Flute, obtained\./);

    await page.keyboard.press("ControlOrMeta+z");
    await expect(flute).toHaveAccessibleName(/^Flute, not obtained\./);

    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(flute).toHaveAccessibleName(/^Flute, obtained\./);
  });

  test("closes only the topmost dialog on Escape", async ({ page }) => {
    await page.getByRole("button", { name: /mode/i }).click();
    await page.getByRole("button", { name: /^Keysanity/ }).click();
    const confirm = page.getByRole("dialog", { name: "Switch run type?" });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(confirm).toBeHidden();
    await expect(
      page.getByRole("dialog", { name: "Choose a run type" }),
    ).toBeVisible();
  });

  test("is followed live by a second tab", async ({ context, page }) => {
    const second = await context.newPage();
    await second.goto("./");

    await page.getByTestId("item-hammer").click();

    await expect(second.getByTestId("item-hammer")).toHaveAccessibleName(
      /^Hammer, obtained\./,
    );
  });

  test("survives an export and an import", async ({ page }, testInfo) => {
    await page.getByTestId("item-hookshot").click();
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    const file = testInfo.outputPath("save.json");
    await (await downloading).saveAs(file);

    await page.getByTestId("item-hookshot").click();
    await page.getByTestId("import-file").setInputFiles(file);
    await page.getByRole("button", { name: "Replace progress" }).click();

    await expect(page.getByTestId("item-hookshot")).toHaveAccessibleName(
      /^Hookshot, obtained\./,
    );
    await expect(page.getByTestId("controls-status")).toHaveText(
      "Save imported.",
    );
  });
});
