import { readFileSync } from "node:fs";
import {
  ALTTPR_RACE_PROFILE,
  CHECK_FLAGS,
  MEMORY_RANGE,
  MEMORY_RANGES,
  SEED_SETTINGS_RANGES,
} from "@alltp/pack-alttpr";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { FakeUsb2Snes } from "../../../packages/autotrack/test/fake-usb2snes";
import { comeOut, goIn, leadTo } from "../../../packs/alttpr/test/entrance-rom";
import { writeSeedSettings } from "../../../packs/alttpr/test/seed-rom";
import {
  clickToolbarAction,
  focusedTestId,
  focusRinged,
  tabTo,
  unreachableClickables,
  WCAG_AA,
  WIDTHS,
} from "./support";

// The browser connects to a fake usb2snes bridge (SNI on RetroArch) over a
// real WebSocket: the page at http://localhost reaches ws://localhost with no
// permission prompt. Its memory holds an alttpr.com seed in play, in the FX
// Pak Pro space the bridge takes: ROM from $00_0000 (LoROM, headerless), WRAM
// from $F5_0000.
const ROM_HEADER = 0x00_7fc0;
const RACE_FLAG = 0x18_0213;
const WRAM = 0xf5_0000;
const SAVE = (offset: number) => WRAM + 0xf000 + offset;

/** Writes a seed in play: a few items and checks, on the overworld. */
const bootSeed = (
  bridge: FakeUsb2Snes,
  { name, race }: { name?: string; race: boolean },
) => {
  const { memory } = bridge;
  const title = `VT ${name ?? (race ? "RACE" : "OPEN")}`.padEnd(21, " ");
  for (let i = 0; i < title.length; i++) {
    memory[ROM_HEADER + i] = title.charCodeAt(i);
  }
  // The race flag and its complement (vt app/Rom.php:908-920)
  memory.set(race ? [0x01, 0x00] : [0x00, 0x01], RACE_FLAG);
  memory[WRAM + 0x10] = 0x09; // game mode: the overworld
  memory[SAVE(0x342)] = 0x01; // Hookshot
  memory[SAVE(0x357)] = 0x01; // Moon Pearl
  memory[SAVE(0x359)] = 0x02; // Master Sword
  memory[SAVE(0x35c)] = 0x02; // one empty bottle: a HUD fact races forbid
  memory[SAVE(0x374)] = 0x04; // the Pendant of Courage: a prize, forbidden
  memory[SAVE(0x3c5)] = 0x02; // Zelda rescued
  memory[SAVE(0x208)] = 0x10; // Link's House chest (room $104)
  memory[SAVE(0x150)] = 0x10; // Eastern Palace's compass chest (room $A8)
  memory[SAVE(0x191)] = 0x08; // Armos Knights (room $C8, its boss bit)
};

/** Sets the flag that says a location was checked, as the game does. */
const checkIn = (bridge: FakeUsb2Snes, location: string) => {
  const entry = CHECK_FLAGS.find(({ id }) => id === location);
  if (entry === undefined || "atLeast" in entry.flag) {
    throw new Error(`No bit flag for ${location}`);
  }
  const { at, mask, range } = entry.flag;
  const address = MEMORY_RANGE[range].address + (at - MEMORY_RANGE[range].bus);
  bridge.memory[address] |= mask & 0xff;
  bridge.memory[address + 1] |= mask >> 8;
};

/** DungeonsCompleted's high byte: Eastern Palace's prize taken ($2000). */
const EASTERN_DONE = () => [SAVE(0x473), 0x20] as const;

const permittedCategory = (category: string) =>
  ALTTPR_RACE_PROFILE.categories[category]?.permitted === true;

const holds = (range: { address: number; size: number }, at: number) =>
  range.address <= at && at < range.address + range.size;

/**
 * The reads Race Mode forbids among those the bridge was sent: a byte
 * outside the memory the race specification permits, or inside a forbidden
 * range where no permitted range shares it (a boss room inside the dungeon
 * rooms is read for the boss).
 */
const forbiddenReads = (bridge: FakeUsb2Snes) =>
  bridge.reads.filter(([address, size]) => {
    for (let at = address; at < address + size; at++) {
      if (!ALTTPR_RACE_PROFILE.permitted.some((range) => holds(range, at))) {
        return true;
      }
      const inside = MEMORY_RANGES.filter((range) => holds(range, at));
      if (
        inside.length > 0 &&
        !inside.some((range) => permittedCategory(range.category))
      ) {
        return true;
      }
    }
    return false;
  });

