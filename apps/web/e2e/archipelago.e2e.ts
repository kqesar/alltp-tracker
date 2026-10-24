import { expect, type Page, test } from "@playwright/test";
import { FakeApServer } from "../../../packages/archipelago/test/fake-ap-server";
import { fixture } from "../../../packages/archipelago/test/fixtures";
import { auditDialog, auditPage, openOnGame, tabTo, WIDTHS } from "./support";

/** Where to keep the screenshots for a look by eye, when asked. */
const SHOTS = process.env.AP_SHOTS;

/** An AP 0.6.8 room replaying the bench's tracker on Link (ALttP). */
const startRoom = (options: { refuse?: string[] } = {}) =>
  FakeApServer.start({
    client: "tracker",
    fixture: fixture("normal-session"),
    ...options,
  });

/** The room dialog, open: it opens on its own while no room is set. */
const roomDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Archipelago room" });

/** Type the room and the slot, then Connect. */
const connectTo = async (page: Page, room: FakeApServer, slot = "Link") => {
  const dialog = roomDialog(page);
  await dialog.getByTestId("ap-room-input").fill(room.url);
  await dialog.getByTestId("ap-slot-input").fill(slot);
  await dialog.getByTestId("ap-connect").click();
};

/** Every transition done (a tab's colours): axe reads settled colours only. */
const settled = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().length === 0);

/** What the server said after the login, as the recorded session goes on. */
const playOn = (room: FakeApServer) =>
  room.push(room.responders[0]?.later() ?? []);

test("connects to a room and shows the slot's items and checks", async ({
  page,
}) => {
  const room = await startRoom();
  try {
    await openOnGame(page, "archipelago");
    // No room yet: the dialog opened on its own, the Room field first
    const dialog = roomDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("ap-room-input")).toBeFocused();
    await expect(
      dialog.getByTestId("ap-room-input"),
    ).toHaveAccessibleDescription(/archipelago\.gg:38281/);
    await connectTo(page, room);
    await expect(dialog.getByTestId("ap-connect-headline")).toHaveText(
      "Connected",
    );
    await expect(dialog.getByTestId("ap-step-slot")).toHaveAttribute(
      "data-state",
      "done",
    );
    await page.keyboard.press("Escape");

    // The room line: the slot, its game and team, never the address
    await expect(page.getByTestId("ap-room-slot")).toHaveText(
      "Link · A Link to the Past · Team 1",
    );
    await expect(page.getByTestId("ap-room-players")).toHaveText("4 players");
    await expect(page.getByTestId("ap-room-status")).toHaveText("Connected");
    await expect(page.getByTestId("ap-room")).not.toContainText(
      String(room.port),
    );
    await expect(page.getByTestId("ap-checks-left")).toHaveText(
      "249 left / 249",
    );

    // The game goes on: items arrive, locations are checked
    playOn(room);
    await expect(page.getByTestId("ap-item-keys-ip")).toContainText(
      "Ice Palace: big key not received, 1 small key",
    );
    await expect(page.getByTestId("ap-item-hookshot")).toHaveText(
      "Hookshot, not received",
    );
    await expect(
      page.getByTestId("ap-item-list").getByTestId("ap-list-item"),
    ).toHaveText(["Piece of Heart×, 2", "Bombs (3)"]);
    await expect(page.getByTestId("ap-checks-left")).not.toHaveText(
      "249 left / 249",
    );
    await expect(page.getByTestId("ap-checks")).toContainText(
      "It does not say what you can reach.",
    );
    // The feed: the lines involving the slot, newest first; then the room's
    const lines = page.getByTestId("ap-feed-line");
    await expect(lines.first()).toHaveText(
      "Quester released 4 items, 2 for you",
    );
    await expect(lines).toHaveCount(9);
    await expect(page.getByRole("log", { name: "Feed" })).toHaveAttribute(
      "aria-live",
      "off",
    );
    await page.getByTestId("ap-feed-scope-room").check();
    await expect(lines).toHaveCount(14);
    await expect(lines.first()).toHaveText("Left: Quester, Link");
    await page.getByTestId("ap-feed-scope-mine").check();
    // What the checked locations held: other games' names, loaded lazily
    await page.getByTestId("ap-checks-filter").fill("Old Man");
    await expect(page.getByTestId("ap-check-held")).toHaveText(
      ", held ETank for Hybrid Hero",
    );
    await page.getByTestId("ap-checks-filter").fill("");
    // The hints, two lists, statuses in words
    await page.getByTestId("ap-side-tab-hints").click();
    await expect(page.getByTestId("ap-hint-points")).toHaveText(
      "4 hint points · a hint costs 24",
    );
    await expect(page.getByTestId("ap-hint")).toHaveText([
      "FoundPiece of Heart at Bottom Left Chest in Quester's world",
      "UnspecifiedFirerod for Hybrid Hero at Swamp Palace - Waterway Pot Key",
    ]);
    // The players, and where each game stands
    await page.getByTestId("ap-side-tab-players").click();
    await expect(page.getByTestId("ap-player-4")).toContainText("Goal");
    await page.getByTestId("ap-side-tab-checks").click();
    // The room's countdown (2 s, then GO) started the run timer
    await expect(page.getByTestId("run-timer")).toHaveAccessibleName(
      /running$/,
    );
    // Link's own client status reaching its goal (30) stops it there
    room.push([
      [
        {
          cmd: "SetReply",
          key: "_read_client_status_0_1",
          original_value: 20,
          slot: 1,
          value: 30,
        },
      ],
    ]);
    await expect(page.getByTestId("run-timer")).toHaveAccessibleName(
      /stopped at the goal$/,
    );
    const stopped = await page
      .getByTestId("run-timer")
      .getAttribute("aria-label");
    // Location names, by the world's groups, filtered
    const filter = page.getByTestId("ap-checks-filter");
    await filter.fill("Ice Palace");
    await expect(page.getByTestId("ap-checks")).toContainText(
      "Ice Palace - Big Key Chest",
    );
    await page.getByTestId("ap-checks-hide").check();

    // A reload draws the saved run at once, then connects again
    await page.reload();
    await expect(page.getByTestId("ap-room-slot")).toHaveText(
      "Link · A Link to the Past · Team 1",
    );
    await expect(roomDialog(page)).toHaveCount(0);
    await expect(page.getByTestId("ap-room-status")).toHaveText("Connected");
    await expect(page.getByTestId("ap-checks-hide")).toBeChecked();
    // The run's time at the goal, as it was: saved with the run
    await expect(page.getByTestId("run-timer")).toHaveAttribute(
      "aria-label",
      stopped ?? "",
    );

    // Nothing a tracker may not send ever left the page
    const sent = new Set(room.received.map((packet) => packet.cmd));
    expect([...sent].sort()).toEqual(
      [
        "Connect",
        "Get",
        "GetDataPackage",
        "LocationScouts",
        "SetNotify",
        "Sync",
      ].filter((cmd) => sent.has(cmd)),
    );
    expect(sent.has("Connect")).toBe(true);
    // The address, port and password stay out of the run others read
    const run = await page.evaluate(() =>
      localStorage.getItem("alltp-tracker-archipelago"),
    );
    expect(run).not.toContain(String(room.port));
    expect(run).not.toContain("127.0.0.1");
  } finally {
    await room.close();
  }
});

