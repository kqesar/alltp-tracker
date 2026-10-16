#!/usr/bin/env node
// PostToolUse hook (Edit|Write): format and lint the file just edited with
// Biome. Silent on success, so it costs no context; diagnostics Biome cannot
// fix are written to stderr with exit code 2, which Claude Code shows to Claude.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;

const file = JSON.parse(input).tool_input?.file_path;
const project = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

/** The path of `path` under `dir`, or undefined when it is outside. */
const inside = (dir, path) => {
  const rel = relative(dir, path);
  return rel === "" || rel.startsWith("..") ? undefined : rel;
};

// An agent isolated in a git worktree (.claude/worktrees/<name>) edits that
// checkout: Biome runs there, with its config. From the project root it
// would skip the file, since biome.json leaves .claude/worktrees out.
const worktrees = join(project, ".claude", "worktrees");
const worktree = file && inside(worktrees, file)?.split(sep)[0];
const root = worktree ? join(worktrees, worktree) : project;
const biome = [root, project]
  .map((dir) => join(dir, "node_modules", ".bin", "biome"))
  .find(existsSync);

// Only source files inside this repository: edits to plans, memory or
// scratch files elsewhere are none of Biome's business.
if (
  !file ||
  inside(root, file) === undefined ||
  !/\.(?:[cm]?[jt]sx?|json|css)$/.test(file) ||
  biome === undefined
) {
  process.exit(0);
}

try {
  execFileSync(
    biome,
    [
      "check",
      "--write",
      "--no-errors-on-unmatched",
      "--files-ignore-unknown=true",
      file,
    ],
    { cwd: root, stdio: "pipe" },
  );
} catch (error) {
  process.stderr.write(`${error.stdout ?? ""}${error.stderr ?? ""}`);
  process.exit(2);
}
