// Checks that what the Markdown files point at still exists: relative links
// and their #anchors, and the repository paths quoted in backticks. It reads
// no description, so a doc that stopped being true still passes (CLAUDE.md,
// "Quality bar"); it catches the most common cause of a false doc, a file
// that moved or was deleted. Plain Node, no dependency.
//
//   node scripts/check-docs.mjs      prints `file:line message`, exit 1 if any
//
// Scope: every git-tracked .md file but the changelog (release-please writes
// it, and it quotes history). Fenced code blocks are skipped: they hold
// trees and commands, not claims. Setext headings (underlined with === or
// ---) are not read as anchors; the docs use ATX (#) headings only.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** The top-level folders whose paths a doc may quote in backticks. */
const REPO_PREFIXES = [
  "apps/",
  "packages/",
  "packs/",
  "docs/",
  ".github/",
  "scripts/",
  ".claude/",
];

/** Replace every character but newlines, so offsets and lines survive. */
const blank = (text) => text.replace(/[^\n]/g, " ");

/**
 * The text with its fenced code blocks blanked out.
 * @param {string} text
 */
export const maskFences = (text) => {
  const out = [];
  let fence = null;
  for (const line of text.split("\n")) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) {
        fence = null;
      }
      out.push(blank(line));
    } else if (marker) {
      fence = marker;
      out.push(blank(line));
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
};

/**
 * Inline code spans: [{ start, end, content }] for a text whose fences are
 * already masked. A span opens with a run of backticks and closes with a run
 * of the same length, on the same line.
 * @param {string} text
 */
export const codeSpans = (text) => {
  const spans = [];
  let offset = 0;
  for (const line of text.split("\n")) {
    const re = /(`+)/g;
    let open;
    // biome-ignore lint/suspicious/noAssignInExpressions: the usual regex loop
    while ((open = re.exec(line))) {
      const close = line.indexOf(open[1], re.lastIndex);
      let end = close;
      // A longer run is not a closer: look for a run of exactly this length
      while (end !== -1 && line[end + open[1].length] === "`") {
        end = line.indexOf(open[1], end + open[1].length + 1);
      }
      if (end === -1) continue;
      spans.push({
        content: line.slice(re.lastIndex, end),
        end: offset + end + open[1].length,
        start: offset + open.index,
      });
      re.lastIndex = end + open[1].length;
    }
    offset += line.length + 1;
  }
  return spans;
};

/**
 * The text with its inline code spans blanked, so a link in a code sample is
 * not read as a link.
 * @param {string} text
 */
const maskSpans = (text) => {
  let masked = text;
  for (const { start, end } of codeSpans(text)) {
    masked =
      masked.slice(0, start) +
      blank(masked.slice(start, end)) +
      masked.slice(end);
  }
  return masked;
};

/**
 * The anchor GitHub gives a heading: lowercased, anything but letters,
 * marks, numbers, `_`, `-` and spaces dropped, spaces turned into `-`
 * (github-slugger). Markup is rendered first: a link keeps its text, a code
 * span its content, emphasis marks and HTML tags go.
 * @param {string} heading - A heading's Markdown
 */
