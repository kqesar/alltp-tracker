// Records Archipelago protocol fixtures against real AP 0.6.8 servers, through archipelago.js 2.1.0.
// Usage (README, "Recording the fixtures"):
//   AP_DIR=<extracted AP release> pnpm --filter @alltp/archipelago record-fixtures
// Starts its own servers (serve.sh) on 38281-38284, hosting test/server/*.archipelago, writes
// test/fixtures/*.json and test/datapackages/*.json, then stops them. Every frame in both
// directions is kept as sent. Never edit the output by hand: record again.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, libraryVersion } from "archipelago.js";
import { WebSocketServer } from "ws";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, "..");
const fixturesDir = join(pkg, "test/fixtures");
const dpDir = join(pkg, "test/datapackages");
const logsDir = mkdtempSync(join(tmpdir(), "ap-record-"));
mkdirSync(fixturesDir, { recursive: true });
mkdirSync(dpDir, { recursive: true });

const AP_VERSION = "0.6.8";
const NORMAL = join(pkg, "test/server/normal-seed4242.archipelago");
const RACE = join(pkg, "test/server/race-seed4242.archipelago");
const PASSWORD = "bench-pass";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- frame recorder: a WebSocket subclass archipelago.js picks up through global.WebSocket ----
const NativeWebSocket = globalThis.WebSocket;
let frames = [];
let t0 = Date.now();
let label = "?";
const rec = (client, dir, extra) =>
  frames.push({ client, dir, t: Date.now() - t0, ...extra });
class RecordingWebSocket extends NativeWebSocket {
  constructor(url, protocols) {
    super(url, protocols);
    this.benchLabel = label;
    rec(this.benchLabel, "open-attempt", { url: String(url) });
    this.addEventListener("open", () => rec(this.benchLabel, "open", {}));
    this.addEventListener("message", (e) => {
      let packets;
      try {
        packets = JSON.parse(e.data);
      } catch {
        packets = { unparsed: String(e.data) };
      }
      rec(this.benchLabel, "in", { packets });
    });
    this.addEventListener("close", (e) =>
      rec(this.benchLabel, "close", {
        code: e.code,
        reason: e.reason,
        wasClean: e.wasClean,
      }),
    );
    this.addEventListener("error", (e) =>
      rec(this.benchLabel, "error", {
        message: e.message ?? String(e.error ?? ""),
      }),
    );
  }
  send(data) {
    rec(this.benchLabel, "out", { packets: JSON.parse(data) });
    super.send(data);
  }
}
globalThis.WebSocket = RecordingWebSocket;

const mark = (note) =>
  frames.push({ client: "-", dir: "mark", note, t: Date.now() - t0 });
function begin() {
  frames = [];
  t0 = Date.now();
}
function save(name, meta) {
  const file = join(fixturesDir, `${name}.json`);
  const body = {
    archipelago: AP_VERSION,
    archipelagoJs: libraryVersion,
    fixture: name,
    recorded: new Date().toISOString(),
    ...meta,
    frames,
  };
  writeFileSync(file, `${JSON.stringify(body, null, 1)}\n`);
  console.log(`wrote ${file} (${frames.length} frames)`);
}

// A fresh Client per connection, as the plan says; the data package is never auto-fetched.
function newClient(name) {
  const c = new Client({
    autoFetchDataPackage: false,
    debugLogVersions: false,
    maximumMessages: 50,
  });
  c.benchName = name;
  return c;
}
async function login(client, url, slot, game, options) {
  label = client.benchName;
  return client.login(url, slot, game, options);
}
const TRACKER = { items: 0b111, slotData: true, tags: ["Tracker"] };
async function tryLogin(client, url, slot, game, options) {
  try {
    const slotData = await login(client, url, slot, game, options);
    return { ok: true, slotData };
  } catch (e) {
    return {
      error: `${e.constructor.name}: ${e.message}`,
      errors: e.errors,
      ok: false,
    };
  }
}
// Raw packet through the library's socket (what our guard will wrap).
const raw = (client, ...packets) => client.socket.send(...packets);
const waitFor = (client, event, pred = () => true, ms = 5000) =>
  Promise.race([client.socket.wait(event, pred), sleep(ms).then(() => null)]);

