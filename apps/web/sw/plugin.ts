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
const GAMES_PLACEHOLDER = "__GAMES__";
const ON_DEMAND_PLACEHOLDER = "__ON_DEMAND__";
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
 *
 * Files only some players use stay out of what every install downloads:
 * those `onDemand` matches are cached the first time a page fetches them
 * (voice commands' engine), those `uncached` matches never (the speech
 * model, which the engine keeps itself).
 *
 * Each game is a chunk of its own that a player of another game never loads
 * (src/games/registry.ts), so its files stay out of the shared shell too: the
 * worker caches the shell, and the games a device tracks. A game's files are
 * what its module reaches (its imports, its lazy chunks, its styles, what
 * they reference) that the shell does not need anyway, plus the public files
 * its `files` pattern claims. A file two games share is listed under both.
 * Whatever no game claims is shell: a file that escapes these rules is
 * downloaded for everyone, never missing for a player.
 * @param options - Paths relative to the output, as patterns
 */
export const serviceWorker = ({
  games = {},
  onDemand,
  uncached,
}: {
  /** Each game by id: its module's source path and its public files */
  games?: Record<string, { files?: RegExp; module: string }>;
  onDemand?: RegExp;
  uncached?: RegExp;
} = {}): Plugin => {
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
        const published = new Set<string>();
        if (publicDir) {
          for (const { name, path } of filesIn(publicDir)) {
            files.set(name, readFileSync(path));
            published.add(name);
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

        const listed = (names: string[]) =>
          revisions(names).map(([name, revision]) => [
            `${base}${name}`,
            revision,
          ]);
        const names = [...files.keys()]
          .filter((name) => !uncached?.test(name))
          .sort();

        // The files each game alone needs: everything its module reaches
        // that the shell, the page's own closure, does not
        const neighbours = (name: string) => {
          const output = bundle[name];
          if (output?.type !== "chunk") return [];
          return [
            ...output.imports,
            ...output.dynamicImports,
            ...(output.viteMetadata?.importedCss ?? []),
            ...(output.viteMetadata?.importedAssets ?? []),
          ];
        };
        const reach = (roots: string[], outside: ReadonlySet<string>) => {
          const reached = new Set<string>();
          const pending = [...roots];
          for (let name = pending.pop(); name; name = pending.pop()) {
            if (reached.has(name) || outside.has(name)) continue;
            reached.add(name);
            pending.push(...neighbours(name));
          }
          return reached;
        };
        const moduleOf = new Map(
          Object.entries(games).map(([id, { module }]) => {
            const chunk = Object.values(bundle).find(
              (output) =>
                output.type === "chunk" &&
                output.facadeModuleId?.split(sep).join("/").endsWith(module),
            );
            if (!chunk) this.error(`game ${id}: no chunk for ${module}`);
            return [id, chunk.fileName];
          }),
        );
        const entries = Object.values(bundle)
          .filter(
            (output) =>
              output.type === "chunk" &&
              output.isEntry &&
              output.fileName !== SW_FILE,
          )
          .map((output) => output.fileName);
        const shell = reach(entries, new Set(moduleOf.values()));
        const ofGame = new Map(
          Object.entries(games).map(([id, { files: publicFiles }]) => [
            id,
            new Set([
              ...reach([moduleOf.get(id) ?? ""], shell),
              ...names.filter(
                (name) =>
                  published.has(name) &&
                  publicFiles?.test(name) &&
                  !shell.has(name),
              ),
            ]),
          ]),
        );
        const claimed = new Set(
          [...ofGame.values()].flatMap((set) => [...set]),
        );
        const cached = (name: string) => !onDemand?.test(name);
        const precache = listed(
          names.filter((name) => cached(name) && !claimed.has(name)),
        );
        const gameFiles = Object.fromEntries(
          [...ofGame].map(([id, set]) => [
            id,
            listed(names.filter((name) => cached(name) && set.has(name))),
          ]),
        );
        const lazy = listed(names.filter((name) => !cached(name)));
        const worker = bundle[SW_FILE];
        if (worker?.type !== "chunk") this.error(`${SW_FILE} was not built`);
        const values: [string, unknown][] = [
          [PRECACHE_PLACEHOLDER, precache],
          [GAMES_PLACEHOLDER, gameFiles],
          [ON_DEMAND_PLACEHOLDER, lazy],
          [BUILD_PLACEHOLDER, build],
        ];
        for (const [placeholder, value] of values) {
          worker.code = fill(worker.code, placeholder, JSON.stringify(value));
        }

        const kilobytes = (list: string[][]) =>
          (
            list.reduce(
              (total, [path]) =>
                total +
                Buffer.byteLength(files.get(path.slice(base.length)) ?? ""),
              0,
            ) / 1000
          ).toFixed(0);
        log(
          `${SW_FILE}: build ${build}, shell ${precache.length} files, ${kilobytes(precache)} kB; ${lazy.length} on demand`,
        );
        for (const [id, list] of Object.entries(gameFiles)) {
          log(
            `${SW_FILE}: game ${id} adds ${list.length} files, ${kilobytes(list)} kB`,
          );
        }
      },
      // After Vite has written index.html into the bundle
      order: "post",
    },
    name: "alltp:service-worker",
  };
};
