import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
  auditDialog,
  auditPage,
  openOnGame,
  smRaceModeOff,
  WIDTHS,
} from "./support";

const FIXTURE = join(
  import.meta.dirname,
  "../../../packs/sm/test/spoilers/dsjF6gGsH.json",
);
const text = readFileSync(FIXTURE, "utf8");

/** Where the screenshots go when asked for (a scratch directory, never the repo). */
const SHOTS = process.env.REVIEW_SHOTS;
const shot = async (page: Page, name: string, width: number) => {
  if (SHOTS) {
    await page.screenshot({
      fullPage: true,
      path: join(SHOTS, `${name}-${width}.png`),
    });
  }
};

const log = (data: string | Buffer, name = "spoiler.json") => ({
  buffer: Buffer.from(data),
  mimeType: "application/json",
  name,
});

/**
 * The real log made as large as maprando.com's (about 21 MB): the fixture's
 * keys, with the two heavy ones the real file has (`game_data` and the
 * traversals) filled with nested values whose strings hold brackets, braces
 * and escaped quotes, which a slicer that did not skip strings would trip on.
 */
const heavyLog = (bytes: number): Buffer => {
  const part = `{"name":"a \\"}{] b","list":[1,2,{"x":null}],"text":"${"z".repeat(180)}"},`;
  const filler = (size: number) =>
    `[${part.repeat(Math.ceil(size / part.length))}{}]`;
  const half = Math.floor(bytes / 2);
  return Buffer.from(
    `{"game_data":${filler(half)},${text.trim().slice(1, -1)},"traversals":${filler(half)}}`,
  );
};

/** A run on the Super Metroid board: a few finds, the timer started. */
const playRun = async (page: Page) => {
  // A review never opens in Race Mode, on by default for Map Rando
  await smRaceModeOff(page);
  await openOnGame(page, "sm");
  await page.evaluate(() => localStorage.removeItem("alltp-tracker-sm"));
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await page.getByTestId("sm-item-morph").click();
  await page.getByTestId("sm-item-ice").click();
  await page.getByTestId("sm-item-missile").click();
  await page.getByTestId("run-timer").click();
  await page.getByTestId("run-timer-start").click();
  await page.keyboard.press("Escape");
};

/**
 * A run autotracking followed, over: the places it saw taken, each with the
 * timer's reading (a Morph Ball 12:34 in, a Super Missile before the timer, an
 * Energy Tank 20:04 in), written into the run's save as the follower lays them.
 */
const playFoundRun = async (page: Page) => {
  // A review never opens in Race Mode, on by default for Map Rando
  await smRaceModeOff(page);
  await openOnGame(page, "sm");
  await page.evaluate(() => localStorage.removeItem("alltp-tracker-sm"));
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await page.getByTestId("sm-item-morph").click();
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("alltp-tracker-sm") ?? "{}");
    const at = Date.now();
    saved.state.found = {
      "17:2": { at, ms: 1_204_000 },
      "28:2": { at, ms: null },
      "46:2": { at, ms: 754_000 },
    };
    saved.state.timer = {
      elapsedMs: 3_600_000,
      finished: true,
      startedAt: null,
    };
    localStorage.setItem("alltp-tracker-sm", JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByTestId("review-open")).toBeVisible();
};

const endRun = async (page: Page) => {
  await page.getByTestId("run-timer").click();
  await page.getByTestId("run-timer-end").click();
  await page
    .getByRole("dialog", { name: "End this run?" })
    .getByRole("button", { name: "End run" })
    .click();
};

