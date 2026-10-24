import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  AP_LABEL,
  COMPARE_FILE_LIMIT,
  checkDrift,
  checkReleaseDrift,
  issueBody,
  issueTitle,
  LABEL,
  listedChanges,
  logicOf,
  releaseIssueBody,
  releaseIssueTitle,
  watchedChanges,
} from "../scripts/logic-drift.mjs";

const BASE = "219fcafd029dab597b8db400efafd8f56f8b4edb";
const HEAD = "a".repeat(40);
const MANIFEST = {
  commit: BASE,
  logic: 31,
  repo: "sporchia/alttp_vt_randomizer",
  rules: [
    { file: "app/Region/Standard/TowerOfHera.php" },
    { file: "app/Boss.php" },
  ],
  tests: [{ file: "tests/NoGlitches/TowerOfHeraTest.php" }],
};

const dir = mkdtempSync(join(tmpdir(), "alttpr-drift-"));
const manifestPath = join(dir, "upstream.json");
writeFileSync(manifestPath, JSON.stringify(MANIFEST));
afterAll(() => rmSync(dir, { force: true, recursive: true }));

interface File {
  additions: number;
  deletions: number;
  filename: string;
  previous_filename?: string;
  status: string;
}

const file = (filename: string, extra: Partial<File> = {}): File => ({
  additions: 3,
  deletions: 1,
  filename,
  status: "modified",
  ...extra,
});

/** A GitHub API double: upstream at `head`, these files changed, these issues open. */
function fakeGitHub({
  files = [] as File[],
  head = HEAD,
  issues = [] as {
    body?: string;
    number: number;
    pull_request?: object;
    title: string;
  }[],
  label = true,
  logic = 31 as number | undefined,
  pack = undefined as string | undefined,
  path = manifestPath,
} = {}) {
  const calls: { args: Record<string, unknown>; method: string }[] = [];
  const record =
    <T>(method: string, result: (args: Record<string, unknown>) => T) =>
    async (args: Record<string, unknown>) => {
      calls.push({ args, method });
      return result(args);
    };
  const github = {
    rest: {
      issues: {
        create: record("issues.create", () => ({
          data: { number: 7, title: "" },
        })),
        createLabel: record("issues.createLabel", () => ({})),
        getLabel: record("issues.getLabel", () => {
          if (!label) throw new Error("Not Found");
          return {};
        }),
        listForRepo: record("issues.listForRepo", () => ({ data: issues })),
        update: record("issues.update", (args) => ({
          data: { number: Number(args.issue_number), title: "" },
        })),
      },
      repos: {
        compareCommits: record("repos.compareCommits", (args) => {
          const page = Number(args.page);
          const size = Number(args.per_page);
          return {
            data: {
              files: files.slice((page - 1) * size, page * size),
              total_commits: 4,
            },
          };
        }),
        get: record("repos.get", () => ({
          data: { default_branch: "master" },
        })),
        getBranch: record("repos.getBranch", () => ({
          data: { commit: { sha: head } },
        })),
        getContent: record("repos.getContent", () => {
          if (logic === undefined) throw new Error("Not Found");
          const text = `<?php class Randomizer { const LOGIC = ${logic}; }`;
          return { data: { content: Buffer.from(text).toString("base64") } };
        }),
      },
    },
  };
  const logs: string[] = [];
  const core = {
    info: (message: string) => logs.push(message),
    warning: (message: string) => logs.push(message),
  };
  const context = { repo: { owner: "kqesar", repo: "alltp-tracker" } };
  const run = () =>
    checkDrift({
      context,
      core,
      github,
      manifestPath: path,
      ...(pack === undefined ? {} : { pack }),
    });
  const methods = () => calls.map((call) => call.method);
  return { calls, logs, methods, run };
}