// ---- servers ----
const servers = [];
async function startServer(mw, port, extra = [], host = "127.0.0.1") {
  const log = join(logsDir, `server-${port}.log`);
  const p = spawn(
    "sh",
    [
      "-c",
      `exec "${join(here, "serve.sh")}" "$@" > "${log}" 2>&1`,
      "sh",
      mw,
      host,
      String(port),
      ...extra,
    ],
    {
      detached: true,
      stdio: "ignore",
    },
  );
  servers.push(p);
  for (let i = 0; i < 120; i++) {
    try {
      const ok = await new Promise((resolve) => {
        const ws = new NativeWebSocket(`ws://${host}:${port}`);
        ws.onmessage = () => {
          ws.close();
          resolve(true);
        };
        ws.onerror = () => resolve(false);
      });
      if (ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`server ${port} did not start`);
}
function stopServers() {
  for (const p of servers) {
    try {
      process.kill(-p.pid, "SIGTERM");
    } catch {}
  }
}

async function main() {
  await startServer(NORMAL, 38281);
  await startServer(NORMAL, 38282, ["--password", PASSWORD]);
  await startServer(RACE, 38283);
  await startServer(NORMAL, 38284, ["--compatibility", "0"]);
  const N = "ws://127.0.0.1:38281";

  // 1. Data packages: before any Connect (no auth needed), one game per request.
  begin();
  {
    const c = newClient("datapackage");
    label = c.benchName;
    const roomInfo = await c.socket.connect(N);
    for (const game of roomInfo.games) {
      raw(c, { cmd: "GetDataPackage", games: [game] });
      const [pkt] = await c.socket.wait("dataPackage");
      const data = pkt.data.games[game];
      const safe = game.replace(/[^A-Za-z0-9]+/g, "_");
      writeFileSync(
        join(dpDir, `${safe}.json`),
        `${JSON.stringify({ archipelago: AP_VERSION, game, ...data }, null, 1)}\n`,
      );
      console.log(`datapackage ${game}: checksum ${data.checksum}`);
    }
    c.socket.disconnect();
  }
  // Keep only the request/response shape in the fixture, not the 70 KB of names twice.
  for (const f of frames) {
    if (f.dir === "in")
      for (const p of f.packets)
        if (p.cmd === "DataPackage")
          for (const [g, d] of Object.entries(p.data.games))
            p.data.games[g] = {
              $file: `datapackages/${g.replace(/[^A-Za-z0-9]+/g, "_")}.json`,
              checksum: d.checksum,
            };
  }
  save("datapackage", {
    note: "GetDataPackage per game before Connect; DataPackage bodies moved to datapackages/*.json",
    server: "normal, no password",
  });

  // 2. The main story: a tracker on Link, a second tracker on Link, game clients on Quester and Link.
  begin();
  const tracker = newClient("tracker");
  const tracker2 = newClient("tracker2");
  const quester = newClient("game-quester");
  const gameLink = newClient("game-link");
  {
    mark(
      "tracker logs in on Link: no game, tags [Tracker], items_handling 0b111",
    );
    const r = await tryLogin(tracker, N, "Link", "", TRACKER);
    mark(`tracker login -> ${JSON.stringify(r).slice(0, 200)}`);
    await sleep(500);
    mark("tracker reads data storage and subscribes");
    raw(tracker, {
      cmd: "Get",
      keys: [
        "_read_race_mode",
        "_read_slot_data_1",
        "_read_client_status_0_1",
        "_read_hints_0_1",
        "_read_location_name_groups_A Link to the Past",
      ],
      uuid: "bench-get-1",
    });
    raw(tracker, {
      cmd: "SetNotify",
      keys: [
        "_read_hints_0_1",
        "_read_client_status_0_1",
        "_read_client_status_0_4",
      ],
    });
    await sleep(500);

    mark("a second tracker on the same slot (two clients on one slot)");
    mark(
      `tracker2 login -> ${JSON.stringify(await tryLogin(tracker2, N, "Link", "", TRACKER)).slice(0, 120)}`,
    );
    await sleep(500);

    mark("game client logs in on Quester (game APQuest, items 0b111)");
    const q = await tryLogin(quester, N, "Quester", "APQuest", {
      items: 0b111,
      tags: [],
    });
    mark(`game-quester login -> ok=${q.ok}`);
    await sleep(500);
    const missing = quester.room.missingLocations;
    mark(
      `game-quester scouts its own missing locations (create_as_hint 0): ${missing.length}`,
    );
    raw(quester, {
      cmd: "LocationScouts",
      create_as_hint: 0,
      locations: missing,
    });
    const [info] = (await waitFor(quester, "locationInfo")) ?? [
      { locations: [] },
    ];
    const forLink = info.locations
      .filter((i) => i.player === 1)
      .map((i) => i.location);
    const others = info.locations
      .filter((i) => i.player !== 1)
      .map((i) => i.location);
    mark(`Quester locations holding Link's items: ${JSON.stringify(forLink)}`);

    mark(
      "game-quester checks one location holding a Link item, then one holding another player's item",
    );
    raw(quester, { cmd: "LocationChecks", locations: [forLink[0]] });
    await sleep(700);
    raw(quester, { cmd: "LocationChecks", locations: [others[0]] });
    await sleep(700);

    mark(
      "game client logs in on Link too (game A Link to the Past, items 0b001)",
    );
    const gl = await tryLogin(gameLink, N, "Link", "A Link to the Past", {
      items: 0b001,
      tags: [],
    });
    mark(`game-link login -> ok=${gl.ok}`);
    await sleep(500);
    const linkMissing = gameLink.room.missingLocations;
    raw(gameLink, {
      cmd: "LocationScouts",
      create_as_hint: 0,
      locations: linkMissing,
    });
    const [linfo] = (await waitFor(gameLink, "locationInfo")) ?? [
      { locations: [] },
    ];
    const own = linfo.locations
      .filter((i) => i.player === 1)
      .map((i) => i.location);
    const foreign = linfo.locations
      .filter((i) => i.player !== 1)
      .map((i) => i.location);
    mark(
      "game-link checks two own-world locations and one holding another player's item",
    );
    raw(gameLink, { cmd: "LocationChecks", locations: own.slice(0, 2) });
    await sleep(700);
    raw(gameLink, { cmd: "LocationChecks", locations: [foreign[0]] });
    await sleep(700);

    mark(
      "hint: game-quester scouts a Link item with create_as_hint 2 (announce)",
    );
    raw(quester, {
      cmd: "LocationScouts",
      create_as_hint: 2,
      locations: [forLink[1]],
    });
    await sleep(700);
    mark(
      "hint: game-link CreateHints on one of its own locations holding a foreign item (0.6 packet)",
    );
    raw(gameLink, {
      cmd: "CreateHints",
      locations: [foreign[1]],
      player: 1,
      status: 0,
    });
    await sleep(700);
    mark("hint: game-link asks !hint for an item (costs points)");
    raw(gameLink, { cmd: "Say", text: "!hint Progressive Sword" });
    await sleep(700);

    mark("countdown from game-quester");
    raw(quester, { cmd: "Say", text: "!countdown 2" });
    await sleep(3500);

    mark("tracker tries what it must never do (server-side read-only check)");
    raw(tracker, { cmd: "LocationChecks", locations: [own[2]] });
    raw(tracker, { cmd: "StatusUpdate", status: 30 });
    raw(tracker, { cmd: "Bounce", data: { bench: true }, tags: ["Bench"] });
    await sleep(700);

    mark("ConnectUpdate from tracker2 (tags change) to see TagsChanged");
    raw(tracker2, {
      cmd: "ConnectUpdate",
      items_handling: 0b111,
      tags: ["Tracker", "Bench"],
    });
    await sleep(700);

    mark("game-quester reaches its goal: Goal, then auto release/collect");
    raw(quester, { cmd: "StatusUpdate", status: 30 });
    await sleep(1500);

    mark("disconnects: game-quester, tracker2, game-link (Part)");
    quester.socket.disconnect();
    await sleep(500);
    tracker2.socket.disconnect();
    await sleep(500);
    gameLink.socket.disconnect();
    await sleep(500);

    mark("tracker sends Sync: ReceivedItems index 0, the whole list again");
    raw(tracker, { cmd: "Sync" });
    await sleep(700);
    tracker.socket.disconnect();
    await sleep(300);

    mark(
      "a fresh tracker client on Link (page refresh): Connected carries every check so far",
    );
    const again = newClient("tracker-refresh");
    await tryLogin(again, N, "Link", "", TRACKER);
    await sleep(700);
    again.socket.disconnect();
  }
  save("normal-session", {
    server:
      "normal multiworld, no password, release/collect auto, hint_cost default",
    slots: {
      1: "Link (A Link to the Past)",
      2: "Samus (Super Metroid)",
      3: "Hybrid Hero (SMZ3)",
      4: "Quester (APQuest)",
    },
  });

  // 3. Refusals and a retry on the same socket.
  begin();
  {
    const cases = [
      ["unknown slot", "Nobody", "", TRACKER],
      ["slot name is case-sensitive", "link", "", TRACKER],
      [
        "wrong game, no tracker tag",
        "Link",
        "Not A Game",
        { items: 0b111, tags: [] },
      ],
      [
        "tracker announcing version 0.4.0",
        "Link",
        "",
        { ...TRACKER, version: { build: 0, major: 0, minor: 4 } },
      ],
      ["items_handling not an int", "Link", "", { ...TRACKER, items: "all" }],
      [
        "password sent to a room without one (accepted?)",
        "Link",
        "",
        { ...TRACKER, password: "whatever" },
      ],
    ];
    for (const [what, slot, game, opts] of cases) {
      const c = newClient(`refused:${what}`);
      mark(what);
      const r = await tryLogin(c, N, slot, game, opts);
      mark(`-> ${JSON.stringify(r)}`);
      await sleep(300);
      if (what === "unknown slot") {
        mark(
          "same socket, second Connect with a good slot (the server keeps the socket open after a refusal)",
        );
        const fix = {
          cmd: "Connect",
          game: "",
          items_handling: 7,
          name: "Link",
          password: "",
          slot_data: true,
          tags: ["Tracker"],
          uuid: "bench-retry",
          version: { build: 3, class: "Version", major: 0, minor: 6 },
        };
        raw(c, fix);
        await sleep(700);
      }
      c.socket.disconnect();
      await sleep(200);
    }
  }
  save("refused", { server: "normal multiworld, no password" });

  // 4. Password room.
  begin();
  {
    const P = "ws://127.0.0.1:38282";
    for (const [what, pw] of [
      ["no password", ""],
      ["wrong password", "nope"],
      ["right password", PASSWORD],
    ]) {
      const c = newClient(`password:${what}`);
      mark(what);
      mark(
        `-> ${JSON.stringify(await tryLogin(c, P, "Link", "", { ...TRACKER, password: pw })).slice(0, 300)}`,
      );
      await sleep(300);
      c.socket.disconnect();
    }
  }
  save("password", { server: `normal multiworld, --password ${PASSWORD}` });

  // 5. Slot data and race mode on every slot, normal then race.
  for (const [name, url, desc] of [
    ["slot-data-normal", N, "normal multiworld"],
    [
      "slot-data-race",
      "ws://127.0.0.1:38283",
      "race multiworld (Generate --race)",
    ],
  ]) {
    begin();
    for (const [i, slot] of [
      "Link",
      "Samus",
      "Hybrid Hero",
      "Quester",
    ].entries()) {
      const c = newClient(`tracker:${slot}`);
      mark(`tracker on ${slot}`);
      await tryLogin(c, url, slot, "", TRACKER);
      raw(c, {
        cmd: "Get",
        keys: [
          "_read_race_mode",
          `_read_slot_data_${i + 1}`,
          `_read_hints_0_${i + 1}`,
        ],
        uuid: `bench-${slot}`,
      });
      await sleep(500);
      c.socket.disconnect();
      await sleep(200);
    }
    save(name, { server: desc });
  }

  // 6. A tournament room (--compatibility 0): only the server's exact version passes.
  begin();
  {
    const C = "ws://127.0.0.1:38284";
    const a = newClient("compat0:default-version");
    mark("archipelago.js default version (0.6.3)");
    mark(`-> ${JSON.stringify(await tryLogin(a, C, "Link", "", TRACKER))}`);
    a.socket.disconnect();
    await sleep(300);
    const b = newClient("compat0:server-version");
    mark("version copied from RoomInfo.version");
    mark(
      `-> ${JSON.stringify(await tryLogin(b, C, "Link", "", { ...TRACKER, version: { build: 8, major: 0, minor: 6 } })).slice(0, 120)}`,
    );
    b.socket.disconnect();
  }
  save("compatibility-0", { server: "normal multiworld, --compatibility 0" });

  // 7. archipelago.js edges (frames plus observations).
  begin();
  const edges = {};
  {
    // Scheme-less address: wss first, then ws.
    const c = newClient("edge:scheme-less");
    const s = Date.now();
    const r = await tryLogin(c, "127.0.0.1:38281", "Link", "", TRACKER);
    edges.schemeLess = { ms: Date.now() - s, ok: r.ok, url: c.socket.url };
    c.socket.disconnect();

    // Closed port.
    const d = newClient("edge:closed-port");
    let s2 = Date.now();
    edges.closedPort = {
      ...(await tryLogin(d, "ws://127.0.0.1:38299", "Link", "", TRACKER)),
      ms: Date.now() - s2,
    };

    // A server that accepts the socket and never sends RoomInfo.
    const silent = new WebSocketServer({ host: "127.0.0.1", port: 38298 });
    await new Promise((r) => silent.on("listening", r));
    const e = newClient("edge:silent-server");
    s2 = Date.now();
    const res = await Promise.race([
      tryLogin(e, "ws://127.0.0.1:38298", "Link", "", TRACKER),
      sleep(15000).then(() => "still pending after 15 s"),
    ]);
    edges.silentServer = { ms: Date.now() - s2, result: res };
    e.socket.disconnect();
    for (const ws of silent.clients) ws.terminate();
    silent.close();

    // Listener leak: count "connected"/"connectionRefused" listeners added minus removed, per login on one Client.
    const f = newClient("edge:listener-leak");
    const live = { connected: new Set(), connectionRefused: new Set() };
    const on = f.socket.on.bind(f.socket);
    const off = f.socket.off.bind(f.socket);
    f.socket.on = (ev, l) => {
      live[ev]?.add(l);
      return on(ev, l);
    };
    f.socket.off = (ev, l) => {
      live[ev]?.delete(l);
      return off(ev, l);
    };
    const counts = [];
    for (let i = 0; i < 3; i++) {
      await tryLogin(f, N, "Link", "", TRACKER);
      counts.push({
        connected: live.connected.size,
        connectionRefused: live.connectionRefused.size,
        login: i + 1,
      });
    }
    edges.listenerLeak = counts;
    f.socket.disconnect();

    // Shared uuid between Clients (defaultConnectionOptions is computed once per module).
    const u = frames
      .filter((x) => x.dir === "out")
      .flatMap((x) => x.packets)
      .filter((p) => p.cmd === "Connect")
      .map((p) => p.uuid);
    edges.connectUuids = [...new Set(u)];

    // autoFetchDataPackage on (the library default): which games it asks for.
    const g = new Client({ debugLogVersions: false });
    g.benchName = "edge:autofetch";
    const before = frames.length;
    await login(g, N, "Link", "", TRACKER);
    edges.autoFetch = frames
      .slice(before)
      .filter((x) => x.dir === "out")
      .flatMap((x) => x.packets)
      .filter((p) => p.cmd === "GetDataPackage");
    g.socket.disconnect();
    // drop the big DataPackage answer from this fixture
    for (const fr of frames)
      if (fr.dir === "in")
        for (const p of fr.packets)
          if (p.cmd === "DataPackage")
            p.data = { $omitted: true, games: Object.keys(p.data.games) };
  }
  save("archipelagojs-edges", {
    edges,
    server: "normal multiworld + a silent ws server",
  });
  console.log(JSON.stringify(edges, null, 1));
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  stopServers();
  setTimeout(() => process.exit(), 500);
}