test.describe("reviewing a finished Super Metroid run", () => {
  test("opens only once the run is over, and never leaves the page", async ({
    page,
  }) => {
    await playRun(page);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));

    // Counting: no way in
    await expect(page.getByTestId("review-open")).toHaveCount(0);

    // End run asks first, on Cancel
    await page.getByTestId("run-timer").click();
    await page.getByTestId("run-timer-end").click();
    const ending = page.getByRole("dialog", { name: "End this run?" });
    await expect(ending.getByRole("button", { name: "Cancel" })).toBeFocused();
    await ending.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("review-open")).toHaveCount(0);
    await page.getByTestId("run-timer").click();
    await page.getByTestId("run-timer-end").click();
    await ending.getByRole("button", { name: "End run" }).click();
    await expect(page.getByTestId("run-timer")).toHaveAccessibleName(
      /, stopped$/,
    );
    await expect(page.getByTestId("review-open")).toBeVisible();

    // Import: the real worker reads the file
    await page.getByTestId("review-open").click();
    await page.getByTestId("review-file").setInputFiles(log(text));
    await expect(page.getByTestId("review-notice")).toBeVisible();
    await expect(page.getByTestId("review-binding")).toContainText(
      "Not verified: Map Rando's log names no seed",
    );
    await expect(page.getByTestId("review-caption")).toHaveText(
      "16 items: 2 held, 14 never found.",
    );
    await expect(page.getByTestId("review-row-46:4")).toContainText(
      "Never found",
    );
    await expect(page.getByTestId("sm-item-morph")).toHaveAccessibleName(
      /In the seed: Brinstar Reserve Tank Room: Chozo Item \(Crateria\)\.$/,
    );

    // The file stayed on the device and out of storage
    expect(
      requests.filter(
        (url) => !new URL(url).pathname.startsWith("/alltp-tracker/"),
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(() =>
        JSON.stringify({ ...localStorage, ...sessionStorage }),
      ),
    ).not.toContain("Chozo Item");

    // Close review, then reload: nothing is left
    await page.getByTestId("review-close").click();
    await expect(page.getByTestId("review-notice")).toHaveCount(0);
    await page.getByTestId("review-open").click();
    await page.getByTestId("review-file").setInputFiles(log(text));
    await expect(page.getByTestId("review-notice")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("review-notice")).toHaveCount(0);
    await expect(page.getByTestId("run-timer")).toHaveAccessibleName(
      /, stopped$/,
    );
  });

  test("sets the places the run found against the log, with their times", async ({
    page,
  }) => {
    await playFoundRun(page);
    await page.getByTestId("review-open").click();
    await page.getByTestId("review-file").setInputFiles(log(text));
    await expect(page.getByTestId("review-notice")).toBeVisible();

    await expect(page.getByTestId("review-mode")).toContainText(
      "Autotracking saw which places you took",
    );
    await expect(page.getByTestId("review-caption")).toHaveText(
      "16 items: 1 found, 15 not found.",
    );
    const morph = page.getByTestId("review-row-46:2");
    await expect(morph).toHaveAttribute("data-state", "found");
    await expect(morph).toContainText("Found at 12:34");
    const speed = page.getByTestId("review-row-46:4");
    await expect(speed).toHaveAttribute("data-state", "missed");
    await expect(speed).toContainText("Not found");
    await expect(page.getByTestId("review-pack-energyTank")).toContainText(
      "1 of 14 found, 13 never found",
    );
    await expect(page.getByTestId("review-pack-superMissile")).toContainText(
      "1 of 10 found, 9 never found",
    );
    await page.getByTestId("review-places").locator("summary").click();
    await expect(page.getByTestId("review-place-17:2")).toContainText(
      "Found at 20:04",
    );
    await expect(page.getByTestId("review-place-28:2")).toHaveText(
      /Super Missile: .* — Found$/,
    );
  });

  test("refuses a file that is not a Map Rando log, with the reason", async ({
    page,
  }) => {
    await playRun(page);
    await endRun(page);
    await page.getByTestId("review-open").click();

    await page.getByTestId("review-file").setInputFiles({
      buffer: Buffer.from([0, 1, 2, 3, 255]),
      mimeType: "application/octet-stream",
      name: "game.sfc",
    });
    await expect(page.getByTestId("review-error")).toContainText("ROM");
    await page
      .getByTestId("review-file")
      .setInputFiles(
        log('{"meta":{"worlds":1}}', "alttpr - NoGlitches_9MQ9gO1wMD.txt"),
      );
    await expect(page.getByTestId("review-error")).toContainText(
      "A Link to the Past spoiler log",
    );
    await expect(page.getByTestId("review-notice")).toHaveCount(0);
  });

  test("reads a log of maprando.com's size in the worker, the page staying alive", async ({
    page,
  }, info) => {
    await playRun(page);
    await endRun(page);
    await page.getByTestId("review-open").click();

    // The read is a Web Worker's, not the page's
    const workers: string[] = [];
    page.on("worker", (worker) => workers.push(worker.url()));
    const file = heavyLog(21 * 1024 * 1024);
    expect(file.length).toBeGreaterThan(20.5 * 1024 * 1024);
    // From the moment the file is picked to the review standing, and the
    // longest stretch the page went without drawing a frame
    await page.evaluate(() => {
      const probe = { end: 0, gap: 0, gaps: [] as number[][], start: 0 };
      (window as unknown as { probe: typeof probe }).probe = probe;
      document.addEventListener(
        "change",
        () => {
          probe.start = performance.now();
        },
        { capture: true },
      );
      let last = performance.now();
      const frame = (now: number) => {
        if (probe.start > 0 && last >= probe.start && probe.end === 0) {
          probe.gap = Math.max(probe.gap, now - last);
          if (now - last > 80) {
            probe.gaps.push([
              Math.round(last - probe.start),
              Math.round(now - last),
            ]);
          }
        }
        last = now;
        if (probe.end === 0) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      new MutationObserver(() => {
        if (
          probe.end === 0 &&
          document.querySelector('[data-testid="review-notice"]')
        ) {
          probe.end = performance.now();
        }
      }).observe(document.body, { childList: true, subtree: true });
    });
    await page.getByTestId("review-file").setInputFiles(log(file));
    await expect(page.getByTestId("review-notice")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("review-caption")).toHaveText(
      "16 items: 2 held, 14 never found.",
    );
    const probe = await page.evaluate(
      () =>
        (
          window as unknown as {
            probe: {
              end: number;
              gap: number;
              gaps: number[][];
              start: number;
            };
          }
        ).probe,
    );
    const ms = Math.round(probe.end - probe.start);
    info.annotations.push({
      description: `${(file.length / 1e6).toFixed(1)} MB read in ${ms} ms, longest frame ${Math.round(probe.gap)} ms, slow frames ${JSON.stringify(probe.gaps)}`,
      type: "import",
    });
    expect(workers).toHaveLength(1);
    expect(workers[0]).toMatch(/\/assets\/review-spoiler\.worker-[\w-]+\.js$/);
    // The page keeps drawing while the worker reads
    expect(probe.gap).toBeLessThan(250);
    expect(ms).toBeLessThan(10_000);
  });
});