describe("checkDrift", () => {
  it("does nothing while upstream is at the pinned commit", async () => {
    const gh = fakeGitHub({ head: BASE });
    expect(await gh.run()).toEqual({ action: "none" });
    expect(gh.methods()).toEqual(["repos.get", "repos.getBranch"]);
  });

  it("does nothing when no listed file changed and LOGIC did not move", async () => {
    const gh = fakeGitHub({ files: [file("README.md"), file("app/Rom.php")] });
    expect(await gh.run()).toEqual({ action: "none" });
    expect(gh.methods()).not.toContain("issues.create");
    // Compared the pinned commit with the head of the default branch
    expect(
      gh.calls.find((c) => c.method === "repos.compareCommits")?.args,
    ).toMatchObject({
      base: BASE,
      head: HEAD,
      owner: "sporchia",
      repo: "alttp_vt_randomizer",
    });
    expect(
      gh.calls.find((c) => c.method === "repos.getContent")?.args,
    ).toMatchObject({
      path: "app/Randomizer.php",
      ref: HEAD,
    });
  });

  it("opens one labelled issue for the listed files that changed", async () => {
    const gh = fakeGitHub({
      files: [file("app/Rom.php"), file("app/Boss.php")],
      label: false,
    });
    expect(await gh.run()).toEqual({ action: "created", issue: 7 });
    expect(gh.methods()).toContain("issues.createLabel");
    const created = gh.calls.find((c) => c.method === "issues.create")?.args;
    expect(created).toMatchObject({
      labels: [LABEL],
      owner: "kqesar",
      repo: "alltp-tracker",
      title: "Upstream logic drift: 219fcaf...aaaaaaa",
    });
    expect(created?.body).toContain("app/Boss.php");
    expect(created?.body).not.toContain("app/Rom.php");
  });

  it("updates the open issue rather than opening another", async () => {
    const gh = fakeGitHub({
      files: [file("app/Boss.php")],
      issues: [
        { number: 3, pull_request: {}, title: "a pull request" },
        {
          body: "old",
          number: 5,
          title: "Upstream logic drift: 219fcaf...bbbbbbb",
        },
      ],
    });
    expect(await gh.run()).toEqual({ action: "updated", issue: 5 });
    expect(gh.methods()).not.toContain("issues.create");
    expect(
      gh.calls.find((c) => c.method === "issues.update")?.args,
    ).toMatchObject({
      issue_number: 5,
      title: "Upstream logic drift: 219fcaf...aaaaaaa",
    });
  });

  it("leaves an issue alone when it already says the same", async () => {
    const changes = [file("app/Boss.php")];
    const body = issueBody({
      changes,
      commits: 4,
      head: HEAD,
      logic: 31,
      manifest: MANIFEST,
      truncated: false,
    });
    const gh = fakeGitHub({
      files: changes,
      issues: [{ body, number: 5, title: issueTitle(BASE, HEAD) }],
    });
    expect(await gh.run()).toEqual({ action: "unchanged", issue: 5 });
    expect(gh.methods()).not.toContain("issues.update");
  });

  it("reports a LOGIC bump even when no listed file changed", async () => {
    const gh = fakeGitHub({ files: [file("app/Randomizer.php")], logic: 32 });
    expect((await gh.run()).action).toBe("created");
    const body = String(
      gh.calls.find((c) => c.method === "issues.create")?.args.body,
    );
    expect(body).toContain("**LOGIC changed: 31 → 32.**");
    expect(body).toContain("None of the files `upstream.json` lists changed.");
  });

  it("reads every page of the comparison, up to the API's limit", async () => {
    const many = Array.from({ length: COMPARE_FILE_LIMIT }, (_, i) =>
      file(`app/File${i}.php`),
    );
    const gh = fakeGitHub({ files: [...many, file("app/Boss.php")] });
    expect((await gh.run()).action).toBe("created");
    const pages = gh.calls.filter((c) => c.method === "repos.compareCommits");
    expect(pages.map((c) => c.args.page)).toEqual([1, 2, 3]);
    // Truncated: a listed file may be past the limit, so say so
    const body = String(
      gh.calls.find((c) => c.method === "issues.create")?.args.body,
    );
    expect(body).toContain(`stopped at ${COMPARE_FILE_LIMIT} files`);
  });
});

describe("checkDrift for another pack", () => {
  const smz3Path = join(dir, "smz3.json");
  writeFileSync(
    smz3Path,
    JSON.stringify({
      commit: BASE,
      repo: "tewtal/SMZ3Randomizer",
      rules: [{ file: "Randomizer.SMZ3/Regions/Zelda/TowerOfHera.cs" }],
      tests: [],
    }),
  );
  const smz3 = (issues: { number: number; title: string }[] = []) =>
    fakeGitHub({
      files: [file("Randomizer.SMZ3/Regions/Zelda/TowerOfHera.cs")],
      issues,
      pack: "smz3",
      path: smz3Path,
    });

  it("opens the pack's own issue, without LOGIC, which only ALttPR pins", async () => {
    const h = smz3([{ number: 3, title: issueTitle(BASE, HEAD) }]);
    expect(await h.run()).toEqual({ action: "created", issue: 7 });
    expect(h.methods()).not.toContain("repos.getContent");
    const created = h.calls.find((c) => c.method === "issues.create")?.args;
    expect(created?.title).toBe(issueTitle(BASE, HEAD, "smz3"));
    expect(created?.body).toContain("`packs/smz3/upstream.json`");
    expect(created?.body).toContain("`packs/smz3/README.md`");
    expect(created?.body).not.toContain("LOGIC");
  });

  it("updates the pack's issue, and leaves ALttPR's alone", async () => {
    const h = smz3([
      { number: 3, title: issueTitle(BASE, HEAD) },
      { number: 5, title: issueTitle(BASE, "b".repeat(40), "smz3") },
    ]);
    expect(await h.run()).toEqual({ action: "updated", issue: 5 });
  });

  it("does nothing while no listed file changed", async () => {
    const h = fakeGitHub({ pack: "smz3", path: smz3Path });
    expect(await h.run()).toEqual({ action: "none" });
  });
});

