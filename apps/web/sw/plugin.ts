import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Plugin } from "vite";

/** Where the worker is served: the base path, so its scope is the whole app. */
const SW_FILE = "sw.js";

/** The identifier in sw.ts that the precache list replaces. */
const PLACEHOLDER = "__PRECACHE__";

/** Hex digits of SHA-256 kept as a file's revision: 64 bits. */
const REVISION_LENGTH = 16;

const revisionOf = (content: string | Uint8Array) =>
  createHash("sha256").update(content).digest("hex").slice(0, REVISION_LENGTH);

/** Every file of a directory, by its path relative to it, dotfiles left out. */
const filesIn = (directory: string) =>
  readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => join(entry.parentPath, entry.name))
    .map((path) => ({
      name: relative(directory, path).split(sep).join("/"),
      path,
    }));

/**
 * Builds the service worker (sw/sw.ts) into `sw.js` at the root of the
 * output, then writes into it the list of every other file the build ships,
 * bundle and public directory alike, each with a hash of its content. The
 * worker's bytes thus change exactly when a shipped file does, which is what
 * makes the browser install a new version: there is no version to bump.
 * Production builds only; the dev server runs without a worker.
 */
export const serviceWorker = (): Plugin => {
  let base = "/";
  let publicDir: string | false = false;
  let log: (message: string) => void = () => {};

  return {
    apply: "build",
    buildStart() {
      this.emitFile({
        fileName: SW_FILE,
        id: join(import.meta.dirname, "sw.ts"),
        type: "chunk",
      });
    },
    configResolved(config) {
      base = config.base;
      publicDir = config.build.copyPublicDir && config.publicDir;
      log = (message) => config.logger.info(message);
    },
    generateBundle: {
      handler(_options, bundle) {
        const files = new Map<string, string | Uint8Array>();
        for (const output of Object.values(bundle)) {
          if (output.fileName === SW_FILE) continue;
          files.set(
            output.fileName,
            output.type === "chunk" ? output.code : output.source,
          );
        }
        if (publicDir) {
          for (const { name, path } of filesIn(publicDir)) {
            files.set(name, readFileSync(path));
          }
        }
        if (!files.has("index.html")) {
          this.error("index.html is not in the bundle yet: nothing to serve");
        }

        const precache = [...files.keys()]
          .sort()
          .map((name) => [`${base}${name}`, revisionOf(files.get(name) ?? "")]);

        const worker = bundle[SW_FILE];
        if (worker?.type !== "chunk") this.error(`${SW_FILE} was not built`);
        const parts = worker.code.split(PLACEHOLDER);
        if (parts.length !== 2) {
          this.error(`${SW_FILE} must use ${PLACEHOLDER} exactly once`);
        }
        worker.code = parts.join(JSON.stringify(precache));

        const bytes = [...files.values()].reduce(
          (total, content) => total + Buffer.byteLength(content),
          0,
        );
        log(
          `${SW_FILE}: precaches ${precache.length} files, ${(bytes / 1000).toFixed(0)} kB`,
        );
      },
      // After Vite has written index.html into the bundle
      order: "post",
    },
    name: "alltp:service-worker",
  };
};
