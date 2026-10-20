// Coverage of the lines a pull request changed, from the v8 report of an
// affected-only unit run and `git diff`. docs/ci.md says why, and where the
// floor comes from.
//
// A partial run cannot meet the repository-wide floors (they measure files no
// selected spec loads), so a pull request answers a narrower question: of the
// executable lines it adds or edits in source files, how many did the specs
// that ran execute? Vitest's report (coverage-final.json, Istanbul's format)
// holds each statement's span and hit count; a changed line is judged by the
// innermost statement that spans it, and a line no statement spans (a
// comment, a type, a blank) is not executable and counts for nothing.
//
//   node diff-coverage.mjs <base> [report]   (run from the repository root)
//
// Exit 1 below the floor. Prints `escalate`, `pct` and `lines` too (and
// appends them to $GITHUB_OUTPUT when set). `escalate=true` means a changed
// source file is missing from the report: no selected spec loaded it, so this
// run proves nothing about it and the full suite must run instead (code only
// reachable through a dynamic import, or code no spec imports, such as one
// that holds types only).
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Percentage of changed executable lines the specs that ran must execute. */
export const FLOOR = 90;

/**
 * The files vitest.config.ts measures (`coverage.include`, minus
 * `coverage.exclude`): diff-coverage.spec.mjs holds this copy to it.
 */
const SOURCE = [
  /^apps\/web\/src\/.+\.tsx?$/,
  /^packages\/[^/]+\/src\/.+\.ts$/,
  /^packs\/[^/]+\/src\/.+\.ts$/,
];
const EXCLUDED = [
  /\.d\.ts$/,
  /\.spec\.tsx?$/,
  /^apps\/web\/src\/main\.tsx$/,
  /^apps\/web\/src\/test-setup\.ts$/,
];

export const isSource = (path) =>
  SOURCE.some((pattern) => pattern.test(path)) &&
  !EXCLUDED.some((pattern) => pattern.test(path));

/**
 * The lines each file gained or changed, from `git diff -U0`.
 * @param {string} diff
 * @returns {Map<string, Set<number>>}
 */
export function addedLines(diff) {
  const files = new Map();
  let lines = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      const path = line.slice(4);
      lines = path === "/dev/null" ? null : new Set();
      if (lines) files.set(path.replace(/^b\//, ""), lines);
      continue;
    }
    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && lines) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      for (let n = start; n < start + count; n++) lines.add(n);
    }
  }
  return files;
}

/**
 * Was this line executed? `undefined` when it is not executable.
 * @param {{ statementMap: Record<string, { start: { line: number }, end: { line: number } }>, s: Record<string, number> }} file
 */
export function lineHit(file, line) {
  let innermost = null;
  for (const [id, { start, end }] of Object.entries(file.statementMap)) {
    if (start.line > line || end.line < line) continue;
    const span = end.line - start.line;
    if (!innermost || span < innermost.span) innermost = { id, span };
  }
  return innermost ? file.s[innermost.id] > 0 : undefined;
}

/**
 * @param {Map<string, Set<number>>} added
 * @param {Record<string, any>} report coverage-final.json, by repo-relative path
 */
export function measure(added, report) {
  let total = 0;
  let covered = 0;
  const uncovered = new Map();
  const unloaded = [];
  for (const [path, lines] of added) {
    if (!isSource(path)) continue;
    const file = report[path];
    if (!file) {
      unloaded.push(path);
      continue;
    }
    for (const line of [...lines].sort((a, b) => a - b)) {
      const hit = lineHit(file, line);
      if (hit === undefined) continue;
      total++;
      if (hit) covered++;
      else uncovered.set(path, [...(uncovered.get(path) ?? []), line]);
    }
  }
  const pct = total === 0 ? 100 : (covered / total) * 100;
  return { covered, pct, total, uncovered, unloaded };
}

/** Vitest keys its report by absolute path. */
const byRelativePath = (report, root) =>
  Object.fromEntries(
    Object.entries(report).map(([path, file]) => [
      relative(root, path).split("\\").join("/"),
      file,
    ]),
  );

function main() {
  const [base, reportPath = "coverage/coverage-final.json"] =
    process.argv.slice(2);
  if (!base) throw new Error("usage: diff-coverage.mjs <base> [report]");
  const root = process.cwd();
  const diff = execFileSync(
    "git",
    ["diff", "-U0", "--no-renames", "--diff-filter=AM", base, "HEAD"],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  const report = existsSync(reportPath)
    ? byRelativePath(JSON.parse(readFileSync(reportPath, "utf8")), root)
    : {};
  const { covered, pct, total, uncovered, unloaded } = measure(
    addedLines(diff),
    report,
  );
  const floor = Number(process.env.DIFF_COVERAGE_FLOOR ?? FLOOR);
  const escalate = unloaded.length > 0;
  const summary = `${pct.toFixed(1)}% (${covered}/${total} changed lines)`;

  if (escalate) {
    console.log(
      `No selected spec loaded ${unloaded.join(", ")}: the full suite must run.`,
    );
  } else {
    console.log(`Diff coverage ${summary}, floor ${floor}%.`);
  }
  for (const [path, lines] of uncovered) {
    for (const line of lines) {
      console.log(
        `::error file=${path},line=${line}::Changed line not covered`,
      );
    }
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `escalate=${escalate}\npct=${pct.toFixed(1)}\nlines=${covered}/${total}\n`,
    );
  }
  if (!escalate && pct < floor) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main();
}
