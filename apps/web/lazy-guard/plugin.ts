import { sep } from "node:path";
import type { Plugin } from "vite";

/** Code some players alone download, told by a string only it holds. */
export interface LazyCode {
  /** A string of that code's data, which minifying keeps. */
  readonly marker: string;
  /** What the code is, for the error. */
  readonly what: string;
  /**
   * Lazy code that must never load with this one: none of it in the static
   * closure of any chunk that brings this code (the Overworld Randomizer's
   * world never downloads the Door Randomizer's own data).
   */
  readonly apart?: readonly LazyCode[];
}

/**
 * Fails the build when code meant to load on demand lands in what a player
 * downloads first: the closure of static imports from the page's entry and
 * from each root module (a game's), dynamic imports left out; or, given
 * the service worker's `onDemand` pattern, in a file the worker caches at
 * install (it caches whatever a game's module reaches, dynamic imports
 * included). The Door Randomizer's world (its region graph, its rules, its
 * key analysis) is such code: only a DR run loads it
 * (hooks/useDoorLogic.ts), and an import from the wrong module, or a chunk
 * named as any other, would put about 1.2 MB of it in every ALttPR
 * player's download without a test noticing.
 * @param roots - The modules whose static closure is checked beside the
 *   entry, by their path's end ("src/games/alttpr/module.ts")
 * @param onDemand - The files the service worker caches only once fetched
 */
export function lazyGuard({
  roots,
  lazy,
  onDemand,
}: {
  roots: readonly string[];
  lazy: readonly LazyCode[];
  onDemand?: RegExp;
}): Plugin {
  return {
    apply: "build",
    generateBundle: {
      handler(_options, bundle) {
        const chunks = new Map(
          Object.values(bundle).flatMap((output) =>
            output.type === "chunk" ? [[output.fileName, output] as const] : [],
          ),
        );
        /** A chunk and every chunk it imports statically, by name. */
        const closureOf = (start: string): Set<string> => {
          const found = new Set<string>();
          for (const names = [start]; names.length > 0; ) {
            const name = names.pop() as string;
            if (found.has(name)) continue;
            found.add(name);
            names.push(...(chunks.get(name)?.imports ?? []));
          }
          return found;
        };
        const holds = (names: Set<string>, marker: string) =>
          [...names].find((name) => chunks.get(name)?.code.includes(marker));
        for (const { marker, what, apart = [] } of lazy) {
          if (apart.length === 0) continue;
          for (const name of chunks.keys()) {
            const loaded = closureOf(name);
            if (holds(loaded, marker) === undefined) continue;
            for (const other of apart) {
              const with_ = holds(loaded, other.marker);
              if (with_ !== undefined)
                this.error(
                  `${other.what} is in ${with_}, which loads with ${what} (from ${name}): keep them apart`,
                );
            }
          }
        }
        const starts = [...chunks.values()]
          .filter(
            (chunk) =>
              chunk.isEntry ||
              roots.some((root) =>
                chunk.facadeModuleId?.split(sep).join("/").endsWith(root),
              ),
          )
          .map((chunk) => chunk.fileName);
        const reached = new Set<string>();
        for (let name = starts.pop(); name; name = starts.pop()) {
          if (reached.has(name)) continue;
          reached.add(name);
          starts.push(...(chunks.get(name)?.imports ?? []));
        }
        for (const name of reached) {
          const code = chunks.get(name)?.code ?? "";
          for (const { marker, what } of lazy) {
            if (code.includes(marker))
              this.error(
                `${what} is in ${name}, which a player downloads first: import it on demand only`,
              );
          }
        }
        if (onDemand === undefined) return;
        for (const [name, chunk] of chunks) {
          if (onDemand.test(name)) continue;
          for (const { marker, what } of lazy) {
            if (chunk.code.includes(marker))
              this.error(
                `${what} is in ${name}, which the service worker caches at install: name its chunk on demand`,
              );
          }
        }
      },
    },
    name: "lazy-guard",
  };
}
