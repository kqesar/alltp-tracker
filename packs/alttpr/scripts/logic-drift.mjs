/// <reference types="node" />
// Logic drift: has a randomizer changed a file a game pack ports since the
// commit the pack's upstream.json pins? Run weekly by
// .github/workflows/logic-drift.yml through actions/github-script, which
// passes its authenticated client, once per pack. It keeps one open issue
// labelled `logic-drift` per pack up to date (told apart by its title), and
// does nothing while no listed file changed and, for a manifest that pins
// one, LOGIC did not move. Upstream is only read through the GitHub API:
// nothing of it is checked out or run.
//
// Archipelago has no commit to follow (its main moves daily) but releases:
// checkReleaseDrift compares the release packages/archipelago/upstream.json
// pins with the latest stable one, and keeps one open `ap-drift` issue up to
// date the same way.

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
 *         Promise<{ data: { total_commits: number, status?: string, files?: ChangedFile[] } }>,
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
 * @typedef {{
 *   rest: {
 *     repos: Pick<GitHub["rest"]["repos"], "compareCommits"> & {
 *       getLatestRelease(params: Repo): Promise<{ data: Release }>,
 *     },
 *     issues: GitHub["rest"]["issues"],
 *   },
 * }} ReleaseGitHub
 * @typedef {{ info(message: string): void, warning(message: string): void }} Core
 * @typedef {{ repo: string, commit: string, logic?: number, rules: { file: string }[], tests: { file: string }[] }} Manifest
 * @typedef {{
 *   tag_name: string,
 *   html_url: string,
 *   published_at?: string | null,
 *   assets?: { name: string, digest?: string | null }[],
 * }} Release
 * @typedef {{
 *   repo: string,
 *   release: string,
 *   commit: string,
 *   watched: string[],
 *   nameData: Record<string, string>,
 * }} ReleaseManifest
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
 * @param {{ rest: { repos: Pick<GitHub["rest"]["repos"], "compareCommits"> } }} github
 * @param {Repo} upstream
 * @param {string} base
 * @param {string} head
 */
