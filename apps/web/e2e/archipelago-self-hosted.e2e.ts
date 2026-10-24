// A self-hosted room from the published site: the build is served at the
// site's real https address (its requests answered from this machine's
// server), and the fake AP server listens on loopback. Chromium then puts the
// socket behind Local Network Access, as it does for players: headless, an
// undecided permission fails the socket at once
// (net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS, measured in Chromium 156);
// Playwright's grant of `local-network-access` is the player's Allow.
import { expect, type Page, test } from "@playwright/test";
import { FakeApServer } from "../../../packages/archipelago/test/fake-ap-server";
import { fixture } from "../../../packages/archipelago/test/fixtures";
import { auditDialog, tabTo, unreachableClickables, WIDTHS } from "./support";

const PORT = Number(process.env.E2E_PORT ?? 4173);
const SITE = "https://kqesar.github.io";
const SITE_URL = `${SITE}/alltp-tracker/`;
/** Where to keep the screenshots for a look by eye, when asked. */
const SHOTS = process.env.AP_SHOTS;

// The service worker would answer the site's requests itself
test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ context }) => {
  await context.route(`${SITE}/**`, async (route) => {
    const { pathname, search } = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({
        url: `http://localhost:${PORT}${pathname}${search}`,
      }),
    });
  });
});

// A request this route still answers when the test ends fails the test
test.afterEach(async ({ page }) => {
  await page.waitForLoadState("networkidle");
});

const startRoom = () =>
  FakeApServer.start({ client: "tracker", fixture: fixture("normal-session") });

/** The site on the Archipelago board, from a link as a player follows one. */
const openSite = async (page: Page, query = "?game=archipelago") => {
  await page.goto(`${SITE_URL}${query}`);
  await page.getByTestId("toolbar").waitFor();
};

const roomDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Archipelago room" });

test("says the browser will ask, then connects once the player allows it", async ({
  context,
  page,
}) => {
  const room = await startRoom();
  try {
    await openSite(page);
    const dialog = roomDialog(page);
    await dialog.getByTestId("ap-room-input").fill(room.url);
    // Said before any socket, and part of the field's description
    const reach = dialog.getByTestId("ap-room-reach");
    await expect(reach).toHaveText(
      /The browser will ask to let this site reach this device: choose Allow\./,
    );
    await expect(
      dialog.getByTestId("ap-room-input"),
    ).toHaveAccessibleDescription(
      /will ask to let this site reach this device/,
    );
    await expect(dialog.getByTestId("ap-step-permission")).toBeVisible();
    await dialog.getByTestId("ap-slot-input").fill("Link");
    await dialog.getByTestId("ap-connect").click();
    // Headless Chromium dismisses its prompt: the board says so and waits
    await expect(dialog.getByTestId("ap-connect-headline")).toHaveText(
      "Blocked by the browser",
    );
    await expect(dialog.getByTestId("ap-connect-detail")).toHaveText(
      "The browser did not let this site reach this device. Retry, and choose Allow when it asks.",
    );
    await expect(dialog.getByTestId("ap-step-permission")).toHaveAttribute(
      "data-state",
      "failing",
    );
    await expect(dialog.getByTestId("ap-retry")).toBeVisible();
    expect(room.responders).toHaveLength(0);
    // The player allows it: the permission's change wakes the session
    await context.grantPermissions(["local-network-access"], { origin: SITE });
    await expect(dialog.getByTestId("ap-connect-headline")).toHaveText(
      "Connected",
    );
    await expect(dialog.getByTestId("ap-step-permission")).toHaveAttribute(
      "data-state",
      "done",
    );
    await expect(dialog.getByTestId("ap-room-reach")).toHaveCount(0);
  } finally {
    await room.close();
  }
});

test("connects at once where the permission was granted before", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["local-network-access"], { origin: SITE });
  const room = await startRoom();
  try {
    await openSite(page);
    const dialog = roomDialog(page);
    await dialog.getByTestId("ap-room-input").fill(room.url);
    await dialog.getByTestId("ap-slot-input").fill("Link");
    await expect(dialog.getByTestId("ap-room-reach")).toHaveCount(0);
    await dialog.getByTestId("ap-connect").click();
    await expect(dialog.getByTestId("ap-connect-headline")).toHaveText(
      "Connected",
    );
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("ap-room-slot")).toHaveText(
      "Link · A Link to the Past · Team 1",
    );
  } finally {
    await room.close();
  }
});

test("opens no socket while the player has blocked the site", async ({
  page,
}) => {
  // Blocked in the site's settings: Playwright can grant, not deny
  await page.addInitScript(() => {
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (descriptor) =>
      ["loopback-network", "local-network"].includes(descriptor.name as string)
        ? Promise.resolve({
            addEventListener: () => {},
            onchange: null,
            state: "denied",
          } as never)
        : query(descriptor);
  });
  const room = await startRoom();
  try {
    await openSite(page);
    const dialog = roomDialog(page);
    await dialog.getByTestId("ap-room-input").fill(room.url);
    await expect(dialog.getByTestId("ap-room-reach")).toHaveText(
      /blocks this site from reaching this device\. Allow it in the site's settings/,
    );
    await dialog.getByTestId("ap-slot-input").fill("Link");
    await dialog.getByTestId("ap-connect").click();
    await expect(dialog.getByTestId("ap-connect-detail")).toHaveText(
      /Allow it in the site's settings \(the icon left of the address\): the tracker connects once it is allowed\./,
    );
    await page.waitForTimeout(1000);
    expect(room.responders).toHaveLength(0);
  } finally {
    await room.close();
  }
});

