import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { classify, parseNameStatus } from "./unit-scope.mjs";

const modified = (...paths) => paths.map((path) => ({ path, status: "M" }));
const scopeOf = (...changes) => classify(changes).scope;

describe("classify: what runs the full suite", () => {
  it.each([
    "pnpm-lock.yaml",
    "package.json",
    "apps/web/package.json",
    "packs/alttpr/package.json",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "packs/smz3/tsconfig.json",
    "packages/autotrack/tsconfig.test.json",
    "biome.json",
    "vitest.config.ts",
    "apps/web/vitest.config.ts",
    "apps/web/vitest.shared.ts",
    "apps/web/vite.config.ts",
    "packs/sm/vitest.config.ts",
    "apps/web/src/test-setup.ts",
    ".github/workflows/ci.yml",
    ".github/scripts/unit-scope.mjs",
  ])("%s", (path) => {
    expect(classify(modified(path)).scope).toBe("full");
  });

  it("any JSON data file, which specs read from disk or import", () => {
    for (const path of [
      "packs/alttpr/test/upstream/items.json",
      "packs/alttpr/test/er-seeds/0yAObedRMV.json",
      "packs/alttpr/upstream.json",
      "packs/alttpr/src/entrances/er.json",
      "apps/web/e2e/fixtures/end-game.json",
      "apps/web/src/games/alttpr/stores/fixtures/v1-export.json",
    ]) {
      expect(classify(modified(path)).scope, path).toBe("full");
    }
  });

  it("an asset added or removed, which a spec lists with a glob", () => {
    expect(
      scopeOf({ path: "apps/web/public/assets/new.png", status: "A" }),
    ).toBe("full");
    expect(
      scopeOf({ path: "apps/web/public/assets/old.png", status: "D" }),
    ).toBe("full");
  });

  it("a file no rule recognises", () => {
    const { scope, reason } = classify(modified("packs/alttpr/test/data.bin"));
    expect(scope).toBe("full");
    expect(reason).toContain("packs/alttpr/test/data.bin");
  });

  it("one file is enough, wherever it sits in the list", () => {
    expect(
      scopeOf(
        ...modified("packages/engine/src/a.ts", "README.md", "pnpm-lock.yaml"),
        ...modified("apps/web/src/App.tsx"),
      ),
    ).toBe("full");
  });
});

describe("classify: what runs the affected specs only", () => {
  it("code and styles, which the import graph follows", () => {
    expect(
      classify(
        modified(
          "apps/web/src/App.tsx",
          "apps/web/src/styles/ui.css",
          "apps/web/sw/sw.ts",
          "packages/engine/src/solve.ts",
          "packs/alttpr/src/world.ts",
          "packs/alttpr/test/fixtures.ts",
          "packs/alttpr/scripts/import-er.mjs",
          "apps/web/e2e/map.e2e.ts",
        ),
      ).scope,
    ).toBe("affected");
  });

  it("a deleted or added code file", () => {
    expect(
      scopeOf(
        { path: "apps/web/src/old.ts", status: "D" },
        { path: "apps/web/src/new.ts", status: "A" },
      ),
    ).toBe("affected");
  });

  it("files no spec can read", () => {
    expect(
      classify(
        modified(
          "docs/ci.md",
          "README.md",
          "LICENSE",
          ".claude/rules/tests.md",
          ".gitignore",
          "release-please-config.json",
          ".release-please-manifest.json",
          "apps/desktop/src-tauri/src/lib.rs",
          "apps/desktop/src-tauri/tauri.conf.json",
          "apps/web/index.html",
          "apps/web/public/assets/chest3.png",
        ),
      ).scope,
    ).toBe("affected");
  });

  it("says why", () => {
    expect(classify(modified("apps/web/src/App.tsx")).reason).toMatch(
      /import graph/,
    );
  });
});

describe("parseNameStatus", () => {
  it("reads the NUL-separated output of git diff --name-status -z", () => {
    expect(parseNameStatus("M\0a/b.ts\0D\0c d.ts\0A\0e.json\0")).toEqual([
      { path: "a/b.ts", status: "M" },
      { path: "c d.ts", status: "D" },
      { path: "e.json", status: "A" },
    ]);
  });
});

describe("the command line", () => {
  const run = (input) =>
    execFileSync(
      "node",
      [new URL("unit-scope.mjs", import.meta.url).pathname],
      {
        encoding: "utf8",
        input,
      },
    );

  it("prints the scope and the reason", () => {
    expect(run("M\0apps/web/src/App.tsx\0")).toBe(
      "scope=affected\nreason=every changed file is seen by the import graph\n",
    );
    expect(run("M\0pnpm-lock.yaml\0")).toContain("scope=full\n");
  });

  it("falls back to the full suite when git listed nothing", () => {
    expect(run("")).toContain("scope=full\n");
  });
});
