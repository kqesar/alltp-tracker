import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  anchorsOf,
  checkDocs,
  codeSpans,
  linkTargets,
  quotedPaths,
  slugify,
} from "./check-docs.mjs";

describe("slugify", () => {
  it.each([
    ["A Link to the Past", "a-link-to-the-past"],
    ["SMZ3 (samus.link)", "smz3-samuslink"],
    ["Super Metroid (Map Rando)", "super-metroid-map-rando"],
    ["Offline and install", "offline-and-install"],
    ["The entrance randomizer's world", "the-entrance-randomizers-world"],
    ["`pnpm check:docs` and **bold**", "pnpm-checkdocs-and-bold"],
    ["[Linked](x.md) text", "linked-text"],
    ["What a check → misses", "what-a-check--misses"],
    ["Snake_case and _emphasis_", "snake_case-and-emphasis"],
    ["Café déjà", "café-déjà"],
  ])("%s -> %s", (heading, slug) => {
    expect(slugify(heading)).toBe(slug);
  });
});

describe("anchorsOf", () => {
  it("numbers repeated headings, skips fences, reads HTML ids", () => {
    const anchors = anchorsOf(
      [
        "# Title",
        "## Part",
        "## Part",
        "## Part ##",
        "```",
        "# not a heading",
        "```",
        '<a id="Custom"></a>',
      ].join("\n"),
    );
    expect([...anchors].sort()).toEqual(
      ["custom", "part", "part-1", "part-2", "title"].sort(),
    );
  });
});

describe("codeSpans", () => {
  it("pairs backtick runs of the same length on a line", () => {
    const spans = codeSpans("a `b` c ``d ` e`` f `unclosed");
    expect(spans.map((span) => span.content)).toEqual(["b", "d ` e"]);
  });
});

describe("linkTargets", () => {
  it("finds links outside code, with the line of their target", () => {
    const text = [
      "[a](one.md) and `[b](two.md)`",
      "[wrapped",
      'text](three.md#x "title")',
      "```",
      "[c](four.md)",
      "```",
      "[ref]: five.md",
    ].join("\n");
    expect(linkTargets(text)).toEqual([
      { line: 1, target: "one.md" },
      { line: 3, target: "three.md#x" },
      { line: 7, target: "five.md" },
    ]);
  });
});

describe("quotedPaths", () => {
  it("keeps repo paths, drops :line, globs, placeholders and fences", () => {
    const text = [
      "`apps/web/src/main.tsx:12` `docs/a.md#h` `packs/*/src` `apps/<id>/x`",
      "`pnpm test` `src/x.ts` `scripts/run.mjs --flag`",
      "```",
      "`docs/in-fence.md`",
      "```",
    ].join("\n");
    expect(quotedPaths(text)).toEqual([
      { line: 1, path: "apps/web/src/main.tsx" },
      { line: 1, path: "docs/a.md" },
      { line: 2, path: "scripts/run.mjs" },
    ]);
  });
});

describe("checkDocs", () => {
  let root;
  afterEach(() => rmSync(root, { force: true, recursive: true }));

  const repo = (files) => {
    root = mkdtempSync(join(tmpdir(), "check-docs-"));
    for (const [name, contents] of Object.entries(files)) {
      mkdirSync(dirname(join(root, name)), { recursive: true });
      writeFileSync(join(root, name), contents);
    }
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["add", "-A"], { cwd: root });
    return root;
  };

  it("passes a sound tree", () => {
    repo({
      ".gitignore": "apps/dist/\n",
      "apps/a.ts": "",
      "docs/g.md": "## Part\n",
      "README.md":
        "[g](docs/g.md#part) [self](#top) `apps/a.ts:3` `apps/dist/x`\n# Top\n",
    });
    expect(checkDocs(root)).toEqual([]);
  });

  it("reports a merge conflict marker left outside a fence", () => {
    repo({
      "README.md": [
        "<<<<<<< HEAD",
        "ours",
        "=======",
        "theirs",
        ">>>>>>> abc1234 (feat: x)",
        "```",
        "<<<<<<< HEAD",
        "```",
      ].join("\n"),
    });
    expect(checkDocs(root)).toEqual([
      "README.md:1 holds a merge conflict marker",
      "README.md:3 holds a merge conflict marker",
      "README.md:5 holds a merge conflict marker",
    ]);
  });

  it("reports each failure with file and line, and skips the changelog", () => {
    repo({
      "CHANGELOG.md": "[x](gone.md) `apps/gone.ts`\n",
      "docs/g.md": "## Part\n",
      "README.md": [
        "ok",
        "[a](docs/missing.md)",
        "[b](docs/g.md#nope)",
        "[c](#nowhere)",
        "`packs/gone/index.ts`",
        "[d](https://example.com/x.md)",
      ].join("\n"),
    });
    expect(checkDocs(root)).toEqual([
      "README.md:2 link docs/missing.md points at a missing file",
      'README.md:3 link docs/g.md#nope has no heading "nope" in docs/g.md',
      'README.md:4 link #nowhere has no heading "nowhere" in README.md',
      "README.md:5 `packs/gone/index.ts` does not exist",
    ]);
  });
});
