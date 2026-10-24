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

    // Nothing a tracker may not send ever left the page
    const sent = new Set(room.received.map((packet) => packet.cmd));
    expect([...sent].sort()).toEqual(
      ["Connect", "Get", "GetDataPackage", "SetNotify", "Sync"].filter((cmd) =>
        sent.has(cmd),
      ),
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
    // The stream view never connects
    await stream.waitForTimeout(500);
    expect(room.responders).toHaveLength(1);
    if (SHOTS) await stream.screenshot({ path: `${SHOTS}/obs.png` });
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
      if (stacked) {
        // A phone's page ends with the groups, not 249 checks
        expect(
          await page.evaluate(() => document.documentElement.scrollHeight),
        ).toBeLessThan(2600);
      }
      if (SHOTS) {
        await page.screenshot({
          fullPage: true,
          path: `${SHOTS}/board-${width}.png`,
        });
      }
    } finally {
      await room.close();
    }
  });
}
