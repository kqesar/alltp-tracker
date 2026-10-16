#!/usr/bin/env node
// PostToolUse hook (Edit|Write): format and lint the file just edited with
// Biome. Silent on success, so it costs no context; diagnostics Biome cannot
// fix are written to stderr with exit code 2, which Claude Code shows to Claude.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;

const file = JSON.parse(input).tool_input?.file_path;
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const biome = join(root, "node_modules", ".bin", "biome");

// Only source files inside this repository: edits to plans, memory or
// scratch files elsewhere are none of Biome's business.
const inRepo = file && !relative(root, file).startsWith("..");
if (
  !inRepo ||
  !/\.(?:[cm]?[jt]sx?|json|css)$/.test(file) ||
  !existsSync(biome)
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
