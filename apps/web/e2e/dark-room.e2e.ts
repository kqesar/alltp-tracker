import { readFileSync } from "node:fs";
import { MEMORY_RANGE, type MemoryRangeId } from "@alltp/pack-alttpr";
import { expect, type Page, test } from "@playwright/test";
import { FakeUsb2Snes } from "../../../packages/autotrack/test/fake-usb2snes";
import { auditPage, clickToolbarAction, WIDTHS } from "./support";

// The browser connects to a fake usb2snes bridge over a real WebSocket, as
// autotrack.e2e.ts does. Its memory holds Link's House as a running game held
// it (packs/alttpr/test/dark-room/links-house.json: dark, no Lamp) with a few
// things laid in it, so every kind of tile is drawn.
const ROM_HEADER = 0x00_7fc0;
const RACE_FLAG = 0x18_0213;
const WRAM = 0xf5_0000;
const SHOTS = process.env.DARK_ROOM_SHOTS;

const recording: { ranges: Record<string, string> } = JSON.parse(
  readFileSync(
    new URL(
      "../../../packs/alttpr/test/dark-room/links-house.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

let bridge: FakeUsb2Snes;
let port: number;

test.beforeEach(async () => {
  bridge = await FakeUsb2Snes.start();
  port = Number(new URL(bridge.url).port);
});

test.afterEach(() => bridge.stop());

/** A seed in play with Link in the recorded dark room, no Lamp. */
const boot = ({ race = false, kitchenSink = false } = {}) => {
  const { memory } = bridge;
  const title = `VT ${race ? "RACE" : "OPEN"}`.padEnd(21, " ");
  for (let i = 0; i < title.length; i++) {
    memory[ROM_HEADER + i] = title.charCodeAt(i);
  }
  memory.set(race ? [0x01, 0x00] : [0x00, 0x01], RACE_FLAG);
  memory[WRAM + 0x342] = 0; // keep the grid plain
  for (const [id, text] of Object.entries(recording.ranges)) {
    const { address } = MEMORY_RANGE[id as MemoryRangeId];
    for (let i = 0; i < text.length; i += 2) {
      memory[address + i / 2] = Number.parseInt(text.slice(i, i + 2), 16);
    }
  }
  if (!kitchenSink) return;
  // A little of everything the game's collision map can hold, on the floor
  const map = MEMORY_RANGE["dark-room-map"].address;
  const put = (x: number, y: number, w: number, h: number, value: number) => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++)
        memory[map + (y + dy) * 64 + x + dx] = value;
    }
  };
  put(52, 46, 2, 2, 0x58); // a chest
  put(54, 46, 2, 2, 0x27); // an opened one
  put(43, 55, 2, 2, 0xc0); // a torch, unlit
  put(46, 55, 2, 2, 0xc1); // and a lit one
  put(48, 48, 3, 2, 0x08); // water
  put(52, 50, 3, 1, 0x0d); // spikes
  put(44, 50, 2, 2, 0x20); // a pit
  put(56, 50, 2, 3, 0x30); // stairs
  put(48, 53, 2, 2, 0xf0); // a closed door
  put(42, 46, 2, 1, 0x2a); // a ledge
  put(45, 48, 1, 1, 0x67); // a peg
  put(56, 56, 2, 1, 0x69); // a conveyor
  // Door slot 0 is a small key door
  memory[MEMORY_RANGE["dark-room-doors"].address] = 0x1c;
  // The torch at slot 1 is lit: its word at $0540 + start (6) + 2
  memory[MEMORY_RANGE["dark-room-objects"].address + 0x40 + 6 + 3] = 0x80;
};

const reads = (id: MemoryRangeId) => {
  const { address, size } = MEMORY_RANGE[id];
  return bridge.reads.filter(
    ([at, n]) => at < address + size && address < at + n,
  );
};

