import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  pixelsIn,
  setKeyCells,
  unreachableClickables,
  WCAG_AA,
  WIDTHS,
} from "./support";

/** Regions that must never cover one another, by data-testid. */
const REGIONS = ["toolbar", "item-grid", "map-tracker", "map-legend"] as const;

/** Load the tracker with nothing tracked. */
const openTracker = async (page: Page) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

/** More Tab stops than the page has before the map. */
const MAX_TAB_STOPS = 40;

/**
 * Tab from the top of the page to the first map marker (the markers all share
 * one style), and list the stops that do not draw the focus ring
 * (--focus-ring): on the control itself, or on the label dressing it.
 */
const focusStopsWithoutRing = async (page: Page) => {
  const ring = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.boxShadow = "var(--focus-ring)";
    document.body.append(probe);
    const value = getComputedStyle(probe).boxShadow;
    probe.remove();
    return value;
  });

  const unringed: string[] = [];
  for (let stop = 0; stop < MAX_TAB_STOPS; stop++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate((ring) => {
      const element = document.activeElement ?? document.body;
      const drawn = element.closest("label") ?? element;
      // Read the ring where its transition ends, not where it starts
      for (const animation of drawn.getAnimations()) animation.finish();
      return {
        name:
          element.getAttribute("data-testid") ??
          element.textContent?.trim() ??
          element.tagName,
        onMap: element.closest("#map") !== null,
        ringed: getComputedStyle(drawn).boxShadow === ring,
      };
    }, ring);
    if (!focused.ringed) unringed.push(focused.name);
    if (focused.onMap) return unringed;
  }
  throw new Error(`no map marker within ${MAX_TAB_STOPS} Tab stops`);
};

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

    test("rings every control the keyboard focuses", async ({ page }) => {
      await openTracker(page);

      const unringed = await focusStopsWithoutRing(page);

      expect(unringed).toEqual([]);
    });

    test("fits the hearts in the tunic's cell, two digits included, and steps them by keyboard", async ({
      page,
    }) => {
      await openTracker(page);
      const hearts = page.getByTestId("hearts-overlay");
      await expect(hearts).toHaveAccessibleName(/^Hearts: not set\./);

      // From the tunic, the arrow keys reach the hearts in the same cell
      await page.getByTestId("item-tunic").focus();
      await page.keyboard.press("ArrowRight");
      await expect(hearts).toBeFocused();
      for (let step = 0; step < 18; step++) await page.keyboard.press("Space");
      await expect(hearts).toHaveAccessibleName(/^Hearts: 20\./);

      const [cell, button, count] = await Promise.all([
        page.getByTestId("item-tunic").boundingBox(),
        hearts.boundingBox(),
        hearts.locator(".heart-counter__count").boundingBox(),
      ]);
      if (!(cell && button && count)) throw new Error("no hearts box");
      const inside = (
        a: { x: number; y: number; width: number; height: number },
        b: { x: number; y: number; width: number; height: number },
      ) =>
        a.x >= b.x - 0.5 &&
        a.y >= b.y - 0.5 &&
        a.x + a.width <= b.x + b.width + 0.5 &&
        a.y + a.height <= b.y + b.height + 0.5;
      expect(inside(button, cell)).toBe(true);
      // "20" stays within its heart
      expect(inside(count, button)).toBe(true);
    });
  });
}

test.describe("the half magic cell", () => {
  test.beforeEach(({ page }) => openTracker(page));

  test("sits between the tunic and the boots, and toggles by click and by its key", async ({
    page,
  }) => {
    const magic = page.getByTestId("item-magic");
    const [tunic, cell, boots] = await Promise.all(
      ["item-tunic", "item-magic", "item-boots"].map((id) =>
        page.getByTestId(id).boundingBox(),
      ),
    );
    expect(tunic && cell && boots).toBeTruthy();
    if (!(tunic && cell && boots)) return;
    expect(tunic.y).toBe(cell.y);
    expect(cell.y).toBe(boots.y);
    expect(tunic.x).toBeLessThan(cell.x);
    expect(cell.x).toBeLessThan(boots.x);

    await expect(magic).toHaveAccessibleName(/^Half Magic, not obtained\./);
    await magic.click();
    await expect(magic).toHaveAccessibleName(/^Half Magic, obtained\./);
    // Slash steps it, as a click does
    await page.keyboard.press("Slash");
    await expect(magic).toHaveAccessibleName(/^Half Magic, not obtained\./);
    await page.keyboard.press("Slash");
    await expect(magic).toHaveAccessibleName(/^Half Magic, obtained\./);
  });
});

