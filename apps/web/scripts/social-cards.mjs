// Draws the link preview image of each game (public/social/<id>.png, 1200 x 630,
// what Open Graph and X's large card use), and the repository's social preview
// on GitHub (.github/social-preview.png, 1280 x 640, A Link to the Past's
// board): a real screenshot of the tracker, a few items found, never a stock
// graphic.
//
// Usage, with the site's production build served (pnpm preview):
//   pnpm --filter @alltp/web exec node scripts/social-cards.mjs <site url> [out dir]
//   e.g. http://localhost:4173/alltp-tracker/
// The screenshot is then cut to 128 colours with ImageMagick (`magick`): the
// board has fewer, and the file drops from about 500 kB to 170 kB.
//
// The Archipelago board shows a room: the script answers its socket itself
// (Playwright's routeWebSocket) with what AP 0.6.8 sent the bench's tracker
// on Link (packages/archipelago/test/fixtures), a few items given on top.
import { execFile } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";

const run = promisify(execFile);
const [site, out = "public/social"] = process.argv.slice(2);
if (!site) throw new Error("Usage: social-cards.mjs <site url> [out dir]");

/**
 * What each game's board shows: the clicks of a run a little way in, and the
 * page's zoom. A board that fills 1200 px (A Link to the Past's and SMZ3's
 * maps) is shot as is; Super Metroid's, with no map, is shot at half the
 * width and twice the pixel density, so it fills the card as large.
 */
const RUNS = {
  alttpr: {
    clicks: [
      ...["boots", "hookshot", "lantern", "mirror", "flute", "hammer", "bow"],
      ...["glove", "sword", "sword", "item-boss0", "item-boss1"],
    ],
    scale: 1,
  },
  archipelago: { clicks: [], room: true, scale: 1 },
  sm: {
    clicks: [
      ...["morph", "varia", "bombs", "missile", "missile", "missile"],
      ...["missile", "missile", "missile"],
      ...["sm-objective-kraid", "sm-objective-phantoon"],
    ],
    scale: 1.5,
  },
  smz3: {
    clicks: ["morph", "varia", "missile", "glove", "hammer", "moonPearl"],
    scale: 1,
  },
};

/** The package's recordings, read as plain JSON. */
const AP_TEST = new URL("../../../packages/archipelago/test/", import.meta.url);
const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, AP_TEST), "utf8"));

/** Items a run a little way in holds, by AP's names. */
const AP_ITEMS = [
  ...["Progressive Sword", "Progressive Sword", "Hookshot", "Pegasus Boots"],
  ...["Lamp", "Moon Pearl", "Magic Mirror", "Progressive Glove", "Bow"],
  ...["Fire Rod", "Flute", "Bottle", "Small Key (Eastern Palace)"],
  ...["Big Key (Eastern Palace)", "Small Key (Desert Palace)"],
  ...["Piece of Heart", "Piece of Heart", "Rupees (20)", "Bombs (3)"],
];

/**
 * A room on Link (A Link to the Past) for the Archipelago board: RoomInfo and
 * Connected as recorded, a sixth of the locations checked, AP_ITEMS
 * received; Get and GetDataPackage answered from the recordings.
 * @returns What waits for the board to show the room
 */
const archipelagoRoom = async (page) => {
  const session = await readJson("fixtures/normal-session.json");
  const pkg = await readJson("datapackages/A_Link_to_the_Past.json");
  const sent = session.frames
    .filter((frame) => frame.client === "tracker" && frame.dir === "in")
    .flatMap((frame) => frame.packets);
  const roomInfo = sent.find((packet) => packet.cmd === "RoomInfo");
  const recorded = sent.find((packet) => packet.cmd === "Connected");
  const storage = Object.assign(
    {},
    ...sent.filter((p) => p.cmd === "Retrieved").map((p) => p.keys),
  );
  const missing = recorded.missing_locations;
  const done = missing.filter((_, index) => index % 6 === 0);
  const connected = {
    ...recorded,
    checked_locations: done,
    missing_locations: missing.filter((id) => !done.includes(id)),
  };
  const items = AP_ITEMS.map((name, index) => ({
    // As AP classes them: the heart pieces useful, rupees and bombs filler
    flags: name.startsWith("Piece") ? 2 : /Rupees|Bombs/.test(name) ? 0 : 1,
    item: pkg.item_name_to_id[name],
    location: done[index] ?? 0,
    player: 1,
  }));
  const { archipelago: _a, game: _g, ...body } = pkg;
  const answer = (packet) => {
    switch (packet.cmd) {
      case "Connect":
        return [connected, { cmd: "ReceivedItems", index: 0, items }];
      case "Get":
        return [
          {
            cmd: "Retrieved",
            keys: Object.fromEntries(
              packet.keys.map((key) => [key, storage[key] ?? null]),
            ),
            uuid: packet.uuid,
          },
        ];
      case "GetDataPackage":
        return [{ cmd: "DataPackage", data: { games: { [pkg.game]: body } } }];
      default:
        return [];
    }
  };
  await page.routeWebSocket(/^wss:\/\/archipelago\.gg/, (socket) => {
    socket.send(JSON.stringify([roomInfo]));
    socket.onMessage((message) => {
      for (const packet of JSON.parse(String(message))) {
        const packets = answer(packet);
        if (packets.length > 0) socket.send(JSON.stringify(packets));
      }
    });
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "alltp-tracker-archipelago-connection",
      JSON.stringify({
        state: {
          address: "archipelago.gg:38281",
          connectOnStart: true,
          rememberPassword: false,
          roomLink: null,
          slot: "Link",
          uuid: null,
        },
        version: 0,
      }),
    ),
  );
  return async () => {
    await page.getByTestId("ap-room-status").getByText("Connected").waitFor();
    await page.getByTestId("ap-room-slot").waitFor();
    await page.getByTestId("ap-checks-filter").waitFor();
  };
};

const PREFIX = { alttpr: "item", sm: "sm-item", smz3: "smz3-item" };

const browser = await chromium.launch();

/**
 * Shoots one game's board at a size, then cuts it to 128 colours.
 * @param file Where the PNG goes
 */
const shoot = async (game, width, height, file) => {
  const { clicks, room, scale } = RUNS[game];
  const context = await browser.newContext({
    deviceScaleFactor: scale,
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: { height: height / scale, width: width / scale },
  });
  await context.addInitScript(
    (id) => localStorage.setItem("alltp-tracker-game", id),
    game,
  );
  const page = await context.newPage();
  const ready = room ? await archipelagoRoom(page) : null;
  await page.goto(site);
  await page.getByTestId("toolbar").waitFor();
  await ready?.();
  for (const click of clicks) {
    const testId = click.includes("-") ? click : `${PREFIX[game]}-${click}`;
    await page.getByTestId(testId).click();
  }
  // Nothing hovered or focused: no tooltip, no focus ring
  await page.mouse.move(width / scale - 1, height / scale - 1);
  await page.evaluate(() => document.activeElement?.blur());
  await page.screenshot({ path: file });
  await run("magick", [
    file,
    ...["-colors", "128", "-dither", "None"],
    ...["-define", "png:compression-level=9", file],
  ]);
  await context.close();
};

await mkdir(out, { recursive: true });
for (const game of Object.keys(RUNS)) {
  await shoot(game, 1200, 630, join(out, `${game}.png`));
}
// The repository's social preview on GitHub, at the 1280 x 640 GitHub asks
// for: uploaded by hand in the repository's settings (there is no API)
await shoot(
  "alttpr",
  1280,
  640,
  fileURLToPath(
    new URL("../../../.github/social-preview.png", import.meta.url),
  ),
);
await browser.close();