for (const width of WIDTHS) {
  test.describe(`the Super Metroid review at ${width}px`, () => {
    const phone = width < 600;
    test.use({
      hasTouch: phone,
      isMobile: phone,
      viewport: { height: phone ? 844 : 900, width },
    });

    test("fits the page, passes axe and is keyboard-reachable", async ({
      page,
    }) => {
      await playRun(page);

      await page.getByTestId("run-timer").click();
      await page.getByTestId("run-timer-end").click();
      const ending = page.getByRole("dialog", { name: "End this run?" });
      await auditDialog(page, ending, width);
      await shot(page, "sm-end-run", width);
      await ending.getByRole("button", { name: "End run" }).click();
      await expect(page.getByTestId("review-open")).toBeVisible();
      await auditPage(page);
      await shot(page, "sm-over", width);

      await page.getByTestId("review-open").click();
      const dialog = page.getByRole("dialog", { name: "Review this run" });
      await auditDialog(page, dialog, width);
      await shot(page, "sm-import", width);

      await page.getByTestId("review-file").setInputFiles(log(text));
      await expect(page.getByTestId("review-notice")).toBeVisible();
      await expect(page.getByTestId("review-result")).toBeVisible();
      await auditPage(page);
      await shot(page, "sm-review", width);

      await page.getByTestId("review-places").locator("summary").click();
      await auditPage(page);
      await shot(page, "sm-review-places", width);
    });

    test("by location: fits the page, passes axe and is keyboard-reachable", async ({
      page,
    }) => {
      await playFoundRun(page);
      await page.getByTestId("review-open").click();
      await page.getByTestId("review-file").setInputFiles(log(text));
      await expect(page.getByTestId("review-result")).toBeVisible();
      await expect(page.getByTestId("review-row-46:2")).toContainText(
        "Found at 12:34",
      );
      await auditPage(page);
      await shot(page, "sm-found-review", width);

      await page.getByTestId("review-places").locator("summary").click();
      await auditPage(page);
      await shot(page, "sm-found-places", width);
    });
  });
}
