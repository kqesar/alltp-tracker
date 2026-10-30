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
  const marked = (fileName: string) => chunk(fileName, `const r = "${MARKER}"`);

  it("fails when the lazy code is in the entry's static closure", () => {
    const entry = chunk("assets/index-a.js", "import './shared'", {
      imports: ["assets/shared-b.js"],
      isEntry: true,
    });
    expect(guard([entry, marked("assets/shared-b.js")])).toBe(
      "DR's world is in assets/shared-b.js, which a player downloads first: import it on demand only",
    );
    // In the entry itself
    expect(
      guard([chunk("assets/index-a.js", MARKER, { isEntry: true })]),
    ).toMatch(/in assets\/index-a\.js, which a player downloads first/);
  });

  it("fails when it is in a root module's static closure, not the entry's", () => {
    const entry = chunk("assets/index-a.js", "import('./module')", {
      dynamicImports: ["assets/module-b.js"],
      isEntry: true,
    });
    const game = chunk("assets/module-b.js", "import './rules'", {
      facadeModuleId: "/app/src/games/alttpr/module.ts",
      imports: ["assets/rules-c.js"],
    });
    expect(guard([entry, game, marked("assets/rules-c.js")])).toMatch(
      /in assets\/rules-c\.js, which a player downloads first/,
    );
    // Another game's root: not checked
    expect(
      guard([entry, game, marked("assets/rules-c.js")], {
        roots: ["src/games/sm/module.ts"],
      }),
    ).toBeNull();
  });

  it("lets it load through a dynamic import", () => {
    const entry = chunk("assets/index-a.js", "import('./door')", {
      dynamicImports: ["assets/door-b.js"],
      imports: ["assets/shared-c.js"],
      isEntry: true,
    });
    const shared = chunk("assets/shared-c.js", "export const x = 1");
    expect(guard([entry, shared, marked("assets/door-b.js")])).toBeNull();
  });

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