async function compare(github, upstream, base, head) {
  /** @type {ChangedFile[]} */
  const files = [];
  let commits = 0;
  let status = "";
  for (let page = 1; ; page++) {
    const { data } = await github.rest.repos.compareCommits({
      ...upstream,
      base,
      head,
      page,
      per_page: PER_PAGE,
    });
    commits = data.total_commits;
    status = data.status ?? "";
    const batch = data.files ?? [];
    files.push(...batch);
    if (batch.length < PER_PAGE || files.length >= COMPARE_FILE_LIMIT) break;
  }
  return {
    commits,
    files,
    status,
    truncated: files.length >= COMPARE_FILE_LIMIT,
  };
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
 * Keeps one open issue of a label up to date: updates the one whose title
 * starts with `prefix` (a pull request is no issue), else opens one, creating
 * the label first when it does not exist.
 *
 * @param {{
 *   github: { rest: { issues: GitHub["rest"]["issues"] } },
 *   context: { repo: Repo },
 *   core: Core,
 *   label: string,
 *   color: string,
 *   description: string,
 *   prefix: string,
 *   title: string,
 *   body: string,
 * }} options
 * @returns {Promise<{ action: "created" | "updated" | "unchanged", issue: number }>}
 */
async function upsertIssue({
  body,
  color,
  context,
  core,
  description,
  github,
  label,
  prefix,
  title,
}) {
  const here = context.repo;
  const { data: open } = await github.rest.issues.listForRepo({
    ...here,
    labels: label,
    per_page: 100,
    state: "open",
  });
  const existing = open.find(
    (issue) =>
      issue.pull_request === undefined && issue.title.startsWith(prefix),
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
    await github.rest.issues.getLabel({ ...here, name: label });
  } catch {
    await github.rest.issues.createLabel({
      ...here,
      color,
      description,
      name: label,
    });
  }
  const { data: created } = await github.rest.issues.create({
    ...here,
    body,
    labels: [label],
    title,
  });
  core.info(`Opened issue #${created.number}: ${title}`);
  return { action: "created", issue: created.number };
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

  return upsertIssue({
    body: issueBody({
      changes,
      commits,
      head,
      logic,
      manifest,
      pack,
      truncated,
    }),
    color: "d93f0b",
    context,
    core,
    description: "A randomizer changed a file a game pack ports",
    github,
    label: LABEL,
    prefix: titlePrefix(pack),
    title: issueTitle(manifest.commit, head, pack),
  });
}

export const AP_LABEL = "ap-drift";
export const AP_TITLE_PREFIX = "Upstream Archipelago release: ";

/**
 * @param {string} base the pinned release
 * @param {string} head the latest one
 */
export const releaseIssueTitle = (base, head) =>
  `${AP_TITLE_PREFIX}${base} → ${head}`;

/**
 * The watched files that changed, under their new or former name.
 *
 * @param {ReleaseManifest} manifest
 * @param {readonly ChangedFile[]} files
 */
export function watchedChanges(manifest, files) {
  const watched = new Set(manifest.watched);
  return files.filter(
    (file) =>
      watched.has(file.filename) ||
      (file.previous_filename !== undefined &&
        watched.has(file.previous_filename)),
  );
}

/**
 * @param {{
 *   manifest: ReleaseManifest,
 *   release: Release,
 *   commits: number,
 *   changes: readonly ChangedFile[],
 *   truncated: boolean,
 * }} drift
 */
export function releaseIssueBody({
  changes,
  commits,
  manifest,
  release,
  truncated,
}) {
  const site = `https://github.com/${manifest.repo}`;
  const base = manifest.release;
  const head = release.tag_name;
  const rows = changes.map((change) => {
    const ref = change.status === "removed" ? manifest.commit : head;
    const renamed =
      change.previous_filename !== undefined &&
      change.previous_filename !== change.filename
        ? ` (was \`${change.previous_filename}\`)`
        : "";
    return `| [\`${change.filename}\`](${site}/blob/${ref}/${change.filename})${renamed} | ${change.status} | +${change.additions} -${change.deletions} |`;
  });
  const assets = (release.assets ?? [])
    .filter((asset) => /_linux-x86_64\.(tar\.gz|AppImage)$/.test(asset.name))
    .map((asset) => ({
      name: asset.name,
      sha: asset.digest?.replace(/^sha256:/, ""),
    }))
    .filter((asset) => asset.sha !== undefined);
  const worlds = changes.some((change) =>
    /^worlds\/(alttp|sm|smz3)\//.test(change.filename),
  );
  return [
    `\`${manifest.repo}\` released [${head}](${release.html_url})` +
      `${release.published_at ? ` on ${release.published_at.slice(0, 10)}` : ""}, ` +
      `past the release \`packages/archipelago/upstream.json\` pins (${base}): ` +
      `[\`${base}...${head}\`](${site}/compare/${manifest.commit}...${head}) ` +
      `(${commits} commit${commits === 1 ? "" : "s"}).`,
    "",
    changes.length === 0
      ? "None of the watched files changed."
      : `${changes.length} of the watched files changed:`,
    ...(changes.length === 0
      ? []
      : ["", "| File | Change | Lines |", "| --- | --- | --- |", ...rows]),
    ...(truncated
      ? [
          "",
          `The comparison stopped at ${COMPARE_FILE_LIMIT} files, the API's limit: ` +
            "read the full diff on GitHub, a watched file may be missing above.",
        ]
      : []),
    "",
    "Name-data checksums (`nameData` in `upstream.json`): **to check**. " +
      "The data package is built by the server, not shipped as a file: " +
      (worlds
        ? "a watched world file changed, so a checksum may well have. "
        : "") +
      'record the fixtures against the new release ("Recording the fixtures" in ' +
      "`packages/archipelago/README.md`) and compare.",
    ...(assets.length === 0
      ? []
      : [
          "",
          "The release's Linux assets, for `assets` in `upstream.json`:",
          "",
          ...assets.map((asset) => `- \`${asset.name}\`: \`${asset.sha}\``),
        ]),
    "",
    "Bump the pin as the README says (release, commit, assets, watched files, name data), " +
      "run the suite and the Archipelago workflow, then close this issue from the pull request.",
    "",
    `<!-- ap-drift base=${base} head=${head} -->`,
  ].join("\n");
}

/**
 * Has Archipelago released a stable version past the one
 * packages/archipelago/upstream.json pins? Opens or updates the `ap-drift`
 * issue when it has, whichever files changed: a newer release is worth a
 * bump, and its changed watched files say how much work it is.
 *
 * @param {{
 *   github: ReleaseGitHub,
 *   context: { repo: Repo },
 *   core: Core,
 *   manifestPath?: string,
 * }} options
 * @returns {Promise<{ action: "none" | "created" | "updated" | "unchanged", issue?: number }>}
 */
export async function checkReleaseDrift({
  context,
  core,
  github,
  manifestPath = "packages/archipelago/upstream.json",
}) {
  /** @type {ReleaseManifest} */
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const [owner = "", repo = ""] = manifest.repo.split("/");
  const upstream = { owner, repo };

  // The latest release GitHub marks as such: never a draft or a pre-release
  const { data: release } = await github.rest.repos.getLatestRelease(upstream);
  if (release.tag_name === manifest.release) {
    core.info(`${manifest.repo} is still at ${manifest.release}: up to date.`);
    return { action: "none" };
  }

  const { commits, files, status, truncated } = await compare(
    github,
    upstream,
    manifest.commit,
    release.tag_name,
  );
  // The pin is ahead of the latest release (a release was pulled)
  if (status === "behind" || status === "identical") {
    core.info(
      `The latest release ${release.tag_name} is not past the pinned ${manifest.release}.`,
    );
    return { action: "none" };
  }

  return upsertIssue({
    body: releaseIssueBody({
      changes: watchedChanges(manifest, files),
      commits,
      manifest,
      release,
      truncated,
    }),
    color: "fbca04",
    context,
    core,
    description: "Archipelago released a version past the pinned one",
    github,
    label: AP_LABEL,
    prefix: AP_TITLE_PREFIX,
    title: releaseIssueTitle(manifest.release, release.tag_name),
  });
}