test("says why the room refused the slot, and waits for the player", async ({
  page,
}) => {
  const room = await startRoom({ refuse: ["InvalidSlot"] });
  try {
    await openOnGame(page, "archipelago");
    await connectTo(page, room, "link");
    const dialog = roomDialog(page);
    await expect(dialog.getByTestId("ap-connect-headline")).toHaveText(
      "Refused by the room",
    );
    await expect(dialog.getByTestId("ap-connect-detail")).toContainText(
      "case-sensitive",
    );
    await expect(dialog.getByTestId("ap-step-slot")).toHaveAttribute(
      "data-state",
      "failing",
    );
    await expect(dialog.getByTestId("ap-retry")).toHaveCount(0);
    const connects = room.received.filter((p) => p.cmd === "Connect").length;
    await page.waitForTimeout(1500);
    expect(room.received.filter((p) => p.cmd === "Connect")).toHaveLength(
      connects,
    );
  } finally {
    await room.close();
  }
});

test("refuses a ws:// room on the internet from a secure page before any socket", async ({
  page,
}) => {
  await openOnGame(page, "archipelago");
  const dialog = roomDialog(page);
  // The site is http here: only the format is checked before a socket
  await dialog.getByTestId("ap-room-input").fill("https://example.com/room/x");
  await dialog.getByTestId("ap-slot-input").fill("Link");
  await dialog.getByTestId("ap-connect").click();
  const error = dialog.getByTestId("ap-room-error");
  await expect(error).toContainText("archipelago.gg link");
  await expect(dialog.getByTestId("ap-room-input")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(dialog.getByTestId("ap-room-input")).toHaveAccessibleDescription(
    /archipelago\.gg link/,
  );
});

test("reconnects on its own when the connection drops", async ({ page }) => {
  const room = await startRoom();
  try {
    await openOnGame(page, "archipelago");
    await connectTo(page, room);
    await expect(
      roomDialog(page).getByTestId("ap-connect-headline"),
    ).toHaveText("Connected");
    await page.keyboard.press("Escape");
    room.drop();
    await expect(page.getByTestId("ap-room-status")).toHaveText(
      "Reconnecting…",
    );
    await expect(page.getByTestId("ap-room-status")).toHaveText("Connected", {
      timeout: 10_000,
    });
    expect(room.responders).toHaveLength(2);
  } finally {
    await room.close();
  }
});

test("says what arrived while the connection was down, with sender and location", async ({
  page,
}) => {
  const room = await startRoom();
  try {
    await openOnGame(page, "archipelago");
    await connectTo(page, room);
    await expect(
      roomDialog(page).getByTestId("ap-connect-headline"),
    ).toHaveText("Connected");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("ap-room-slot")).toHaveText(
      "Link · A Link to the Past · Team 1",
    );
    // The game goes on while the board is cut off: the room resends five items
    room.replayAs("tracker-refresh");
    room.drop();
    await expect(page.getByTestId("ap-room-status")).toHaveText("Connected", {
      timeout: 10_000,
    });
    const away = page.getByTestId("ap-away");
    await expect(away).toContainText("While you were away: 5 items");
    await expect(away).toContainText(
      "Piece of Heart from Quester (Bottom Left Chest)",
    );
    await expect(away).toContainText(
      "Small Key (Ice Palace) from your world (Ice Palace - Jelly Key Drop)",
    );
    if (SHOTS) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ height: 900, width });
        await page.screenshot({ path: `${SHOTS}/away-${width}.png` });
      }
    }
    await page.getByTestId("ap-away-dismiss").click();
    await expect(away).toHaveCount(0);
  } finally {
    await room.close();
  }
});

