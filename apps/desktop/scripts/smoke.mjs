// Starts the built desktop app and quits it with SIGTERM, the way a service
// manager or `kill` does, and fails unless it launches, serves the overlay API
// and closes its clients with 4410 (docs/overlay-api.md, docs/desktop.md,
// "Stream tools"). Unit tests cannot see a crash at launch (a handler that
// panics outside Tauri's runtime passes every one of them): only the real
// binary can.
//
//   xvfb-run -a pnpm --filter @alltp/desktop smoke [path/to/alltp-tracker]
//
// Linux only (signals, a display server). The binary defaults to the debug
// build in src-tauri, made with `cargo build --features tauri/custom-protocol`
// (what `tauri build` adds: without it the binary loads the dev server's
// address, not the embedded pages). The app runs against a throwaway home
// with a stream.json written here, on a free loopback port, so it never reads
// or changes the player's settings; it needs a display (Xvfb) and is not
// pointed at a real one.

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const binary = resolve(
  process.argv[2] ?? join(here, "../src-tauri/target/debug/alltp-tracker"),
);
// The identifier in tauri.conf.json: the app's config directory is named by it
const IDENTIFIER = "io.github.kqesar.alltp-tracker";

// How long to wait for each step, in ms: a cold start under Xvfb takes a few seconds
const LAUNCH_TIMEOUT = 60_000;
const STAY_UP = 3_000;
const QUIT_TIMEOUT = 10_000;

if (process.platform !== "linux") fail("the smoke test runs on Linux only");
if (!process.env.DISPLAY) fail("no DISPLAY: run it under xvfb-run -a");
if (!existsSync(binary))
  fail(`no binary at ${binary}: cargo build in apps/desktop/src-tauri first`);

const home = mkdtempSync(join(tmpdir(), "alltp-smoke-"));
const port = await freePort();
const token = () => randomBytes(16).toString("base64url");
const apiToken = token();
const configDir = join(home, ".config", IDENTIFIER);
mkdirSync(configDir, { recursive: true });
writeFileSync(
  join(configDir, "stream.json"),
  JSON.stringify({
    apiToken,
    enabled: true,
    lan: false,
    port,
    viewToken: token(),
  }),
);

let output = "";
let exited = null;
const app = spawn(binary, [], {
  env: {
    ...inherited(),
    GDK_BACKEND: "x11",
    HOME: home,
    NO_AT_BRIDGE: "1",
    XDG_CACHE_HOME: join(home, ".cache"),
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_DATA_HOME: join(home, ".local", "share"),
    XDG_RUNTIME_DIR: home,
    XDG_STATE_HOME: join(home, ".local", "state"),
  },
  // Not the player's session: the app starts its own, or none
  stdio: ["ignore", "pipe", "pipe"],
});
const collect = (chunk) => {
  output += chunk;
};
app.stdout.on("data", collect);
app.stderr.on("data", collect);
const gone = new Promise((done) => {
  app.on("exit", (code, signal) => {
    exited = { code, signal };
    done(exited);
  });
});

try {
  const client = await connect();
  console.log(`launched, overlay API answering on 127.0.0.1:${port}`);

  await Promise.race([sleep(STAY_UP), gone]);
  if (exited)
    fail(`the app exited ${describe(exited)} ${STAY_UP / 1000} s after launch`);
  if (/panicked/.test(output)) fail("the app panicked while running");

  const closed = client.closed;
  process.kill(app.pid, "SIGTERM");
  const close = await within(
    closed,
    QUIT_TIMEOUT,
    "the overlay client was not closed after SIGTERM",
  );
  if (close.code !== 4410)
    fail(`the overlay client was closed with ${close.code}, not 4410`);
  console.log(`SIGTERM: client closed with ${close.code} "${close.reason}"`);

  const end = await within(
    gone,
    QUIT_TIMEOUT,
    "the app did not exit after SIGTERM",
  );
  if (end.code !== 0)
    fail(`the app exited ${describe(end)} after SIGTERM, not 0`);
  console.log("the app exited 0");
} catch (error) {
  console.error(`smoke test failed: ${error.message}`);
  if (output) console.error(`--- the app's output ---\n${output.trimEnd()}`);
  process.exitCode = 1;
} finally {
  if (!exited) app.kill("SIGKILL");
  rmSync(home, { force: true, recursive: true });
}

/** Opens the overlay socket, retrying until the server is up, and waits for the first `state`. */
async function connect() {
  const deadline = Date.now() + LAUNCH_TIMEOUT;
  while (Date.now() < deadline) {
    if (exited) fail(`the app exited ${describe(exited)} at launch`);
    const socket = await tryOpen();
    if (socket) return socket;
    await Promise.race([sleep(250), gone]);
  }
  throw new Error(
    `no overlay API on port ${port} after ${LAUNCH_TIMEOUT / 1000} s`,
  );
}

/**
 * One attempt: a client that received a frame (the relay beats at once, so a
 * frame proves the API token was accepted), or null when the server is not up
 * yet.
 */
function tryOpen() {
  return new Promise((done) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/overlay`, [
      `alltp.${apiToken}`,
    ]);
    let received = false;
    const closed = new Promise((closes) => {
      socket.onclose = (event) => {
        closes({ code: event.code, reason: event.reason });
        if (!received) done(null);
      };
    });
    socket.onerror = () => {};
    socket.onmessage = () => {
      if (received) return;
      received = true;
      done({ closed });
    };
    setTimeout(() => {
      if (!received) socket.close();
    }, 5_000);
  });
}

/** The environment without the player's own sessions (Wayland, D-Bus), which the app must not reach. */
function inherited() {
  const { DBUS_SESSION_BUS_ADDRESS, WAYLAND_DISPLAY, ...rest } = process.env;
  return rest;
}

function freePort() {
  return new Promise((done, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port: free } = server.address();
      server.close(() => done(free));
    });
  });
}

function within(promise, ms, message) {
  let timer;
  const late = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

function describe({ code, signal }) {
  return signal ? `on ${signal}` : `with status ${code}`;
}

function fail(message) {
  throw new Error(message);
}
