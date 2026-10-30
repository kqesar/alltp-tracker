// The lazy guard over a bundle of fake chunks, as Rollup hands it to
// generateBundle: a marker where a player's first download or the service
// worker's install would carry it fails the build.
import type { Rollup } from "vite";
import { describe, expect, it } from "vitest";
import { type LazyCode, lazyGuard } from "./plugin.ts";

const MARKER = "Swamp Trench 1 Approach Dry";
const LAZY: readonly LazyCode[] = [{ marker: MARKER, what: "DR's world" }];

/** A chunk of the bundle: its code and what it imports. */
const chunk = (
  fileName: string,
  code: string,
  more: Partial<Rollup.OutputChunk> = {},
): Rollup.OutputChunk =>
  ({
    code,
    dynamicImports: [],
    facadeModuleId: null,
    fileName,
    imports: [],
    isEntry: false,
    type: "chunk",
    ...more,
  }) as Rollup.OutputChunk;

/** The guard run over chunks: what it fails with, or null. */
const guard = (
  chunks: readonly Rollup.OutputChunk[],
  options: { onDemand?: RegExp; roots?: string[] } = {},
): string | null => {
  const plugin = lazyGuard({
    lazy: LAZY,
    roots: options.roots ?? ["src/games/alttpr/module.ts"],
    ...(options.onDemand === undefined ? {} : { onDemand: options.onDemand }),
  });
  const hook = plugin.generateBundle as {
    handler: (
      this: unknown,
      options: unknown,
      bundle: Rollup.OutputBundle,
    ) => void;
  };
  const bundle = Object.fromEntries(
    chunks.map((c) => [c.fileName, c]),
  ) as Rollup.OutputBundle;
  try {
    hook.handler.call(
      {
        error: (message: string) => {
          throw new Error(message);
        },
      },
      {},
      bundle,
    );
    return null;
  } catch (error) {
    return (error as Error).message;
  }
};

const ON_DEMAND = /^assets\/(review-|ondemand-)/;

describe("the lazy guard", () => {
  it("fails when the service worker would cache the lazy code at install", () => {
    const entry = chunk("assets/index-a.js", "import('./game')", {
      dynamicImports: ["assets/module-b.js"],
      isEntry: true,
    });
    const game = chunk("assets/module-b.js", "import('./door')", {
      dynamicImports: ["assets/doorWorld-c.js"],
      facadeModuleId: "/app/src/games/alttpr/module.ts",
    });
    const named = (fileName: string) =>
      chunk(fileName, `const r = "${MARKER}"`, {
        facadeModuleId: "/app/src/games/alttpr/logic/doorWorld.ts",
      });
    // Loaded on demand, but cached at install under any other name
    expect(
      guard([entry, game, named("assets/doorWorld-c.js")], {
        onDemand: ON_DEMAND,
      }),
    ).toBe(
      "DR's world is in assets/doorWorld-c.js, which the service worker caches at install: name its chunk on demand",
    );
    expect(
      guard(
        [
          entry,
          { ...game, dynamicImports: ["assets/ondemand-doorWorld-c.js"] },
          named("assets/ondemand-doorWorld-c.js"),
        ],
        { onDemand: ON_DEMAND },
      ),
    ).toBeNull();
    // Without a worker (the desktop app), only the first download counts
    expect(guard([entry, game, named("assets/doorWorld-c.js")])).toBeNull();
  });
});
