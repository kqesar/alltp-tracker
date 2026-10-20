#!/usr/bin/env bash
# Is this push to master only a release-please release commit, whose pipeline
# has nothing to test, scan or deploy? Prints `release=true` or `release=false`
# (and appends it to $GITHUB_OUTPUT when set). docs/ci.md says why.
#
# A release commit is recognised by what it changes, not by what it says:
#   - the push holds nothing but release commits (their titles are checked);
#   - its diff is exactly three files: the changelog, release-please's
#     manifest, and package.json;
#   - in the manifest and package.json, the only change is the version line;
#   - the commit before it was built and deployed by the CI workflow, so
#     skipping the release commit cannot leave an earlier change undeployed.
#     (A run waiting in the master queue is replaced by a newer one: if the
#     release commit replaced its parent's run, the parent has no green run.)
#
# Any doubt, or any error, answers `false`: the full pipeline runs.
#
# Environment: GH_TOKEN, REPO (owner/name), BEFORE and AFTER (the push's
# commits). CI_WORKFLOW (default ci.yml) is the workflow whose run on BEFORE
# must be green.
set -uo pipefail

CI_WORKFLOW="${CI_WORKFLOW:-ci.yml}"
VERSION='[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?'

answer() {
  echo "release=$1"
  [ -z "${GITHUB_OUTPUT:-}" ] || echo "release=$1" >> "$GITHUB_OUTPUT"
  exit 0
}

refuse() {
  echo "Not a release commit: $1" >&2
  answer false
}

[ -n "${BEFORE:-}" ] && [ -n "${AFTER:-}" ] && [ -n "${REPO:-}" ] || refuse "missing input"
# The first push of a branch has no commit before it
[[ "$BEFORE" =~ ^0+$ ]] && refuse "no previous commit"

compare=$(gh api "repos/$REPO/compare/$BEFORE...$AFTER") || refuse "the comparison failed"

# Only exact answers pass: a truncated or odd response never matches
verdict=$(jq -r --arg version "$VERSION" '
  # One line out, one line in, both holding only the version
  def version_swap($key):
    [(.patch // "") | split("\n")[] | select(test("^[+-]"))] as $changed
    | ($changed | length) == 2
      and ($changed[0] | test("^-\\s*\"" + $key + "\": \"" + $version + "\",?$"))
      and ($changed[1] | test("^\\+\\s*\"" + $key + "\": \"" + $version + "\",?$"));
  def file($name): [.files[] | select(.filename == $name)][0] // {};

  if .status != "ahead" then "the push does not only add commits"
  elif (.commits | length) != .total_commits then "the commit list is truncated"
  elif (.commits | map(.commit.message | split("\n")[0]
        | test("^chore\\(master\\): release [0-9]+\\.[0-9]+\\.[0-9]+")) | all) | not
    then "a commit is not titled as a release"
  elif ([.files[].filename] | sort)
        != [".release-please-manifest.json", "CHANGELOG.md", "package.json"]
    then "the files changed are not the release files"
  elif (file("package.json") | version_swap("version")) | not
    then "package.json changes more than its version"
  elif (file(".release-please-manifest.json") | version_swap("\\.")) | not
    then "the manifest changes more than the version"
  else "ok" end
' <<< "$compare") || refuse "the comparison could not be read"
[ "$verdict" = ok ] || refuse "$verdict"

# The parent was built and deployed, or this commit is the only thing left
# that would deploy it
green=$(gh api "repos/$REPO/actions/workflows/$CI_WORKFLOW/runs?head_sha=$BEFORE&event=push&status=success" \
  --jq '.total_count') || refuse "the runs of the previous commit could not be listed"
[ "${green:-0}" -ge 1 ] || refuse "the previous commit has no green $CI_WORKFLOW run"

echo "Release commit $AFTER: nothing to test, scan or deploy." >&2
answer true