test.describe("a tooltip", () => {
  test.beforeEach(({ page }) => openTracker(page));

  test("appears beside the hovered marker and stays on screen", async ({
    page,
  }) => {
    // Turtle Rock's boss sits against the map's right edge
    const marker = page.getByTestId("boss-marker-turtle-rock");
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

  test("stays while hovered, yet lets a press reach the item it covers", async ({
    page,
  }) => {
    // Skull Woods' boss sits under the Magic Mirror: its tooltip, above it
    // or over it where the screen is short, covers the mirror's cell
    const boss = page.getByTestId("item-boss5");
    const mirror = page.getByTestId("item-mirror");
    const tooltip = page.getByTestId("tooltip");
    const bossBox = await boss.boundingBox();
    const mirrorBox = await mirror.boundingBox();
    expect(bossBox && mirrorBox).toBeTruthy();
    if (!bossBox || !mirrorBox) return;
    await page.mouse.move(
      bossBox.x + bossBox.width / 2,
      bossBox.y + bossBox.height / 2,
    );
    await expect(tooltip).toContainText("Skull Woods");
    const x = mirrorBox.x + mirrorBox.width / 2;
    const y = mirrorBox.y + mirrorBox.height / 2;
    const tip = await tooltip.boundingBox();
    expect(tip).toBeTruthy();
    if (!tip) return;
    expect(
      x >= tip.x &&
        x <= tip.x + tip.width &&
        y >= tip.y &&
        y <= tip.y + tip.height,
    ).toBe(true);

    // A quick flick lands on the tooltip, over the mirror: it stays (WCAG
    // 1.4.13, hoverable), and a press there reaches the mirror
    await page.mouse.move(x, y);
    await page.waitForTimeout(300);
    await expect(tooltip).toContainText("Skull Woods");
    await page.mouse.down();
    await page.mouse.up();

    await expect(mirror).toHaveAccessibleName(/^Magic Mirror, obtained\./);
    await expect(tooltip).toBeHidden();
  });

  test("follows keyboard focus and closes on Escape", async ({ page }) => {
    await page.getByTestId("item-flute").focus();
    await page.keyboard.press("ArrowRight");

    // The item's name, then its keyboard shortcuts
    await expect(page.getByTestId("tooltip")).toHaveText(/^Hookshot/);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("tooltip")).toBeHidden();
  });

  test("shows its icons without a black backdrop", async ({ page }) => {
    // The medallion Misery Mire's pad asks for, once on a black square
    await page.getByTestId("boss-marker-misery-mire").hover();
    const icons = page.getByTestId("tooltip").locator("img");
    await expect(icons).toHaveCount(1);

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

    expect(cornerAlphas).toEqual([0]);
  });
});

test.describe("a missing item", () => {
  test.beforeEach(({ page }) => openTracker(page));

  type Box = { x: number; y: number; width: number; height: number };

  /**
   * The colour spread (max - min channel) of each pixel drawn in a region,
   * those brighter than the page, once the region's image has loaded: at
   * least `share` of its pixels drawn.
   */
  const drawnSpreads = async (page: Page, clip: Box, share: number) => {
    const read = async () =>
      (await pixelsIn(page, clip))
        .filter(([red, green, blue]) => Math.max(red, green, blue) > 24)
        .map(
          (pixel) =>
            Math.max(...pixel.slice(0, 3)) - Math.min(...pixel.slice(0, 3)),
        );
    const minimum = clip.width * clip.height * share;
    await expect
      .poll(async () => (await read()).length)
      .toBeGreaterThan(minimum);
    return read();
  };

  test("is drawn greyed, its focus ring at full strength", async ({ page }) => {
    const hammer = page.getByTestId("item-hammer");
    await expect(hammer).toHaveAccessibleName(/^Hammer, not obtained\./);
    const box = await hammer.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    // The icon itself, every pixel of it grey: the old veil only darkened it
    const missing = await drawnSpreads(page, box, 0.1);
    expect(Math.max(...missing)).toBeLessThanOrEqual(3);

    // A keyboard focus ring stays gold, drawn outside the filter
    await page.getByTestId("item-flute").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await expect(hammer).toBeFocused();
    const [[red, green, blue]] = await pixelsIn(page, {
      height: 1,
      width: 1,
      x: box.x + box.width / 2,
      y: box.y - 3,
    });
    expect([red > 200, green > 160, blue < 120]).toEqual([true, true, true]);

    // Held, it is drawn in its own colours again
    await hammer.click();
    await page.mouse.move(0, 0);
    await expect
      .poll(async () => Math.max(...(await drawnSpreads(page, box, 0.1))))
      .toBeGreaterThan(40);
  });

  test("greys a key not found the same way, in colour once held", async ({
    page,
  }) => {
    await setKeyCells(page, true);
    await page.mouse.move(0, 0);
    const key = page.getByTestId("big-key-0");
    await expect(key).toHaveAccessibleName(
      "Eastern Palace big key: not obtained",
    );
    const box = await key.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    const missing = await drawnSpreads(page, box, 0.1);
    expect(Math.max(...missing)).toBeLessThanOrEqual(3);

    await key.click();
    await page.mouse.move(0, 0);
    await expect(key).toHaveAccessibleName("Eastern Palace big key: obtained");
    await expect
      .poll(async () => Math.max(...(await drawnSpreads(page, box, 0.1))))
      .toBeGreaterThan(40);
  });

  test("greys a boss not beaten the same way, its overlays in colour", async ({
    page,
  }) => {
    const boss = page.getByTestId("item-boss0");
    await expect(boss).toHaveAccessibleName(/not defeated\./);
    const box = await boss.boundingBox();
    const reward = await page.getByTestId("reward-overlay-0").boundingBox();
    expect(box && reward).toBeTruthy();
    if (!box || !reward) return;

    // The portrait's top half, clear of the corner overlays: grey
    const portrait = await drawnSpreads(
      page,
      { ...box, height: box.height / 2 },
      0.25,
    );
    expect(Math.max(...portrait)).toBeLessThanOrEqual(3);
    // The reward overlay keeps its colours (the unknown reward's "?" glyph)
    const overlay = await drawnSpreads(page, reward, 0.1);
    expect(Math.max(...overlay)).toBeGreaterThan(40);
  });
});

test("keeps the skip links out of view until focused, at any text size", async ({
  page,
}) => {
  await openTracker(page);
  // A 175 % default text size makes each link taller than a fixed offset
  await page.addStyleTag({ content: ":root { font-size: 28px !important; }" });
  const links = page.getByRole("link", { name: /^Skip to/ });

  for (const link of await links.all()) {
    const box = await link.boundingBox();
    expect(box && box.y + box.height).toBeLessThanOrEqual(0);
  }
  await page.keyboard.press("Tab");
  await expect(links.first()).toBeFocused();
  await expect(links.first()).toBeInViewport({ ratio: 1 });
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
    await page.getByRole("button", { name: /^Mode/ }).click();
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