test("refuses ws:// to the internet before any socket, with the way out", async ({
  page,
}) => {
  await openSite(page);
  const dialog = roomDialog(page);
  await dialog.getByTestId("ap-room-input").fill("ws://example.com:38281");
  await expect(dialog.getByTestId("ap-room-reach")).toHaveText(
    /Ask the room's host for a wss:\/\/ address, or use the desktop app\./,
  );
  await dialog.getByTestId("ap-slot-input").fill("Link");
  await dialog.getByTestId("ap-connect").click();
  await expect(dialog.getByTestId("ap-room-error")).toBeVisible();
  await expect(dialog.getByTestId("ap-connect-headline")).toHaveText(
    "Not connected",
  );
});

test("a join link fills the dialog in, never connects, and leaves the address", async ({
  context,
  page,
}) => {
  await context.grantPermissions(
    ["local-network-access", "clipboard-read", "clipboard-write"],
    { origin: SITE },
  );
  const room = await startRoom();
  try {
    const query = new URLSearchParams({
      game: "archipelago",
      password: "hunter2",
      room: room.url,
      slot: "Link",
    });
    await openSite(page, `?${query}`);
    const dialog = roomDialog(page);
    await expect(dialog.getByTestId("ap-prefill-note")).toBeVisible();
    await expect(dialog.getByTestId("ap-room-input")).toHaveValue(room.url);
    await expect(dialog.getByTestId("ap-slot-input")).toHaveValue("Link");
    // The password a hand-made link carried is neither used nor kept
    await expect(dialog.getByTestId("ap-password-input")).toHaveValue("");
    expect(new URL(page.url()).search).toBe("");
    // Typing starts at the password, which a link never holds; Enter connects
    await expect(dialog.getByTestId("ap-password-input")).toBeFocused();
    await page.waitForTimeout(500);
    expect(room.responders).toHaveLength(0);

    // The link the dialog copies: the room and the slot, nothing else
    await dialog.getByTestId("ap-password-input").fill("secret");
    await dialog.getByTestId("ap-copy-join").click();
    await expect(dialog.getByText("Copied.")).toBeVisible();
    const copied = new URL(
      await page.evaluate(() => navigator.clipboard.readText()),
    );
    expect(copied.origin + copied.pathname).toBe(SITE_URL);
    expect([...copied.searchParams]).toEqual([
      ["game", "archipelago"],
      ["room", room.url],
      ["slot", "Link"],
    ]);

    // Enter in the password field connects, as Connect does
    await dialog.getByTestId("ap-password-input").press("Enter");
    await expect(dialog.getByTestId("ap-connect-headline")).toHaveText(
      "Connected",
    );
  } finally {
    await room.close();
  }
});

for (const width of WIDTHS) {
  test(`the self-hosted room's dialog fits, passes axe and is keyboard-reachable at ${width}px`, async ({
    page,
  }) => {
    const room = await startRoom();
    try {
      await page.setViewportSize({ height: 900, width });
      const query = new URLSearchParams({
        game: "archipelago",
        room: room.url,
        slot: "Link",
      });
      await openSite(page, `?${query}`);
      const dialog = roomDialog(page);
      await expect(dialog.getByTestId("ap-room-reach")).toBeVisible();
      await auditDialog(page, dialog, width);
      expect(await unreachableClickables(page, "dialog[open]")).toEqual([]);
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/self-hosted-${width}.png` });
        await dialog
          .locator(".modal__body")
          .evaluate((body) => body.scrollTo(0, body.scrollHeight));
        await page.screenshot({
          path: `${SHOTS}/self-hosted-end-${width}.png`,
        });
      }
      // Every control by keyboard, from Connect to the join link and the steps
      await tabTo(page, "ap-copy-join");
      await page.keyboard.press("Tab");
      await expect(
        dialog.getByTestId("ap-step-address").getByRole("button"),
      ).toBeFocused();
      // A refusal reads as one too
      await dialog.getByTestId("ap-room-input").fill("ws://192.168.1.20:38281");
      await dialog.getByTestId("ap-slot-input").fill("Link");
      await dialog.getByTestId("ap-connect").click();
      await expect(dialog.getByTestId("ap-connect-headline")).toHaveText(
        "Blocked by the browser",
      );
      await auditDialog(page, dialog, width);
      if (SHOTS) {
        await page.screenshot({
          path: `${SHOTS}/self-hosted-denied-${width}.png`,
        });
      }
    } finally {
      await room.close();
    }
  });
}