describe("listedChanges", () => {
  it("keeps the listed files, under their new or former name", () => {
    const changes = listedChanges(MANIFEST, [
      file("app/Region/Standard/Hera.php", {
        previous_filename: "app/Region/Standard/TowerOfHera.php",
        status: "renamed",
      }),
      file("tests/NoGlitches/TowerOfHeraTest.php", { status: "removed" }),
      file("app/Region/Standard/IcePalace.php"),
    ]);
    expect(changes.map((c) => c.filename)).toEqual([
      "app/Region/Standard/Hera.php",
      "tests/NoGlitches/TowerOfHeraTest.php",
    ]);
  });
});

describe("issueBody", () => {
  const body = issueBody({
    changes: [
      file("app/Boss.php"),
      file("tests/NoGlitches/TowerOfHeraTest.php", { status: "removed" }),
      file("app/Region/Standard/Hera.php", {
        previous_filename: "app/Region/Standard/TowerOfHera.php",
        status: "renamed",
      }),
    ],
    commits: 1,
    head: HEAD,
    logic: undefined,
    manifest: MANIFEST,
    truncated: false,
  });

  it("links the range, each file where it can be read, and the skill", () => {
    const site = "https://github.com/sporchia/alttp_vt_randomizer";
    expect(body).toContain(`(${site}/compare/${BASE}...${HEAD}) (1 commit)`);
    expect(body).toContain(
      `| [\`app/Boss.php\`](${site}/blob/${HEAD}/app/Boss.php) | modified | +3 -1 |`,
    );
    // A removed file is linked where it last was
    expect(body).toContain(
      `${site}/blob/${BASE}/tests/NoGlitches/TowerOfHeraTest.php`,
    );
    expect(body).toContain("(was `app/Region/Standard/TowerOfHera.php`)");
    expect(body).toContain(".claude/skills/logic-drift/SKILL.md");
    expect(body).toContain(`<!-- logic-drift base=${BASE} head=${HEAD} -->`);
  });

  it("treats a LOGIC it cannot read as structural", () => {
    expect(body).toContain("**LOGIC could not be read**");
  });
});

describe("logicOf", () => {
  it("reads the LOGIC constant", () => {
    expect(logicOf("class R {\n    const LOGIC = 31;\n}")).toBe(31);
    expect(logicOf("class R { const VERSION = '31'; }")).toBeUndefined();
  });
});

