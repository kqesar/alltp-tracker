import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Plugin } from "vite";

/** Where the worker is served: the base path, so its scope is the whole app. */
const SW_FILE = "sw.js";

/** The page, which carries its build id for the page's code to read. */
const PAGE_FILE = "index.html";

/** The meta tag naming the build a page belongs to (read by main.tsx). */
const BUILD_META = "alltp-tracker-build";

/** Identifiers in sw.ts that the build fills in. */
const PRECACHE_PLACEHOLDER = "__PRECACHE__";
const BUILD_PLACEHOLDER = "__BUILD__";

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
 *
 * The build also gets an id, a hash of all those files: written into the
 * worker and into index.html, it tells a page whether a waiting worker is a
 * version it does not run yet. Production builds only; the dev server runs
 * without a worker.
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
        /** Put a value in place of a placeholder that must occur once. */
        const fill = (code: string, placeholder: string, value: string) => {
          const parts = code.split(placeholder);
          if (parts.length !== 2) {
            this.error(`${SW_FILE} must use ${placeholder} exactly once`);
          }
          return parts.join(value);
        };

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
        const page = bundle[PAGE_FILE];
        if (page?.type !== "asset" || typeof page.source !== "string") {
          this.error(`${PAGE_FILE} is not in the bundle yet: nothing to serve`);
        }

        // The id covers every file as built, the page before it carries it
        const revisions = (names: string[]) =>
          names.map((name) => [name, revisionOf(files.get(name) ?? "")]);
        const build = revisionOf(
          JSON.stringify(revisions([...files.keys()].sort())),
        );
        const marked = page.source.replace(
          "</head>",
          `  <meta content="${build}" name="${BUILD_META}" />\n  </head>`,
        );
        if (marked === page.source) this.error(`${PAGE_FILE} has no </head>`);
        page.source = marked;
        files.set(PAGE_FILE, marked);

        const precache = revisions([...files.keys()].sort()).map(
          ([name, revision]) => [`${base}${name}`, revision],
        );
        const worker = bundle[SW_FILE];
        if (worker?.type !== "chunk") this.error(`${SW_FILE} was not built`);
        worker.code = fill(
          fill(worker.code, PRECACHE_PLACEHOLDER, JSON.stringify(precache)),
          BUILD_PLACEHOLDER,
          JSON.stringify(build),
        );

        const bytes = [...files.values()].reduce(
          (total, content) => total + Buffer.byteLength(content),
          0,
        );
        log(
          `${SW_FILE}: build ${build}, precaches ${precache.length} files, ${(bytes / 1000).toFixed(0)} kB`,
        );
      },
      // After Vite has written index.html into the bundle
      order: "post",
    },
    name: "alltp:service-worker",
  };
};