test("one tab connects; another follows it and takes over when it closes", async ({
  context,
  page,
}) => {
  const room = await startRoom();
  try {
    await openOnGame(page, "archipelago");
    await connectTo(page, room);
    await expect(page.getByTestId("ap-room-status")).toHaveText("Connected");
    await page.keyboard.press("Escape");

    const second = await context.newPage();
    await openOnGame(second, "archipelago");
    await expect(second.getByTestId("ap-room-status")).toHaveText(
      "Connected in another tab",
    );
    await expect(second.getByTestId("ap-room-slot")).toHaveText(
      "Link · A Link to the Past · Team 1",
    );
    expect(room.connections).toBe(1);
    // The first tab's run reaches the second through storage
    playOn(room);
    await expect(second.getByTestId("ap-item-keys-tr")).toContainText(
      "1 small key",
    );

    await page.close();
    await expect(second.getByTestId("ap-room-status")).toHaveText("Connected");
    await expect.poll(() => room.responders.length).toBe(2);
  } finally {
    await room.close();
  }
});

test("the stream view shows the grid and nothing of where the room is", async ({
  context,
  page,
}) => {
  const room = await startRoom();
  try {
    await openOnGame(page, "archipelago");
    await connectTo(page, room);
    await expect(page.getByTestId("ap-room-status")).toHaveText("Connected");
    playOn(room);
    await expect(page.getByTestId("ap-item-keys-ip")).toContainText(
      "1 small key",
    );

    const stream = await context.newPage();
    await stream.goto("./?view=obs");
    await expect(stream.getByTestId("obs-view")).toBeVisible();
    await expect(stream.getByTestId("ap-item-keys-ip")).toContainText(
      "1 small key",
    );
    const text = await stream.locator("body").innerText();
    expect(text).not.toContain(String(room.port));
    expect(
      await stream.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      ),
    ).toBe("rgba(0, 0, 0, 0)");
    // No feed unless asked
    await expect(stream.getByTestId("ap-obs-feed")).toHaveCount(0);
    // The stream view never connects
    await stream.waitForTimeout(500);
    expect(room.responders).toHaveLength(1);
    if (SHOTS) await stream.screenshot({ path: `${SHOTS}/obs.png` });

    // &feed=1: the last five lines involving the slot, never a hint
    await stream.goto("./?view=obs&feed=1");
    const feed = stream.getByTestId("ap-obs-feed").getByRole("listitem");
    await expect(feed).toHaveCount(5);
    await expect(feed.last()).toHaveText("Quester released 4 items, 2 for you");
    await expect(stream.getByTestId("ap-obs-feed")).not.toContainText("is at");
    expect(await stream.locator("body").innerText()).not.toContain(
      String(room.port),
    );
    if (SHOTS) await stream.screenshot({ path: `${SHOTS}/obs-feed.png` });

    // &timer=1 too: the run timer on its row under the grid, the feed under it
    await stream.goto("./?view=obs&feed=1&timer=1");
    const timer = stream.getByTestId("stream-timer");
    await expect(timer).toHaveAccessibleName(/^Run timer: \d+:\d\d, running$/);
    const grid = await stream.getByTestId("ap-skin").boundingBox();
    const drawn = await timer.boundingBox();
    const lines = await stream.getByTestId("ap-obs-feed").boundingBox();
    // Under the grid, as wide as it, the feed below and all in the viewport
    expect(drawn?.y).toBeCloseTo((grid?.y ?? 0) + (grid?.height ?? 0), 0);
    expect(drawn?.width).toBeCloseTo(grid?.width ?? 0, 0);
    expect(lines?.y).toBeGreaterThanOrEqual(
      (drawn?.y ?? 0) + (drawn?.height ?? 0) - 1,
    );
    expect((lines?.y ?? 0) + (lines?.height ?? 0)).toBeLessThanOrEqual(
      stream.viewportSize()?.height ?? 0,
    );
    if (SHOTS) {
      for (const width of WIDTHS) {
        await stream.setViewportSize({ height: 900, width });
        await stream.screenshot({
          path: `${SHOTS}/obs-feed-timer-${width}.png`,
        });
      }
    }
  } finally {
    await room.close();
  }
});

