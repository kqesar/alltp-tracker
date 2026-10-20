import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import config from "../../vitest.config.ts";
import { addedLines, isSource, lineHit, measure } from "./diff-coverage.mjs";

const at = (line, endLine = line) => ({
  end: { line: endLine },
  start: { line },
});

describe("isSource", () => {
  it("holds the same files as the coverage config of vitest.config.ts", () => {
    // isSource is a copy of these two lists: when one changes, so does the other
    expect(config.test.coverage.include).toEqual([
      "apps/web/src/**/*.{ts,tsx}",
      "packages/*/src/**/*.ts",
      "packs/*/src/**/*.ts",
    ]);
    expect(config.test.coverage.exclude).toEqual([
      "**/*.d.ts",
      "**/*.spec.{ts,tsx}",
      "apps/web/src/main.tsx",
      "apps/web/src/test-setup.ts",
    ]);
  });

  it("accepts the code the tests measure", () => {
    for (const path of [
      "apps/web/src/App.tsx",
      "apps/web/src/games/sm/store.ts",
      "packages/engine/src/solve.ts",
      "packs/alttpr/src/regions/open/ganons-tower.ts",
    ]) {
      expect(isSource(path), path).toBe(true);
    }
  });

  it("rejects specs, declarations, entry points and everything else", () => {
    for (const path of [
      "apps/web/src/App.spec.tsx",
      "apps/web/src/vite-env.d.ts",
      "apps/web/src/main.tsx",
      "apps/web/src/test-setup.ts",
      "apps/web/e2e/map.e2e.ts",
      "apps/web/sw/sw.ts",
      "packs/alttpr/test/fixtures.ts",
      "packs/alttpr/scripts/import-er.mjs",
      "packages/engine/examples/a.ts",
      "apps/web/src/styles/ui.css",
      ".github/scripts/diff-coverage.mjs",
    ]) {
      expect(isSource(path), path).toBe(false);
    }
  });
});

describe("addedLines", () => {
  const diff = [
    "diff --git a/src/a.ts b/src/a.ts",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -3 +3,2 @@ context",
    "-old",
    "+new",
    "+another",
    "@@ -10,2 +11,0 @@",
    "-gone",
    "-gone too",
    "@@ -20,0 +20 @@",
    "+single",
    "diff --git a/src/gone.ts b/src/gone.ts",
    "--- a/src/gone.ts",
    "+++ /dev/null",
    "@@ -1,2 +0,0 @@",
    "-x",
    "-y",
    "diff --git a/src/b.ts b/src/b.ts",
    "--- /dev/null",
    "+++ b/src/b.ts",
    "@@ -0,0 +1,3 @@",
    "+1",
    "+2",
    "+3",
  ].join("\n");

  it("lists the lines a hunk adds or changes, per file", () => {
    const added = addedLines(diff);
    expect([...added.get("src/a.ts")]).toEqual([3, 4, 20]);
    expect([...added.get("src/b.ts")]).toEqual([1, 2, 3]);
  });

  it("ignores a hunk that only removes lines, and a deleted file", () => {
    const added = addedLines(diff);
    expect(added.get("src/a.ts").has(11)).toBe(false);
    expect(added.has("src/gone.ts")).toBe(false);
  });
});

describe("lineHit", () => {
  const file = {
    s: { 0: 1, 1: 0, 2: 3, 3: 0 },
    statementMap: {
      // a call over lines 1-6 ...
      0: at(1, 6),
      // ... whose callback runs a statement on line 3 (never executed) ...
      1: at(3),
      // ... and one on line 4 (executed)
      2: at(4),
      3: at(8),
    },
  };

  it("judges a line by the innermost statement that spans it", () => {
    expect(lineHit(file, 3)).toBe(false);
    expect(lineHit(file, 4)).toBe(true);
    expect(lineHit(file, 8)).toBe(false);
  });

  it("falls back on the enclosing statement for a continuation line", () => {
    expect(lineHit(file, 2)).toBe(true);
    expect(lineHit(file, 6)).toBe(true);
  });

  it("is undefined for a line no statement spans", () => {
    expect(lineHit(file, 7)).toBeUndefined();
    expect(lineHit(file, 100)).toBeUndefined();
  });
});

