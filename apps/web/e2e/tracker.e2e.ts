import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/** Phone, tablet, laptop and desktop: the widths every layout must hold at. */
const WIDTHS = [390, 820, 1440, 1920] as const;

/** The accessibility standard every page state is held to. */
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Regions that must never cover one another, by data-testid. */
const REGIONS = ["toolbar", "item-grid", "map-tracker", "map-legend"] as const;

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
      const audit = new AxeBuilder({ page }).withTags(WCAG_AA);
      const { violations } = await audit
        .disableRules(["target-size"])
        .analyze();
      // Map markers sit where the location is in the game, some closer than
      // 24 px apart: WCAG 2.5.8's "essential" exception for map pins. Every
      // other target must meet the size rule.
      const { violations: smallTargets } = await new AxeBuilder({ page })
        .withRules(["target-size"])
        .exclude(".mapspan")
        .analyze();

      expect(problems).toEqual([]);
      expect(
        [...violations, ...smallTargets].map(
          ({ id, nodes }) => `${id} ×${nodes.length}`,
        ),
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
      await openTracker(page);

      expect(await unreachableClickables(page)).toEqual([]);
    });
  });
}

test.describe("a tooltip", () => {
  test.beforeEach(({ page }) => openTracker(page));

  test("appears beside the hovered marker and stays on screen", async ({
    page,
  }) => {
    // Turtle Rock's boss sits against the map's right edge
    const marker = page.getByTestId("boss-marker-9");
    await marker.hover();

    const tooltip = page.getByTestId("tooltip");
    await expect(tooltip).toContainText("Turtle Rock");
    const box = await tooltip.boundingBox();
    const anchor = await marker.boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    expect(box && anchor).toBeTruthy();
    if (!box || !anchor) return;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    // Above or below the marker, not on top of it
    expect(
      box.y + box.height <= anchor.y || box.y >= anchor.y + anchor.height,
    ).toBe(true);

    await page.mouse.move(0, 0);
    await expect(tooltip).toBeHidden();
  });

  test("follows keyboard focus and closes on Escape", async ({ page }) => {
    await page.getByTestId("item-flute").focus();
    await page.keyboard.press("ArrowRight");

    await expect(page.getByTestId("tooltip")).toHaveText("Hookshot");

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("tooltip")).toBeHidden();
  });

  test("shows its item icons without a black backdrop", async ({ page }) => {
    // King's Tomb: boots, Titan's Mitt and mirror, all once on black squares
    await page.getByTestId("chest-marker-0").hover();
    const icons = page.getByTestId("tooltip").locator("img");
    await expect(icons).toHaveCount(3);

    const cornerAlphas = await icons.evaluateAll((images) =>
      (images as HTMLImageElement[]).map((image) => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d") as CanvasRenderingContext2D;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, 1, 1).data[3];
      }),
    );

    expect(cornerAlphas).toEqual([0, 0, 0]);
  });
});

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
