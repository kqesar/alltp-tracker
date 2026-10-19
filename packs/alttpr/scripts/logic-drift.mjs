/// <reference types="node" />
// Logic drift: has a randomizer changed a file a game pack ports since the
// commit the pack's upstream.json pins? Run weekly by
// .github/workflows/logic-drift.yml through actions/github-script, which
// passes its authenticated client, once per pack. It keeps one open issue
// labelled `logic-drift` per pack up to date (told apart by its title), and
// does nothing while no listed file changed and, for a manifest that pins
// one, LOGIC did not move. Upstream is only read through the GitHub API:
// nothing of it is checked out or run.

import { readFileSync } from "node:fs";

export const LABEL = "logic-drift";

/** The compare API lists at most this many files, however many pages. */
export const COMPARE_FILE_LIMIT = 300;
const PER_PAGE = 100;

/**
 * @typedef {{ owner: string, repo: string }} Repo
 * @typedef {{
 *   filename: string,
 *   previous_filename?: string,
 *   status: string,
 *   additions: number,
 *   deletions: number,
 * }} ChangedFile
 * @typedef {{ number: number, body?: string | null, title: string, pull_request?: unknown }} Issue
 * @typedef {{
 *   rest: {
 *     repos: {
 *       get(params: Repo): Promise<{ data: { default_branch: string } }>,
 *       getBranch(params: Repo & { branch: string }): Promise<{ data: { commit: { sha: string } } }>,
 *       compareCommits(params: Repo & { base: string, head: string, page: number, per_page: number }):
 *         Promise<{ data: { total_commits: number, files?: ChangedFile[] } }>,
 *       getContent(params: Repo & { path: string, ref: string }): Promise<{ data: unknown }>,
 *     },
 *     issues: {
 *       listForRepo(params: Repo & { labels: string, state: "open", per_page: number }): Promise<{ data: Issue[] }>,
 *       create(params: Repo & { title: string, body: string, labels: string[] }): Promise<{ data: Issue }>,
 *       update(params: Repo & { issue_number: number, title: string, body: string }): Promise<{ data: Issue }>,
 *       getLabel(params: Repo & { name: string }): Promise<unknown>,
 *       createLabel(params: Repo & { name: string, color: string, description: string }): Promise<unknown>,
 *     },
 *   },
 * }} GitHub
 * @typedef {{ info(message: string): void, warning(message: string): void }} Core
 * @typedef {{ repo: string, commit: string, logic?: number, rules: { file: string }[], tests: { file: string }[] }} Manifest
 */

/**
 * The files upstream.json lists, rules and tests alike.
 *
 * @param {Manifest} manifest
 */
export function listedFiles(manifest) {
  return new Set([...manifest.rules, ...manifest.tests].map((e) => e.file));
}

/**
 * The changed files upstream.json lists, under their new or former name.
 *
 * @param {Manifest} manifest
 * @param {readonly ChangedFile[]} files
 */
export function listedChanges(manifest, files) {
  const listed = listedFiles(manifest);
  return files.filter(
    (file) =>
      listed.has(file.filename) ||
      (file.previous_filename !== undefined &&
        listed.has(file.previous_filename)),
  );
}

/**
 * `const LOGIC = 31;` in the text of app/Randomizer.php.
 *
 * @param {string} text
 * @returns {number | undefined}
 */