describe("checkReleaseDrift", () => {
  const PIN = "54803be064fc7e80c4628777ed0b46a9390f255f";
  const AP_MANIFEST = {
    commit: PIN,
    nameData: { "A Link to the Past": "1858ba2" },
    release: "0.6.8",
    repo: "ArchipelagoMW/Archipelago",
    watched: ["MultiServer.py", "worlds/alttp/Items.py"],
  };
  const apPath = join(dir, "ap.json");
  writeFileSync(apPath, JSON.stringify(AP_MANIFEST));

  /** A GitHub API double: this is the latest release, these files changed. */
  function fakeAp({
    files = [] as File[],
    issues = [] as { body?: string; number: number; title: string }[],
    status = "ahead",
    tag = "0.6.9",
  } = {}) {
    const calls: { args: Record<string, unknown>; method: string }[] = [];
    const record =
      <T>(method: string, result: (args: Record<string, unknown>) => T) =>
      async (args: Record<string, unknown>) => {
        calls.push({ args, method });
        return result(args);
      };
    const github = {
      rest: {
        issues: {
          create: record("issues.create", () => ({
            data: { number: 9, title: "" },
          })),
          createLabel: record("issues.createLabel", () => ({})),
          getLabel: record("issues.getLabel", () => {
            throw new Error("Not Found");
          }),
          listForRepo: record("issues.listForRepo", () => ({ data: issues })),
          update: record("issues.update", (args) => ({
            data: { number: Number(args.issue_number), title: "" },
          })),
        },
        repos: {
          compareCommits: record("repos.compareCommits", () => ({
            data: { files, status, total_commits: 12 },
          })),
          getLatestRelease: record("repos.getLatestRelease", () => ({
            data: {
              assets: [
                {
                  digest: `sha256:${"c".repeat(64)}`,
                  name: `Archipelago_${tag}_linux-x86_64.tar.gz`,
                },
                { digest: null, name: `Setup.Archipelago.${tag}.exe` },
              ],
              html_url: `https://github.com/ArchipelagoMW/Archipelago/releases/tag/${tag}`,
              published_at: "2026-11-01T10:00:00Z",
              tag_name: tag,
            },
          })),
        },
      },
    };
    const logs: string[] = [];
    const core = {
      info: (message: string) => logs.push(message),
      warning: (message: string) => logs.push(message),
    };
    const context = { repo: { owner: "kqesar", repo: "alltp-tracker" } };
    return {
      calls,
      logs,
      run: () =>
        checkReleaseDrift({ context, core, github, manifestPath: apPath }),
    };
  }
  const created = (h: ReturnType<typeof fakeAp>) =>
    h.calls.find((c) => c.method === "issues.create")?.args;

  it("does nothing while the latest release is the pinned one", async () => {
    const h = fakeAp({ tag: "0.6.8" });
    expect(await h.run()).toEqual({ action: "none" });
    expect(h.logs.join()).toContain("up to date");
    expect(h.calls.map((c) => c.method)).toEqual(["repos.getLatestRelease"]);
  });

  it("does nothing when the pin is ahead of the latest release", async () => {
    expect(await fakeAp({ status: "behind", tag: "0.6.7" }).run()).toEqual({
      action: "none",
    });
  });

  it("opens an ap-drift issue for a newer release, listing watched files", async () => {
    const h = fakeAp({
      files: [file("MultiServer.py"), file("worlds/alttp/Rom.py")],
    });
    expect(await h.run()).toEqual({ action: "created", issue: 9 });
    expect(
      h.calls.find((c) => c.method === "repos.compareCommits")?.args,
    ).toMatchObject({ base: PIN, head: "0.6.9", repo: "Archipelago" });
    expect(h.calls.map((c) => c.method)).toContain("issues.createLabel");
    const args = created(h);
    expect(args).toMatchObject({
      labels: [AP_LABEL],
      title: "Upstream Archipelago release: 0.6.8 → 0.6.9",
    });
    const body = String(args?.body);
    expect(body).toContain("`MultiServer.py`");
    expect(body).not.toContain("worlds/alttp/Rom.py");
    expect(body).toContain("**to check**");
    expect(body).toContain(
      `Archipelago_0.6.9_linux-x86_64.tar.gz\`: \`${"c".repeat(64)}`,
    );
    expect(body).not.toContain("Setup.Archipelago");
    expect(body).toContain("<!-- ap-drift base=0.6.8 head=0.6.9 -->");
  });

  it("opens the issue even when no watched file changed", async () => {
    const h = fakeAp({ files: [file("README.md")] });
    expect((await h.run()).action).toBe("created");
    expect(String(created(h)?.body)).toContain(
      "None of the watched files changed.",
    );
  });

  it("says a world file changed, so a checksum may have", () => {
    const body = releaseIssueBody({
      changes: [file("worlds/alttp/Items.py")],
      commits: 1,
      manifest: AP_MANIFEST,
      release: {
        html_url: "https://example.test/0.6.9",
        tag_name: "0.6.9",
      },
      truncated: true,
    });
    expect(body).toContain("a checksum may well have");
    expect(body).toContain("(1 commit)");
    expect(body).toContain(`stopped at ${COMPARE_FILE_LIMIT} files`);
  });

  it("updates the open issue, and leaves the logic-drift ones alone", async () => {
    const h = fakeAp({
      issues: [
        { number: 3, title: issueTitle(BASE, HEAD) },
        { body: "old", number: 5, title: releaseIssueTitle("0.6.8", "0.6.9") },
      ],
    });
    expect(await h.run()).toEqual({ action: "updated", issue: 5 });
    expect(h.calls.map((c) => c.method)).not.toContain("issues.create");
  });

  it("leaves an issue alone when it already says the same", async () => {
    const first = fakeAp();
    await first.run();
    const body = String(created(first)?.body);
    const h = fakeAp({
      issues: [{ body, number: 5, title: releaseIssueTitle("0.6.8", "0.6.9") }],
    });
    expect(await h.run()).toEqual({ action: "unchanged", issue: 5 });
  });
});

describe("watchedChanges", () => {
  it("keeps the watched files, under their new or former name", () => {
    const changes = watchedChanges(
      {
        commit: BASE,
        nameData: {},
        release: "0.6.8",
        repo: "ArchipelagoMW/Archipelago",
        watched: ["NetUtils.py"],
      },
      [
        file("NetUtils.py"),
        file("netutils/core.py", {
          previous_filename: "NetUtils.py",
          status: "renamed",
        }),
        file("Utils.py"),
      ],
    );
    expect(changes.map((c) => c.filename)).toEqual([
      "NetUtils.py",
      "netutils/core.py",
    ]);
  });
});