let bridge: FakeUsb2Snes;
/** The port the bridge listens on: the page's `?bridge=`. */
let port: number;

test.beforeEach(async () => {
  bridge = await FakeUsb2Snes.start();
  port = Number(new URL(bridge.url).port);
});

test.afterEach(() => bridge.stop());

/** Load the tracker, pointed at the fake bridge, with nothing saved. */
const openTracker = async (page: Page) => {
  await page.goto(`./?bridge=${port}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
};

const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Autotracking" });

const openDialog = async (page: Page) => {
  await clickToolbarAction(
    page,
    page.getByTestId("autotrack-button"),
    "toolbar-more-autotrack",
  );
  await expect(dialog(page)).toBeVisible();
};

const STEPS = ["get-bridge", "run-bridge", "emulator", "permission", "game"];

/** Connect from the dialog, and close it once connected. */
const connect = async (page: Page) => {
  await openDialog(page);
  await dialog(page).getByTestId("autotrack-connect").click();
  await expect(dialog(page).getByTestId("autotrack-headline")).toHaveText(
    "Connected",
  );
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
};

/** An item cell's accessible name, for its state. */
const cell = (name: string, state: string) =>
  `${name}, ${state}. Click to change state.`;

test("marks the board and the map from the game as it changes", async ({
  page,
}) => {
  bootSeed(bridge, { race: false });
  const [at, bit] = EASTERN_DONE();
  bridge.memory[at] |= bit; // the Pendant of Courage, from Eastern Palace
  await openTracker(page);
  const hookshot = page.getByTestId("item-hookshot");
  await expect(hookshot).toHaveAccessibleName(cell("Hookshot", "not obtained"));

  await connect(page);

  await expect(hookshot).toHaveAccessibleName(cell("Hookshot", "obtained"));
  await expect(page.getByTestId("item-moonpearl")).toHaveAccessibleName(
    cell("Moon Pearl", "obtained"),
  );
  await expect(page.getByTestId("item-sword")).toHaveAccessibleName(
    cell("Sword", "level 2"),
  );
  await expect(page.getByTestId("item-boss0")).toHaveAccessibleName(
    "Armos Knights, defeated. Click to change state.",
  );
  await expect(page.getByTestId("reward-overlay-0")).toHaveAccessibleName(
    /reward: the Pendant of Courage/,
  );
  // Two of its three items found: the compass chest and the boss
  await expect(page.getByTestId("chest-overlay-0")).toHaveAccessibleName(
    /chests: 1 left/,
  );
  await expect(page.getByTestId("marker-links-house")).toHaveAccessibleName(
    "Link's House: done",
  );
  await expect(
    page.getByTestId("boss-marker-eastern-palace"),
  ).toHaveAccessibleName(/boss done/);

  // The game goes on: the hammer, then King's Tomb
  bridge.memory[SAVE(0x34b)] = 0x01;
  await expect(page.getByTestId("item-hammer")).toHaveAccessibleName(
    cell("Hammer", "obtained"),
  );
  const tomb = page.getByTestId("marker-kings-tomb");
  await expect(tomb).not.toHaveAccessibleName(/done/);
  checkIn(bridge, "kings-tomb");
  await expect(tomb).toHaveAccessibleName("King's Tomb: done");
  // None of it is a step of the player's undo history
  await expect(page.getByTestId("undo")).toBeDisabled();
});

test("notes the doors Link goes through in a Crosskeys run", async ({
  page,
}) => {
  bootSeed(bridge, { race: false });
  writeSeedSettings(bridge.memory, { dungeonItems: "full" });
  // The seed's ROM, then where Link is: in Blind's Hideout
  leadTo(bridge.memory, "Kakariko Shop", "Elder House Exit (East)");
  goIn(bridge.memory, "Light Hype Fairy", "Blinds Hideout");
  await openTracker(page);
  await page.getByRole("button", { name: /^Mode/ }).click();
  await page
    .getByRole("dialog", { name: "Choose a run type" })
    .getByRole("button", { name: /^Crosskeys/ })
    .click();
  await page.getByRole("button", { name: "Switch & reset" }).click();

  await connect(page);

  await expect(
    page.getByTestId("entrance-light-hype-fairy"),
  ).toHaveAccessibleName("Light Hype Fairy: leads to Blind's Hideout");
  // Link goes on, and comes out of Elder House's east side by Kakariko Shop
  comeOut(bridge.memory, "Kakariko Shop", "Elder House Exit (East)");
  await expect(page.getByTestId("entrance-kakariko-shop")).toHaveAccessibleName(
    "Kakariko Shop: leads to Elder House (East)",
  );
  await page.getByRole("tab", { name: "Entrances" }).click();
  await expect(page.getByTestId("entrances-summary")).toHaveText(
    "2 of 138 entrances noted",
  );
});

test("starts the run timer as the game starts, and stops it at the goal", async ({
  page,
}) => {
  bootSeed(bridge, { race: false });
  bridge.memory[WRAM + 0x10] = 0x01; // the file select
  // An hour of frames played, which the game counts itself
  const frames = Math.round(3600 * 60.0988);
  bridge.memory.set(
    [frames & 0xff, (frames >> 8) & 0xff, (frames >> 16) & 0xff, 0],
    SAVE(0x43e),
  );
  await openTracker(page);
  await connect(page);
  const timer = page.getByTestId("run-timer");
  await expect(timer).toHaveAccessibleName("Run timer: 0:00, not started");

  bridge.memory[WRAM + 0x10] = 0x07; // into the game
  await expect(timer).toHaveAccessibleName(/^Run timer: \d+:\d\d, running$/);
  await timer.click();
  await expect(page.getByTestId("run-timer-igt")).toHaveText(
    "In-game time: 1:00:00",
  );
  await page.keyboard.press("Escape");
  // The Run tab gives the ROM's own counts, as its end credits do
  bridge.memory[SAVE(0x449)] = 2; // DeathCounter
  await page.getByTestId("map-view-tab-run").click();
  const stats = page.getByTestId("run-rom-stats");
  await expect(stats.getByText("Deaths").locator("..")).toHaveText("Deaths2");
  await expect(stats.getByText("Play time").locator("..")).toHaveText(
    "Play time1:00:00",
  );

  bridge.memory[WRAM + 0x10] = 0x19; // the Triforce room
  await expect(timer).toHaveAccessibleName(
    /^Run timer: [\d:]+, stopped at the goal$/,
  );
  await expect(page.getByTestId("run-timer-status")).toHaveText(
    /^Run timer stopped at the goal: /,
  );
});

test("keeps the player's marks beyond the game until Sync from game", async ({
  page,
}) => {
  bootSeed(bridge, { race: false });
  await openTracker(page);
  await connect(page);
  const sword = page.getByTestId("item-sword");
  await expect(sword).toHaveAccessibleName(cell("Sword", "level 2"));

  // The Tempered Sword, marked by hand ahead of the game
  await sword.click();
  await expect(sword).toHaveAccessibleName(cell("Sword", "level 3"));
  // The game goes on: the hammer comes, the mark stays
  bridge.memory[SAVE(0x34b)] = 0x01;
  await expect(page.getByTestId("item-hammer")).toHaveAccessibleName(
    cell("Hammer", "obtained"),
  );
  await expect(sword).toHaveAccessibleName(cell("Sword", "level 3"));

  await openDialog(page);
  await dialog(page).getByTestId("autotrack-sync").click();
  await expect(dialog(page).getByTestId("autotrack-sync-status")).toHaveText(
    "1 mark set to the game's. Undo takes it back.",
  );
  await page.keyboard.press("Escape");
  await expect(sword).toHaveAccessibleName(cell("Sword", "level 2"));

  // Undo takes the sync back; the game's hammer stays
  await page.getByTestId("undo").click();
  await expect(sword).toHaveAccessibleName(cell("Sword", "level 3"));
  await expect(page.getByTestId("item-hammer")).toHaveAccessibleName(
    cell("Hammer", "obtained"),
  );
});

test("undoes the player's own change, never the game's", async ({ page }) => {
  bootSeed(bridge, { race: false });
  await openTracker(page);
  await connect(page);
  const net = page.getByTestId("item-net");
  const hammer = page.getByTestId("item-hammer");

  await net.click();
  await expect(net).toHaveAccessibleName(cell("Bug Net", "obtained"));
  bridge.memory[SAVE(0x34b)] = 0x01; // the game: the hammer
  await expect(hammer).toHaveAccessibleName(cell("Hammer", "obtained"));

  await page.getByTestId("undo").click();

  await expect(net).toHaveAccessibleName(cell("Bug Net", "not obtained"));
  await expect(hammer).toHaveAccessibleName(cell("Hammer", "obtained"));
  await expect(page.getByTestId("undo")).toBeDisabled();
  await page.getByTestId("redo").click();
  await expect(net).toHaveAccessibleName(cell("Bug Net", "obtained"));
  await expect(hammer).toHaveAccessibleName(cell("Hammer", "obtained"));
});

test("a race seed leaves pendants, crystals and dungeon chests to the player", async ({
  page,
}) => {
  bootSeed(bridge, { race: true });
  const [at, bit] = EASTERN_DONE();
  bridge.memory[at] |= bit;
  await openTracker(page);
  // Marked by hand: Eastern Palace's prize a crystal, its chests all found
  const reward = page.getByTestId("reward-overlay-0");
  const chests = page.getByTestId("chest-overlay-0");
  for (let click = 0; click < 3; click++) await reward.click();
  for (let click = 0; click < 3; click++) await chests.click();
  await expect(reward).toHaveAccessibleName(/reward: a crystal$/);
  await expect(chests).toHaveAccessibleName(/chests: 0 left$/);

  await connect(page);

  // What races permit comes in: items, bosses, checks outside dungeons
  await expect(page.getByTestId("item-hookshot")).toHaveAccessibleName(
    cell("Hookshot", "obtained"),
  );
  await expect(page.getByTestId("item-boss0")).toHaveAccessibleName(/defeated/);
  await expect(page.getByTestId("marker-links-house")).toHaveAccessibleName(
    "Link's House: done",
  );
  // What they forbid stays as the player marked it, Sync included
  await openDialog(page);
  await expect(dialog(page).getByTestId("autotrack-follow")).toContainText(
    "pendants and crystals, chests inside dungeons, bottles",
  );
  await dialog(page).getByTestId("autotrack-sync").click();
  await expect(dialog(page).getByTestId("autotrack-sync-status")).toHaveText(
    "The board already matches the game.",
  );
  await page.keyboard.press("Escape");
  await expect(reward).toHaveAccessibleName(/reward: a crystal$/);
  await expect(chests).toHaveAccessibleName(/chests: 0 left$/);
  await expect(page.getByTestId("item-bottle")).toHaveAccessibleName(
    cell("Bottle", "not obtained"),
  );
  await expect.poll(() => bridge.reads.length).toBeGreaterThan(30);
  expect(forbiddenReads(bridge)).toEqual([]);
});

test("one tab of the tracker reads the game; another waits, then takes over", async ({
  page,
}) => {
  bootSeed(bridge, { race: false });
  await openTracker(page);
  await connect(page);
  const second = await page.context().newPage();

  // The second tab connects on start, as the first one asked
  await second.goto(`./?bridge=${port}`);
  await expect(second.getByTestId("autotrack-live")).toHaveText(
    "Autotracking: Running in another tab",
  );
  // It follows the board through storage, and never reaches the bridge
  await expect(second.getByTestId("item-hookshot")).toHaveAccessibleName(
    cell("Hookshot", "obtained"),
  );
  bridge.memory[SAVE(0x34b)] = 0x01;
  await expect(second.getByTestId("item-hammer")).toHaveAccessibleName(
    cell("Hammer", "obtained"),
  );
  expect(bridge.accepted).toBe(1);

  await page.close();

  await expect(second.getByTestId("autotrack-live")).toHaveText(
    "Autotracking: Connected",
  );
  expect(bridge.accepted).toBe(2);
  // And it lays the game on the board from now on
  bridge.memory[SAVE(0x345)] = 0x01; // the Fire Rod
  await expect(second.getByTestId("item-firerod")).toHaveAccessibleName(
    cell("Fire Rod", "obtained"),
  );
});

test("connects through the dialog, ticks every step and lists what it read", async ({
  page,
}) => {
  bootSeed(bridge, { race: false });
  await openTracker(page);
  await openDialog(page);
  const shown = dialog(page);
  await expect(shown.getByTestId("autotrack-headline")).toHaveText("Off");
  // Nothing connects before the player asks
  expect(bridge.accepted).toBe(0);
  await expect(shown.getByTestId("setup-toggle-get-bridge")).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  await shown.getByTestId("autotrack-connect").click();

  await expect(shown.getByTestId("autotrack-headline")).toHaveText("Connected");
  for (const step of STEPS) {
    await expect(shown.getByTestId(`setup-step-${step}`)).toHaveAttribute(
      "data-state",
      "done",
    );
  }
  await expect(shown.getByTestId("setup-count")).toHaveText(
    "5 of 5 steps done",
  );
  await expect(shown.getByTestId("race-mode")).toHaveText(
    "Race Mode is off: this seed is not a race seed.",
  );
  await expect(page.getByTestId("race-badge")).toHaveCount(0);

  const items = shown.getByTestId("readout-items");
  for (const item of ["Hookshot", "Moon Pearl", "Master Sword", "Bottle ×1"]) {
    await expect(items.getByText(item, { exact: true })).toBeVisible();
  }
  await expect(shown.getByTestId("readout-prizes")).toHaveText(
    /Pendant of Courage/,
  );
  await expect(shown.getByTestId("readout-bosses")).toHaveText(
    /Eastern Palace/,
  );
  const checked = shown.getByTestId("readout-checked");
  await expect(checked).toContainText("Locations checked (4)");
  await expect(checked).toContainText("Link's House");
  await expect(checked).toContainText("Compass Chest, Boss");

  // One connection, kept: the session polls over it
  await expect.poll(() => bridge.opcodes().length).toBeGreaterThan(12);
  expect(bridge.accepted).toBe(1);
  await page.keyboard.press("Escape");
  const button = page.getByTestId("autotrack-button");
  await expect(button).toHaveAccessibleName(/Connected/);
  await expect(button.getByTestId("autotrack-dot")).toHaveAttribute(
    "data-phase",
    "on",
  );
});

test("a race seed shows the race-legal badge and is never read where races forbid", async ({
  page,
}) => {
  bootSeed(bridge, { race: true });
  await openTracker(page);
  await openDialog(page);
  await dialog(page).getByTestId("autotrack-connect").click();

  const shown = dialog(page);
  await expect(shown.getByTestId("autotrack-headline")).toHaveText("Connected");
  await expect(shown.getByTestId("race-badge")).toBeVisible();
  await expect(shown.getByTestId("race-mode")).toHaveText(
    "This is a race seed: the tracker reads only what races permit.",
  );
  await expect(shown.getByTestId("readout-items")).toContainText("Hookshot");
  // What races forbid is neither read nor shown
  await expect(shown.getByTestId("readout-prizes")).toHaveText(
    /Not read in Race Mode/,
  );
  await expect(shown.getByTestId("readout-items")).not.toContainText("Bottle");
  const withheld = shown.getByTestId("readout-race-mode");
  for (const fact of ["Pendants and crystals", "Bottles", "Checks inside"]) {
    await expect(withheld).toContainText(fact);
  }
  await expect(shown.getByTestId("readout-checked")).toContainText(
    "Locations checked (1)",
  );

  // Many polls later, still nothing forbidden asked for
  await expect.poll(() => bridge.reads.length).toBeGreaterThan(30);
  expect(forbiddenReads(bridge)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(
    page.getByTestId("autotrack-button").getByTestId("race-badge"),
  ).toBeVisible();
  // Nor are the ROM's own counts, which races forbid
  await page.getByTestId("map-view-tab-run").click();
  await expect(page.getByTestId("run-rom-stats")).toContainText(
    "Not read in races",
  );
});

test("Race Mode set always on reads a seed without the race flag as a race seed", async ({
  page,
}) => {
  bootSeed(bridge, { race: false });
  await openTracker(page);
  await openDialog(page);
  const shown = dialog(page);
  const always = shown
    .getByRole("group", { name: "Race Mode" })
    .getByRole("radio", { name: "Always on" });
  await always.check();
  await shown.getByTestId("autotrack-connect").click();

  await expect(shown.getByTestId("autotrack-headline")).toHaveText("Connected");
  await expect(shown.getByTestId("race-badge")).toHaveText(
    "Race-legal Always on",
  );
  await expect(shown.getByTestId("race-mode")).toHaveText(
    "Race Mode is always on, as you set it: the tracker reads only what races permit.",
  );
  await expect(shown.getByTestId("readout-prizes")).toHaveText(
    /Not read in Race Mode/,
  );
  await expect.poll(() => bridge.reads.length).toBeGreaterThan(30);
  expect(forbiddenReads(bridge)).toEqual([]);

  // Back to the ROM's flag, mid-session: the seed is read as it is
  await shown
    .getByRole("radio", { name: "Auto (the ROM's race flag)" })
    .check();
  await expect(shown.getByTestId("race-badge")).toHaveCount(0);
  await expect(shown.getByTestId("readout-prizes")).toHaveText(
    /Pendant of Courage/,
  );
  // The choice is the device's: a reload keeps it
  await always.check();
  await page.reload();
  await openDialog(page);
  await expect(
    dialog(page).getByRole("radio", { name: "Always on" }),
  ).toBeChecked();
});

test("losing the bridge says so without a dialog, then reconnects on its own", async ({
  page,
}) => {
  // A player who allowed the connection: the session then retries on its own
  // (while Chromium's permission is undecided, it waits for a click instead)
  await page.addInitScript(() => {
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (descriptor) =>
      (descriptor.name as string) === "loopback-network"
        ? Promise.resolve({ onchange: null, state: "granted" } as never)
        : query(descriptor);
  });
  bootSeed(bridge, { race: true });
  await openTracker(page);
  await openDialog(page);
  await dialog(page).getByTestId("autotrack-connect").click();
  await expect(dialog(page).getByTestId("autotrack-headline")).toHaveText(
    "Connected",
  );
  await page.keyboard.press("Escape");
  const dot = page.getByTestId("autotrack-button").getByTestId("autotrack-dot");
  const live = page.getByTestId("autotrack-live");
  await expect(live).toHaveText("Autotracking: Connected");
  // A connection that has lived 5 s is retried at once when it drops
  await page.waitForTimeout(5_500);

  await bridge.stop();

  await expect(dot).toHaveAttribute("data-phase", "problem");
  await expect(live).toHaveText(
    "Autotracking: SNI isn't running, or the browser is blocking it",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("autotrack-button")).toHaveAccessibleName(
    /SNI isn't running, or the browser is blocking it/,
  );

  bridge = await FakeUsb2Snes.start({ port });
  bootSeed(bridge, { race: true });

  await expect(dot).toHaveAttribute("data-phase", "on", { timeout: 15_000 });
  await expect(live).toHaveText("Autotracking: Connected");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => bridge.reads.length).toBeGreaterThan(10);
  expect(forbiddenReads(bridge)).toEqual([]);
});

test("reconnects on the next visit until the player disconnects", async ({
  page,
}) => {
  bootSeed(bridge, { race: false });
  await openTracker(page);
  await openDialog(page);
  await dialog(page).getByTestId("autotrack-connect").click();
  await expect(dialog(page).getByTestId("autotrack-headline")).toHaveText(
    "Connected",
  );

  await page.reload();
  const dot = page.getByTestId("autotrack-button").getByTestId("autotrack-dot");
  await expect(dot).toHaveAttribute("data-phase", "on");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await openDialog(page);
  await dialog(page).getByTestId("autotrack-disconnect").click();
  await expect(dialog(page).getByTestId("autotrack-headline")).toHaveText(
    "Off",
  );
  await expect.poll(() => bridge.connections).toBe(0);
  const accepted = bridge.accepted;
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await expect(dot).toHaveAttribute("data-phase", "off");
  expect(bridge.accepted).toBe(accepted);
});

test("the stream view never connects, even when the tracker does", async ({
  page,
}) => {
  bootSeed(bridge, { race: false });
  await openTracker(page);
  await openDialog(page);
  await dialog(page).getByTestId("autotrack-connect").click();
  await expect(dialog(page).getByTestId("autotrack-headline")).toHaveText(
    "Connected",
  );
  const stream = await page.context().newPage();
  await stream.goto(`./?view=obs&bridge=${port}`);
  await expect(stream.getByTestId("obs-view")).toBeVisible();
  // It shows what the tracker read, and follows it as the game goes on
  await expect(stream.getByTestId("item-hookshot")).toHaveAccessibleName(
    cell("Hookshot", "obtained"),
  );
  bridge.memory[SAVE(0x34b)] = 0x01; // the hammer
  await expect(stream.getByTestId("item-hammer")).toHaveAccessibleName(
    cell("Hammer", "obtained"),
  );
  // The tracker's session is the bridge's only client
  await stream.waitForTimeout(1_000);
  expect(bridge.accepted).toBe(1);
  expect(bridge.connections).toBe(1);
});

test.describe("the seed's run type", () => {
  /** A keysanity seed: every dungeon item outside its dungeon. */
  const bootKeysanity = ({ race = false } = {}) => {
    bootSeed(bridge, { race });
    writeSeedSettings(bridge.memory, { dungeonItems: "full" });
  };

  const mode = (page: Page) => page.getByRole("button", { name: /^Mode/ });

  test("switches a fresh board to it, and says so", async ({ page }) => {
    bootKeysanity();
    await openTracker(page);
    await expect(mode(page)).toHaveAccessibleName("Mode Open");

    await connect(page);

    await expect(mode(page)).toHaveAccessibleName("Mode Keysanity");
    await expect(page.getByTestId("item-hookshot")).toHaveAccessibleName(
      cell("Hookshot", "obtained"),
    );
    await expect(page.getByTestId("autotrack-live")).toContainText(
      "This seed is Keysanity (Open, Ganon, 7/7): the tracker switched to it.",
    );
    await expect(page.getByTestId("seed-prompt")).toBeEmpty();
    await openDialog(page);
    await expect(dialog(page).getByTestId("autotrack-seed")).toHaveText(
      "The run type matches this seed: Keysanity (Open, Ganon, 7/7).",
    );
    await expect(dialog(page).getByTestId("readout-seed")).toContainText(
      "maps, compasses, small keys, big keys",
    );
  });

  test("asks before switching a run, and one undo takes the switch back", async ({
    page,
  }) => {
    bootKeysanity();
    await openTracker(page);
    await page.getByTestId("item-flute").click();

    await connect(page);

    const prompt = page.getByTestId("seed-prompt");
    await expect(prompt).toContainText(
      "This seed is Keysanity (Open, Ganon, 7/7). The tracker is set to Open. Switch?",
    );
    await expect(mode(page)).toHaveAccessibleName("Mode Open");
    const { violations } = await new AxeBuilder({ page })
      .include('[data-testid="seed-prompt"]')
      .withTags(WCAG_AA)
      .analyze();
    expect(violations.map(({ id }) => id)).toEqual([]);

    await page.getByTestId("seed-switch").click();

    await expect(mode(page)).toHaveAccessibleName("Mode Keysanity");
    await expect(prompt).toBeEmpty();
    await expect(page.getByTestId("item-flute")).toHaveAccessibleName(
      cell("Flute", "not obtained"),
    );
    await page.getByTestId("undo").click();
    await expect(mode(page)).toHaveAccessibleName("Mode Open");
    await expect(page.getByTestId("item-flute")).toHaveAccessibleName(
      cell("Flute", "obtained"),
    );
  });

  test("keeps the player's run type for the seed, after a reload too", async ({
    page,
  }) => {
    bootKeysanity();
    await openTracker(page);
    await page.getByTestId("item-flute").click();
    await connect(page);

    await page.getByTestId("seed-keep").click();
    await expect(page.getByTestId("seed-prompt")).toBeEmpty();
    await page.reload();

    // It connects again on its own, and asks nothing
    await openDialog(page);
    await expect(dialog(page).getByTestId("autotrack-seed")).toHaveText(
      "This seed is Keysanity (Open, Ganon, 7/7). You kept Open.",
    );
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("seed-prompt")).toBeEmpty();
    await expect(mode(page)).toHaveAccessibleName("Mode Open");
  });

  test("reads only the seed type of a race seed: the run type stays the player's", async ({
    page,
  }) => {
    bootKeysanity({ race: true });
    await openTracker(page);

    await connect(page);
    await openDialog(page);

    await expect(dialog(page).getByTestId("autotrack-seed")).toHaveText(
      "Settings not read in Race Mode, nor asked of alttpr.com: pick the run type yourself.",
    );
    await expect(mode(page)).toHaveAccessibleName("Mode Open");
    const settingsRead = SEED_SETTINGS_RANGES.filter((range) =>
      bridge.reads.some(
        ([address, size]) =>
          address < range.address + range.size &&
          range.address < address + size,
      ),
    ).map((range) => range.id);
    expect(settingsRead).toEqual(["seed-type"]);
    expect(forbiddenReads(bridge)).toEqual([]);
  });

  test("never asks alttpr.com for a race seed's file: the run type stays the player's", async ({
    page,
  }) => {
    const asked: string[] = [];
    await page.route(
      "https://alttpr-patch-data.s3.us-east-2.amazonaws.com/*",
      (route) => {
        asked.push(route.request().url());
        return route.fulfill({
          body: readFileSync(
            new URL(
              "../../../packs/alttpr/test/seed-files/eM43RgZ4Gj.json",
              import.meta.url,
            ),
            "utf8",
          ),
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      },
    );
    bootSeed(bridge, { name: "eM43RgZ4Gj", race: true });
    await openTracker(page);

    await connect(page);

    await openDialog(page);
    await expect(dialog(page).getByTestId("autotrack-seed")).toHaveText(
      "Settings not read in Race Mode, nor asked of alttpr.com: pick the run type yourself.",
    );
    await expect(
      dialog(page).getByRole("heading", { exact: true, name: "Seed settings" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(mode(page)).toHaveAccessibleName("Mode Open");
    // Nor does Start from a seed while the race goes on
    await mode(page).click();
    await expect(page.getByTestId("seed-import-race")).toContainText(
      "Off in Race Mode",
    );
    await expect(page.getByTestId("seed-import-input")).toHaveCount(0);
    await expect.poll(() => bridge.reads.length).toBeGreaterThan(30);
    expect(asked).toEqual([]);
    expect(forbiddenReads(bridge)).toEqual([]);
  });
});

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    const phone = width < 600;
    test.use({
      hasTouch: phone,
      isMobile: phone,
      viewport: { height: phone ? 844 : 900, width },
    });

    test("is set up and connected from the keyboard alone, passing axe", async ({
      page,
    }) => {
      bootSeed(bridge, { race: true });
      await openTracker(page);

      // The toolbar's control, or the More menu's first item once folded
      if (await page.getByTestId("autotrack-button").isVisible()) {
        await tabTo(page, "autotrack-button");
      } else {
        await tabTo(page, "toolbar-more");
        await page.keyboard.press("Enter");
        expect(await focusedTestId(page)).toBe("toolbar-more-autotrack");
      }
      expect(await focusRinged(page)).toBe(true);
      await page.keyboard.press("Enter");
      await expect(dialog(page)).toBeVisible();
      expect(await focusedTestId(page)).toBe("autotrack-connect");
      await page.keyboard.press("Enter");
      await expect(dialog(page).getByTestId("autotrack-headline")).toHaveText(
        "Connected",
      );
      // Focus stays on the button, now Disconnect
      expect(await focusedTestId(page)).toBe("autotrack-disconnect");

      // Race Mode: Tab reaches the choice made, an arrow key makes another
      await tabTo(page, "race-option-auto", 20);
      expect(await focusRinged(page)).toBe(true);
      await page.keyboard.press("ArrowRight");
      expect(await focusedTestId(page)).toBe("race-option-on");
      await expect(page.getByTestId("race-option-on")).toBeChecked();
      await expect(dialog(page).getByTestId("race-badge")).toHaveText(
        "Race-legal Always on",
      );

      // The system tabs: Tab reaches the selected one (the system detected),
      // the arrow keys and Home and End select another
      const selected = await page
        .getByTestId("setup-tabs")
        .getByRole("tab", { selected: true })
        .getAttribute("data-testid");
      await tabTo(page, selected ?? "", 20);
      await page.keyboard.press("End");
      expect(await focusedTestId(page)).toBe("setup-tab-linux");
      expect(await focusRinged(page)).toBe(true);
      await expect(page.getByTestId("setup-tab-linux")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      // A step opens from the keyboard, with the Linux instructions
      await tabTo(page, "setup-toggle-run-bridge", 20);
      expect(await focusRinged(page)).toBe(true);
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("setup-step-run-bridge")).toContainText(
        "./sni",
      );

      // Colours as they settle: Connect turned Disconnect mid-transition
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) animation.finish();
      });
      const { violations } = await new AxeBuilder({ page })
        .include("dialog[open]")
        .withTags(WCAG_AA)
        .analyze();
      expect(
        violations.map(({ id, nodes }) => `${id} ×${nodes.length}`),
      ).toEqual([]);
      expect(await unreachableClickables(page, "dialog[open]")).toEqual([]);
      // The dialog fits the screen
      const box = await dialog(page).boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);

      await page.keyboard.press("Escape");
      await expect(dialog(page)).toBeHidden();
      // The toolbar, with its dot and badge, passes too
      const toolbar = await new AxeBuilder({ page })
        .include('[data-testid="toolbar"]')
        .withTags(WCAG_AA)
        .analyze();
      expect(
        toolbar.violations.map(({ id, nodes }) => `${id} ×${nodes.length}`),
      ).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}