export function logicOf(text) {
  const match = /\bconst\s+LOGIC\s*=\s*(\d+)\s*;/.exec(text);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

/** @param {string} sha */
const short = (sha) => sha.slice(0, 7);

/**
 * The start of a pack's issue titles: ALttPR's as it always was, another
 * pack's with its name.
 * @param {string} pack
 */
export const titlePrefix = (pack) =>
  pack === "alttpr"
    ? "Upstream logic drift: "
    : `Upstream logic drift (${pack}): `;

/**
 * @param {string} base
 * @param {string} head
 * @param {string} [pack]
 */
export function issueTitle(base, head, pack = "alttpr") {
  return `${titlePrefix(pack)}${short(base)}...${short(head)}`;
}

/**
 * @param {{
 *   manifest: Manifest,
 *   head: string,
 *   commits: number,
 *   changes: readonly ChangedFile[],
 *   logic: number | undefined,
 *   truncated: boolean,
 *   pack?: string,
 * }} drift
 */
export function issueBody({
  changes,
  commits,
  head,
  logic,
  manifest,
  pack = "alttpr",
  truncated,
}) {
  const site = `https://github.com/${manifest.repo}`;
  const base = manifest.commit;
  const link = (/** @type {string} */ file, /** @type {string} */ ref) =>
    `[\`${file}\`](${site}/blob/${ref}/${file})`;
  const rows = changes.map((change) => {
    const file =
      change.status === "removed"
        ? link(change.filename, base)
        : link(change.filename, head);
    const renamed =
      change.previous_filename !== undefined &&
      change.previous_filename !== change.filename
        ? ` (was \`${change.previous_filename}\`)`
        : "";
    return `| ${file}${renamed} | ${change.status} | +${change.additions} -${change.deletions} |`;
  });
  const logicLine =
    manifest.logic === undefined
      ? []
      : [
          logic === undefined
            ? "**LOGIC could not be read** from `app/Randomizer.php` at the new commit: treat it as structural."
            : logic === manifest.logic
              ? `LOGIC is unchanged: ${logic}.`
              : `**LOGIC changed: ${manifest.logic} → ${logic}.** This is structural: plan before porting.`,
          "",
        ];
  return [
    `\`${manifest.repo}\` moved past the commit \`packs/${pack}/upstream.json\` pins: ` +
      `[\`${short(base)}...${short(head)}\`](${site}/compare/${base}...${head}) ` +
      `(${commits} commit${commits === 1 ? "" : "s"}).`,
    "",
    ...logicLine,
    changes.length === 0
      ? "None of the files `upstream.json` lists changed."
      : `${changes.length} of the files \`upstream.json\` lists changed:`,
    ...(changes.length === 0
      ? []
      : ["", "| File | Change | Lines |", "| --- | --- | --- |", ...rows]),
    ...(truncated
      ? [
          "",
          `The comparison stopped at ${COMPARE_FILE_LIMIT} files, the API's limit: ` +
            "read the full diff on GitHub, a listed file may be missing above.",
        ]
      : []),
    "",
    pack === "alttpr"
      ? "Port the change with the `logic-drift` skill (`.claude/skills/logic-drift/SKILL.md`), " +
        "then close this issue from the pull request."
      : `Port the change as \`packs/${pack}/README.md\` says, ` +
        "then close this issue from the pull request.",
    "",
    `<!-- logic-drift base=${base} head=${head} -->`,
  ].join("\n");
}

/**
 * @param {GitHub} github
 * @param {Repo} upstream
 * @param {string} base
 * @param {string} head
 */
async function compare(github, upstream, base, head) {
  /** @type {ChangedFile[]} */
  const files = [];
  let commits = 0;
  for (let page = 1; ; page++) {
    const { data } = await github.rest.repos.compareCommits({
      ...upstream,
      base,
      head,
      page,
      per_page: PER_PAGE,
    });
    commits = data.total_commits;
    const batch = data.files ?? [];
    files.push(...batch);
    if (batch.length < PER_PAGE || files.length >= COMPARE_FILE_LIMIT) break;
  }
  return { commits, files, truncated: files.length >= COMPARE_FILE_LIMIT };
}

/**
 * @param {GitHub} github
 * @param {Repo} upstream
 * @param {string} ref
 */
async function logicAt(github, upstream, ref) {
  try {
    const { data } = await github.rest.repos.getContent({
      ...upstream,
      path: "app/Randomizer.php",
      ref,
    });
    const content = /** @type {{ content?: string }} */ (data).content;
    return content === undefined
      ? undefined
      : logicOf(Buffer.from(content, "base64").toString("utf8"));
  } catch {
    return undefined;
  }
}

/**
 * @param {{
 *   github: GitHub,
 *   context: { repo: Repo },
 *   core: Core,
 *   manifestPath?: string,
 *   pack?: string,
 * }} options
 * @returns {Promise<{ action: "none" | "created" | "updated" | "unchanged", issue?: number }>}
 */
export async function checkDrift({
  context,
  core,
  github,
  manifestPath = "packs/alttpr/upstream.json",
  pack = "alttpr",
}) {
  /** @type {Manifest} */
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const [owner = "", repo = ""] = manifest.repo.split("/");
  const upstream = { owner, repo };

  const { data: info } = await github.rest.repos.get(upstream);
  const { data: branch } = await github.rest.repos.getBranch({
    ...upstream,
    branch: info.default_branch,
  });
  const head = branch.commit.sha;
  if (head === manifest.commit) {
    core.info(`${manifest.repo} is still at ${short(head)}: nothing to do.`);
    return { action: "none" };
  }

  const { commits, files, truncated } = await compare(
    github,
    upstream,
    manifest.commit,
    head,
  );
  const changes = listedChanges(manifest, files);
  const logic =
    manifest.logic === undefined
      ? undefined
      : await logicAt(github, upstream, head);
  if (changes.length === 0 && logic === manifest.logic && !truncated) {
    core.info(
      `${commits} upstream commit(s) since ${short(manifest.commit)}, none in a listed file.`,
    );
    return { action: "none" };
  }

  const title = issueTitle(manifest.commit, head, pack);
  const body = issueBody({
    changes,
    commits,
    head,
    logic,
    manifest,
    pack,
    truncated,
  });
  const here = context.repo;
  const { data: open } = await github.rest.issues.listForRepo({
    ...here,
    labels: LABEL,
    per_page: 100,
    state: "open",
  });
  const existing = open.find(
    (issue) =>
      issue.pull_request === undefined &&
      issue.title.startsWith(titlePrefix(pack)),
  );
  if (existing !== undefined) {
    if (existing.title === title && existing.body === body) {
      core.info(`Issue #${existing.number} already says so.`);
      return { action: "unchanged", issue: existing.number };
    }
    await github.rest.issues.update({
      ...here,
      body,
      issue_number: existing.number,
      title,
    });
    core.info(`Updated issue #${existing.number}: ${title}`);
    return { action: "updated", issue: existing.number };
  }

  try {
    await github.rest.issues.getLabel({ ...here, name: LABEL });
  } catch {
    await github.rest.issues.createLabel({
      ...here,
      color: "d93f0b",
      description: "A randomizer changed a file a game pack ports",
      name: LABEL,
    });
  }
  const { data: created } = await github.rest.issues.create({
    ...here,
    body,
    labels: [LABEL],
    title,
  });
  core.info(`Opened issue #${created.number}: ${title}`);
  return { action: "created", issue: created.number };
}