describe("measure", () => {
  const report = {
    "packs/alttpr/src/a.ts": {
      s: { 0: 5, 1: 0 },
      statementMap: { 0: at(1), 1: at(2) },
    },
  };
  const added = (path, ...lines) => new Map([[path, new Set(lines)]]);

  it("counts executable changed lines, and the ones that ran", () => {
    // line 3 is not executable (a comment, a type): it counts for nothing
    const result = measure(added("packs/alttpr/src/a.ts", 1, 2, 3), report);
    expect(result.total).toBe(2);
    expect(result.covered).toBe(1);
    expect(result.pct).toBe(50);
    expect(result.uncovered.get("packs/alttpr/src/a.ts")).toEqual([2]);
  });

  it("is complete when no executable line changed", () => {
    expect(measure(added("packs/alttpr/src/a.ts", 3), report).pct).toBe(100);
    expect(measure(new Map(), {}).pct).toBe(100);
  });

  it("ignores files that are not source", () => {
    const result = measure(added("apps/web/src/a.spec.tsx", 1, 2), {});
    expect(result.total).toBe(0);
    expect(result.unloaded).toEqual([]);
  });

  it("reports a changed source file no spec loaded", () => {
    const result = measure(added("packs/alttpr/src/never.ts", 1), report);
    expect(result.unloaded).toEqual(["packs/alttpr/src/never.ts"]);
    expect(result.total).toBe(0);
  });
});

describe("the command line, on a real repository", () => {
  const script = new URL("diff-coverage.mjs", import.meta.url).pathname;
  const root = mkdtempSync(join(tmpdir(), "diff-coverage-"));
  const git = (...args) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=t",
        "-c",
        "user.email=t@t",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      {
        cwd: root,
      },
    );
  const file = "packs/alttpr/src/a.ts";
  afterAll(() => rmSync(root, { force: true, recursive: true }));

  // A base commit, then a commit that rewrites lines 2 to 4 of a source file
  mkdirSync(join(root, "packs/alttpr/src"), { recursive: true });
  git("init", "-q");
  writeFileSync(join(root, file), "a\nb\nc\nd\n");
  git("add", "-A");
  git("commit", "-qm", "base");
  writeFileSync(join(root, file), "a\nB\nC\nD\n");
  writeFileSync(join(root, "README.md"), "docs\n");
  git("add", "-A");
  git("commit", "-qm", "change");

  /** Vitest keys its report by absolute path; one statement per line. */
  const report = (hits) =>
    JSON.stringify({
      [join(root, file)]: {
        s: hits,
        statementMap: Object.fromEntries(
          [1, 2, 3, 4].map((line) => [line - 1, at(line)]),
        ),
      },
    });
  const run = (coverage, floor) => {
    writeFileSync(join(root, "coverage.json"), coverage);
    return spawnSync("node", [script, "HEAD~1", "coverage.json"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, DIFF_COVERAGE_FLOOR: floor, GITHUB_OUTPUT: "" },
    });
  };

  it("passes when the changed lines ran", () => {
    const result = run(report({ 0: 1, 1: 1, 2: 1, 3: 1 }), "90");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("100.0% (3/3 changed lines)");
  });

  it("fails below the floor and names the lines", () => {
    const result = run(report({ 0: 1, 1: 1, 2: 0, 3: 0 }), "90");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("33.3% (1/3 changed lines)");
    expect(result.stdout).toContain(`::error file=${file},line=3::`);
    expect(result.stdout).toContain(`::error file=${file},line=4::`);
  });

  it("accepts a coverage at the floor", () => {
    expect(run(report({ 0: 1, 1: 1, 2: 0, 3: 0 }), "33").status).toBe(0);
  });

  it("asks for the full suite when no spec loaded the changed file", () => {
    const result = run("{}", "90");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`No selected spec loaded ${file}`);
  });
});
