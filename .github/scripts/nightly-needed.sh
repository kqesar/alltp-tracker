#!/usr/bin/env bash
# Has master changed since the last green full run, so that the nightly run
# has something to check? Prints `needed=true` or `needed=false` (and appends
# it to $GITHUB_OUTPUT when set). docs/ci.md says why.
#
# A "full" run is a run of ci.yml on master whose `ci` job really ran and
# succeeded: a promoted push (the pull request tested its tree) and a release
# commit skip that job, so neither counts. The nightly run is itself one.
#
# Master "moved" only if something the tests or the site can see changed: a
# release commit (is-release-commit.sh, which needs no deployed parent here)
# and a Markdown-only commit (ci.yml ignores those) are not a move.
#
# Any doubt, or any error, answers `true`: the nightly run runs.
#
# Environment: GH_TOKEN, REPO (owner/name), AFTER (master's head commit).
set -uo pipefail

here=$(dirname "${BASH_SOURCE[0]}")

# How many green runs are examined, newest first, before giving up. Pushes
# that were promoted or skipped are green runs too, but never full ones.
MAX_RUNS=30

answer() {
  echo "needed=$1"
  [ -z "${GITHUB_OUTPUT:-}" ] || echo "needed=$1" >> "$GITHUB_OUTPUT"
  exit 0
}

# Is every commit from $1 (excluded) to $2 a release commit or Markdown-only?
# Only exact answers pass: a doubt, or an error, means master moved.
only_inert_commits() {
  local compare shas sha parent files verdict
  compare=$(gh api "repos/$REPO/compare/$1...$2") || return 1
  # Only a plain run of commits, all listed, without a merge in it
  jq -e '.status == "ahead" and (.commits | length) == .total_commits and .total_commits <= 30
         and all(.commits[]; (.parents | length) == 1)' <<< "$compare" > /dev/null || return 1
  shas=$(jq -r '.commits[] | "\(.sha) \(.parents[0].sha)"' <<< "$compare") || return 1
  while read -r sha parent; do
    files=$(gh api "repos/$REPO/commits/$sha" --jq '[.files[].filename]') || return 1
    # Markdown only (the files list holds up to 300 names: a longer one fails)
    if jq -e 'length > 0 and length < 300 and all(.[]; test("\\.md$") or . == "LICENSE")' <<< "$files" > /dev/null; then
      continue
    fi
    verdict=$(GITHUB_OUTPUT='' BEFORE="$parent" AFTER="$sha" REQUIRE_PARENT_DEPLOYED=false \
      bash "$here/is-release-commit.sh" 2> /dev/null | sed -n 's/^release=//p')
    [ "$verdict" = true ] || return 1
  done <<< "$shas"
}

[ -n "${AFTER:-}" ] && [ -n "${REPO:-}" ] || { echo "Missing input: running." >&2; answer true; }

runs=$(gh api "repos/$REPO/actions/workflows/ci.yml/runs?branch=master&status=success&per_page=$MAX_RUNS" \
  --jq '.workflow_runs[] | select(.event != "pull_request") | "\(.id) \(.head_sha)"') \
  || { echo "The runs could not be listed: running." >&2; answer true; }

while read -r id sha; do
  [ -n "$id" ] || continue
  full=$(gh api "repos/$REPO/actions/runs/$id/jobs?per_page=100" \
    --jq 'any(.jobs[]; .name == "ci" and .conclusion == "success")') || full=""
  [ "$full" = true ] || continue

  if [ "$sha" = "$AFTER" ]; then
    echo "Master is still at $AFTER, whose full run $id was green: nothing to check." >&2
    answer false
  fi
  if only_inert_commits "$sha" "$AFTER"; then
    echo "Master moved from $sha to $AFTER, by release or Markdown-only commits: nothing to check." >&2
    answer false
  fi
  echo "Master moved from $sha (full run $id) to $AFTER: running." >&2
  answer true
done <<< "$runs"

echo "No green full run among the last $MAX_RUNS: running." >&2
answer true