const openTracker = async (page: Page) => {
  await page.goto(`./?bridge=${port}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Autotracking" });

const connect = async (page: Page) => {
  await clickToolbarAction(
    page,
    page.getByTestId("autotrack-button"),
    "toolbar-more-autotrack",
  );
  await dialog(page).getByTestId("autotrack-connect").click();
  await expect(dialog(page).getByTestId("autotrack-headline")).toHaveText(
    "Connected",
  );
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
};

test("draws the dark room Link is in without the Lamp, and follows him", async ({
  page,
}) => {
  boot({ kitchenSink: true });
  await openTracker(page);
  const panel = page.getByTestId("dark-room");
  await expect(panel).toBeHidden();

  await connect(page);

  await expect(panel).toBeVisible();
  await expect(panel).toHaveAccessibleName("Dark room");
  await expect(page.getByTestId("dark-room-id")).toHaveText("Room 104");
  await expect(page.getByTestId("dark-room-plan")).toHaveAccessibleName(
    /plan of the dark room/i,
  );
  await expect(page.getByTestId("dark-room-words")).toContainText(
    "Nearest unopened chest:",
  );
  await expect(page.getByTestId("dark-room-words")).toContainText(
    "1 of 2 torches not lit",
  );
  // The legend names what is drawn, in words
  for (const word of ["Chest", "Unlit torch", "Pit", "Water", "Key door"]) {
    await expect(
      page
        .getByRole("list", { name: "Legend" })
        .getByText(word, { exact: true }),
    ).toBeVisible();
  }

  // Link steps right: the marker follows
  const marker = page.getByTestId("dark-room-link");
  const before = await marker.boundingBox();
  const { address } = MEMORY_RANGE["dark-room-link"];
  bridge.memory[address + 2] += 40; // X, 5 tiles
  await expect
    .poll(async () => (await marker.boundingBox())?.x ?? 0)
    .toBeGreaterThan((before?.x ?? 0) + 5);

  for (const width of WIDTHS) {
    await page.setViewportSize({ height: 1000, width });
    await expect(panel).toBeVisible();
    // The map's markers sit closer than 24 px where real places do (WCAG
    // 2.5.8's map-pin exception), as in tracker.e2e.ts
    await auditPage(page, ".mapspan");
    // The plan never overflows its panel, and keeps its proportions
    const plan = await page.getByTestId("dark-room-plan").boundingBox();
    const box = await panel.boundingBox();
    expect(plan && box && plan.x + plan.width <= box.x + box.width + 1).toBe(
      true,
    );
    if (SHOTS) await panel.screenshot({ path: `${SHOTS}/panel-${width}.png` });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/page-${width}.png` });
  }

  // The Lamp found: the room goes, and the map is read no more
  bridge.memory[MEMORY_RANGE["equipment-b"].address + 6] = 1;
  await expect(panel).toBeHidden();
  const mapReads = reads("dark-room-map").length;
  await page.waitForTimeout(2500);
  expect(reads("dark-room-map").length).toBe(mapReads);
});

test("stays on the page through a menu and a text box, where the content does not jump", async ({
  page,
}) => {
  boot();
  await page.setViewportSize({ height: 900, width: 390 });
  await openTracker(page);
  await connect(page);
  const panel = page.getByTestId("dark-room");
  await expect(panel).toBeVisible();
  const before = await panel.boundingBox();
  const words = await page.getByTestId("dark-room-words").textContent();
  const mode = MEMORY_RANGE["dark-room-mode"].address;

  // The item menu opens (mode 0E), then a text box (0E, submode 02)
  bridge.memory[mode] = 0x0e;
  await page.waitForTimeout(1200);
  bridge.memory[mode + 1] = 0x02;
  await page.waitForTimeout(1200);
  await expect(panel).toBeVisible();
  expect(await panel.boundingBox()).toEqual(before);
  await expect(page.getByTestId("dark-room-words")).toHaveText(words ?? "");

  // Back in play, still there; the Lamp is what lets it go
  bridge.memory[mode] = 0x07;
  bridge.memory[mode + 1] = 0x00;
  await page.waitForTimeout(800);
  await expect(panel).toBeVisible();
  bridge.memory[MEMORY_RANGE["equipment-b"].address + 6] = 1;
  await expect(panel).toBeHidden();
});

test("is reachable and described from the Autotracking dialog", async ({
  page,
}) => {
  boot();
  await openTracker(page);
  await connect(page);
  await expect(page.getByTestId("dark-room")).toBeVisible();

  await clickToolbarAction(
    page,
    page.getByTestId("autotrack-button"),
    "toolbar-more-autotrack",
  );
  const box = dialog(page).getByRole("checkbox", { name: "Dark room map" });
  await expect(box).toBeChecked();
  await expect(box).toHaveAccessibleDescription(/Draws a dark room's walls/);
  await box.focus();
  await box.uncheck();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("dark-room")).toBeHidden();
  // Off, nothing of it is read any more
  const small = reads("dark-room-link").length;
  await page.waitForTimeout(1500);
  expect(reads("dark-room-link").length).toBe(small);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("alltp-tracker-autotrack") ?? "{}")
          .state?.darkRoomMap,
    ),
  ).toBe(false);
});

test("is never read in Race Mode, and never shown", async ({ page }) => {
  boot({ race: true });
  await openTracker(page);
  await connect(page);
  await page.waitForTimeout(2000);

  await expect(page.getByTestId("dark-room")).toBeHidden();
  for (const id of [
    "dark-room-map",
    "dark-room-link",
    "dark-room-room",
    "dark-room-dark",
  ] as const) {
    expect(reads(id), id).toEqual([]);
  }
});