export const slugify = (heading) =>
  heading
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/(`+)(.+?)\1/g, "$2")
    .replace(/\*+/g, "")
    .replace(/(^|[\s(])_+([^_]+?)_+(?=$|[\s).,:;!?])/g, "$1$2")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
    .replace(/ /g, "-");

/**
 * Every anchor a Markdown text offers: its headings' slugs (a repeated
 * heading gets -1, -2… as GitHub numbers them) and explicit HTML ids.
 * @param {string} text
 * @returns {Set<string>}
 */
export const anchorsOf = (text) => {
  const anchors = new Set();
  const seen = new Map();
  const masked = maskFences(text);
  for (const line of masked.split("\n")) {
    const heading = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (!heading) continue;
    const slug = slugify(heading[1]);
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    anchors.add(count === 0 ? slug : `${slug}-${count}`);
  }
  for (const id of masked.matchAll(/\b(?:id|name)="([^"]+)"/g)) {
    anchors.add(id[1].toLowerCase());
  }
  return anchors;
};

/** The 1-based line of an offset. */
const lineAt = (text, offset) => {
  let line = 1;
  for (let i = 0; i < offset; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
};

/**
 * The link targets of a Markdown text, outside code: inline and image links,
 * reference definitions and HTML href / src attributes.
 * @param {string} text
 * @returns {{ target: string, line: number }[]}
 */
export const linkTargets = (text) => {
  const masked = maskSpans(maskFences(text));
  const found = [];
  const add = (target, offset) =>
    found.push({ line: lineAt(text, offset), target });
  for (const m of masked.matchAll(
    /\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g,
  )) {
    add(m[1], m.index);
  }
  for (const m of masked.matchAll(
    /^ {0,3}\[[^\]\n]+\]:[ \t]+<?([^\s>]+)>?/gm,
  )) {
    add(m[1], m.index);
  }
  for (const m of masked.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    add(m[1], m.index);
  }
  return found;
};

/**
 * The repository paths a text quotes in backticks: a code span that starts
 * with one of the repository's top-level folders. A trailing `:line` is
 * dropped; a span with a glob or a placeholder is no path.
 * @param {string} text
 * @returns {{ path: string, line: number }[]}
 */
export const quotedPaths = (text) => {
  const masked = maskFences(text);
  const found = [];
  for (const { content, start } of codeSpans(masked)) {
    let path = content.trim().split(/\s+/)[0] ?? "";
    if (!REPO_PREFIXES.some((prefix) => path.startsWith(prefix))) continue;
    if (/[*<>{}$…]|\.\.\./.test(path)) continue;
    path = path
      .replace(/#.*$/, "")
      .replace(/:\d+(?:[-,]\d+)*$/, "")
      .replace(/[.,;:)]+$/, "");
    found.push({ line: lineAt(text, start), path });
  }
  return found;
};

/**
 * @param {string} root - The repository root
 * @returns {string[]} The checked Markdown files, relative to the root
 */
export const markdownFiles = (root) =>
  execFileSync("git", ["ls-files", "-z", "--", "*.md"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)
    .filter((file) => !file.split("/").includes("node_modules"))
    .filter((file) => file.split("/").pop() !== "CHANGELOG.md")
    .filter((file) => existsSync(join(root, file)));

/** Whether git ignores a path (a build output the docs may name). */
const isIgnored = (root, path) => {
  try {
    execFileSync("git", ["check-ignore", "-q", "--", path], { cwd: root });
    return true;
  } catch {
    return false;
  }
};

/**
 * Every failure of the Markdown files under a root.
 * @param {string} root - The repository root
 * @returns {string[]} `file:line message`, one per failure
 */
export const checkDocs = (root) => {
  const failures = [];
  const anchorCache = new Map();
  const anchorsIn = (file) => {
    if (!anchorCache.has(file)) {
      anchorCache.set(file, anchorsOf(readFileSync(join(root, file), "utf8")));
    }
    return anchorCache.get(file);
  };

  for (const file of markdownFiles(root)) {
    const text = readFileSync(join(root, file), "utf8");
    const fail = (line, message) => failures.push(`${file}:${line} ${message}`);

    for (const { target, line } of linkTargets(text)) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) continue;
      const [rawPath, rawAnchor] = target.split("#");
      let path;
      try {
        path = decodeURIComponent(rawPath);
      } catch {
        path = rawPath;
      }
      const anchor =
        rawAnchor === undefined ? null : decodeURIComponent(rawAnchor);
      // A leading slash is the repository's root, as on GitHub
      const resolved =
        path === ""
          ? file
          : relative(
              root,
              path.startsWith("/")
                ? resolve(root, `.${path}`)
                : resolve(root, dirname(file), path),
            )
              .split(sep)
              .join("/");
      if (resolved.startsWith("..")) {
        fail(line, `link ${target} leaves the repository`);
        continue;
      }
      if (!existsSync(join(root, resolved))) {
        if (!isIgnored(root, resolved)) {
          fail(line, `link ${target} points at a missing file`);
        }
        continue;
      }
      if (
        anchor &&
        resolved.endsWith(".md") &&
        statSync(join(root, resolved)).isFile() &&
        !anchorsIn(resolved).has(anchor.toLowerCase())
      ) {
        fail(
          line,
          `link ${target} has no heading ${JSON.stringify(anchor)} in ${resolved}`,
        );
      }
    }

    for (const { path, line } of quotedPaths(text)) {
      const clean = normalize(path).split(sep).join("/");
      if (existsSync(join(root, clean)) || isIgnored(root, clean)) continue;
      fail(line, `\`${path}\` does not exist`);
    }
  }
  return failures;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const failures = checkDocs(root);
  for (const failure of failures) console.log(failure);
  if (failures.length > 0) {
    console.error(`${failures.length} broken reference(s) in the docs`);
    process.exit(1);
  }
}
