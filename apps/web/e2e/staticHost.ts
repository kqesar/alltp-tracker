import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { type WebSocket, WebSocketServer } from "ws";

/** The production build the suite's web server just made. */
export const DIST = join(import.meta.dirname, "../dist");

const TYPES: Record<string, string> = {
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

/**
 * A static host for the build under `base`, as GitHub Pages serves it (same
 * ten-minute HTTP caching), on a port of its own. `deploy` replaces files, as
 * a release does: the browser then finds them on its own, through requests
 * no Playwright route can see, such as its check for a new service worker.
 * `relay` is the desktop app's live follow stream, faked on the same port.
 */
export const hostBuild = async (base: string) => {
  const deployed = new Map<string, string>();
  const server = createServer(async (request, response) => {
    const { pathname } = new URL(request.url ?? "/", "http://host");
    const path = normalize(decodeURIComponent(pathname));
    if (!path.startsWith(base)) {
      response.writeHead(404).end();
      return;
    }
    const file = `${path.slice(base.length)}${path.endsWith("/") ? "index.html" : ""}`;
    try {
      const body = deployed.get(file) ?? (await readFile(join(DIST, file)));
      response.writeHead(200, {
        "cache-control": "max-age=600",
        "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  const relay = fakeRelay(server);
  await new Promise<void>((resolve) => server.listen(0, "localhost", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    // close() alone waits for every open connection: a page still loading
    // (its service worker caching the build) would hold the test past its
    // timeout
    close: () =>
      new Promise((resolve) => {
        relay.close();
        server.close(resolve);
        server.closeAllConnections();
      }),
    /** Serve new contents for these files, by path under `base`. */
    deploy: (files: Record<string, string>) => {
      for (const [file, body] of Object.entries(files))
        deployed.set(file, body);
    },
    relay,
    url: `http://localhost:${port}${base}`,
  };
};

/** The token the fake relay takes: any other gets 4401, as the app's does. */
export const RELAY_TOKEN = "e2e-token-abcdefghijk";

/** A run as the desktop app's relay sends it (follow.rs, `Snapshot`). */
export type RelayFrame = {
  game: string;
  key: string;
  value: string;
  sentAt: number;
};

/**
 * The desktop app's live follow relay (src-tauri/src/follow.rs), faked on the
 * host's own port, as the app serves the page and the stream together:
 * `GET /follow?token=…` upgraded to a WebSocket that sends the last run at
 * once, then each one `publish` gives it, and closes with the app's codes.
 */
const fakeRelay = (server: Server) => {
  const sockets = new WebSocketServer({ noServer: true });
  const viewers = new Set<WebSocket>();
  let latest: string | null = null;
  // A code every new viewer is closed with (a full relay's 4503), or none
  let refuseWith: number | null = null;

  server.on("upgrade", (request, socket, head) => {
    const { pathname, searchParams } = new URL(
      request.url ?? "/",
      "http://host",
    );
    if (pathname !== "/follow") {
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, (viewer) => {
      if (searchParams.get("token") !== RELAY_TOKEN) {
        viewer.close(4401, "token");
        return;
      }
      if (refuseWith !== null) {
        viewer.close(refuseWith, "refused");
        return;
      }
      viewers.add(viewer);
      viewer.on("close", () => viewers.delete(viewer));
      if (latest !== null) viewer.send(latest);
    });
  });

  return {
    close: () => {
      for (const viewer of viewers) viewer.terminate();
      sockets.close();
    },
    /** Every viewer's socket cut, as a network loss does (1006). */
    drop: () => {
      for (const viewer of viewers) viewer.terminate();
    },
    /** Send a run to every viewer, and keep it for those who join later. */
    publish: (frame: RelayFrame) => {
      latest = JSON.stringify(frame);
      for (const viewer of viewers) viewer.send(latest);
    },
    /** Close every new viewer with this code, or take them again (null). */
    refuse: (code: number | null) => {
      refuseWith = code;
    },
    /** Close every viewer with a code: the player stopping is 4410. */
    stop: (code = 4410) => {
      for (const viewer of viewers) viewer.close(code, "stopped");
    },
    /** How many viewers are connected. */
    viewers: () => viewers.size,
  };
};
