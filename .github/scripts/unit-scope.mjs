// Which unit tests does a pull request have to run? docs/ci.md says why.
//
//   affected  only the specs Vitest relates to the changed files through its
//             import graph (`vitest --changed`), then the coverage of the lines
//             the pull request changed (diff-coverage.mjs);
//   full      the whole suite, with the repository-wide coverage floors.
//
// The import graph sees what a spec imports. It does not see a file a spec
// reads from disk or lists with a glob, a change to how the tests are built
// or run, or a dependency: those, and any file no rule below recognises, take
// the full suite. So the rule fails safe: a doubt is `full`.
//
// Input: `git diff --name-status -z --no-renames <base> HEAD` on stdin (a
// rename is a deletion plus an addition). Output: `scope=` and `reason=`,
// also appended to $GITHUB_OUTPUT when set.
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** What changes how every test is built, resolved or run, or what they read. */
const FULL = [
  [/(^|\/)package\.json$/, "a package.json"],
  [/^pnpm-lock\.yaml$/, "the lockfile"],
  [/^pnpm-workspace\.yaml$/, "the workspace config"],
  [/(^|\/)tsconfig[^/]*\.json$/, "a tsconfig"],
  [/^biome\.jsonc?$/, "the Biome config"],
  [/(^|\/)vite[^/]*\.[cm]?[jt]s$/, "a Vite or Vitest config"],
  [/^apps\/web\/src\/test-setup\.ts$/, "the web app's test setup"],
  [/^\.github\//, "the CI itself"],
];

/** Files no spec can read. */
const INERT = [
  /\.md$/,
  /^LICENSE$/,
  /^\.(claude|vscode|husky)\//,
  /^\.(gitignore|editorconfig|commitlintrc\.json|release-please-manifest\.json)$/,
  /^release-please-config\.json$/,
  // Rust and the app's own config: its workflow (desktop.yml) tests it
  /^apps\/desktop\//,
  /^apps\/web\/index\.html$/,
];

/** Code and styles: the import graph follows a spec's imports into these. */
const GRAPH = /\.([cm]?[jt]sx?|css)$/;

/** An image or sound the app serves: a spec lists them (`import.meta.glob`). */
const PUBLIC = /^apps\/web\/public\//;

/**
 * @param {{ status: string, path: string }[]} changes
 * @returns {{ scope: "affected" | "full", reason: string }}
 */
export function classify(changes) {
  for (const { status, path } of changes) {
    const full = (reason) => ({ reason: `${reason}: ${path}`, scope: "full" });
    const rule = FULL.find(([pattern]) => pattern.test(path));
    if (rule) return full(`changes ${rule[1]}`);
    if (INERT.some((pattern) => pattern.test(path))) continue;
    if (GRAPH.test(path)) continue;
    // A binary asset's content is read by no spec, only its presence is
    if (PUBLIC.test(path) && status === "M") continue;
    if (PUBLIC.test(path)) return full("adds or removes an asset");
    if (/\.json$/.test(path)) return full("changes a JSON file specs read");
    return full("changes a file no rule recognises");
  }
  return {
    reason: "every changed file is seen by the import graph",
    scope: "affected",
  };
}

/** @param {string} raw the NUL-separated output of `git diff --name-status -z` */
export function parseNameStatus(raw) {
  const fields = raw.split("\0").filter((field) => field !== "");
  const changes = [];
  for (let i = 0; i + 1 < fields.length; i += 2) {
    changes.push({ path: fields[i + 1], status: fields[i] });
  }
  return changes;
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  // An empty diff is not "nothing to test": it is more likely a failure
  const changes = parseNameStatus(raw);
  const { scope, reason } =
    changes.length === 0
      ? { reason: "no change was listed", scope: "full" }
      : classify(changes);
  console.log(`scope=${scope}\nreason=${reason}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `scope=${scope}\nreason=${reason}\n`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
