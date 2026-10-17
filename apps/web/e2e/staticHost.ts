import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";

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
  await new Promise<void>((resolve) => server.listen(0, "localhost", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    // close() alone waits for every open connection: a page still loading
    // (its service worker caching the build) would hold the test past its
    // timeout
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
    /** Serve new contents for these files, by path under `base`. */
    deploy: (files: Record<string, string>) => {
      for (const [file, body] of Object.entries(files))
        deployed.set(file, body);
    },
    url: `http://localhost:${port}${base}`,
  };
};