for (const width of WIDTHS) {
  test(`the Archipelago board fits, passes axe and is keyboard-reachable at ${width}px`, async ({
    page,
  }) => {
    const room = await startRoom();
    try {
      await page.setViewportSize({ height: 900, width });
      await openOnGame(page, "archipelago");
      const dialog = roomDialog(page);
      await auditDialog(page, dialog, width);
      if (SHOTS)
        await page.screenshot({ path: `${SHOTS}/dialog-${width}.png` });
      await connectTo(page, room);
      await expect(dialog.getByTestId("ap-connect-headline")).toHaveText(
        "Connected",
      );
      await auditDialog(page, dialog, width);
      await page.keyboard.press("Escape");
      playOn(room);
      await expect(page.getByTestId("ap-item-keys-tr")).toContainText(
        "1 small key",
      );
      await expect(page.getByTestId("ap-checks")).toContainText("Ice Palace");
      await auditPage(page);
      // Every control in reach of the keyboard, the room's dialog included
      await page.locator("body").click({ position: { x: 1, y: 1 } });
      await tabTo(page, "ap-room-button");
      await tabTo(page, "ap-checks-hide");
      // The groups: those with checks left open beside the items, every one
      // closed where the board stacks; the keyboard opens and closes them
      const ice = page.getByTestId("ap-zone-Ice Palace");
      const summary = ice.locator("summary");
      await expect(summary).toHaveText(/^Ice Palace — \d+ left \/ \d+$/);
      const stacked = width < 960;
      await expect(ice).toHaveJSProperty("open", !stacked);
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(ice).toHaveJSProperty("open", stacked);
      await page.keyboard.press("Space");
      await expect(ice).toHaveJSProperty("open", !stacked);
      // A phone's page ends with the groups, not 249 checks; beside the
      // items the checks scroll within the viewport, and the page with them
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight),
      ).toBeLessThan(stacked ? 3200 : 1400);
      if (SHOTS) {
        await page.screenshot({
          fullPage: true,
          path: `${SHOTS}/board-${width}.png`,
        });
      }
      // The feed's controls, the run timer and the side tabs by keyboard; the
      // hints and the players pass axe too
      await tabTo(page, "ap-feed-scope-mine");
      await tabTo(page, "ap-feed-announce");
      await tabTo(page, "run-timer");
      await tabTo(page, "ap-side-tab-checks");
      await page.keyboard.press("ArrowRight");
      await expect(page.getByTestId("ap-side-tab-hints")).toBeFocused();
      await expect(page.getByTestId("ap-hints")).toBeVisible();
      await settled(page);
      await auditPage(page);
      if (SHOTS) {
        await page.screenshot({
          fullPage: true,
          path: `${SHOTS}/hints-${width}.png`,
        });
      }
      await page.keyboard.press("ArrowRight");
      await expect(page.getByTestId("ap-players")).toBeVisible();
      await page.getByTestId("ap-slot-data").locator("summary").click();
      await settled(page);
      await auditPage(page);
      if (SHOTS) {
        await page.screenshot({
          fullPage: true,
          path: `${SHOTS}/players-${width}.png`,
        });
      }
      await page.getByTestId("ap-feed-scope-room").check();
      await auditPage(page);
    } finally {
      await room.close();
    }
  });
}
