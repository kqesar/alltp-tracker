#!/usr/bin/env bash
# Has master changed since the last green full run, so that the nightly run
# has something to check? Prints `needed=true` or `needed=false` (and appends
# it to $GITHUB_OUTPUT when set). docs/ci.md says why.
#
# A "full" run is a run of ci.yml on master whose `ci` job really ran and
# succeeded: a promoted push (the pull request tested its tree) and a release
# commit skip that job, so neither counts. The nightly run is itself one.
#
# Any doubt, or any error, answers `true`: the nightly run runs.
#
# Environment: GH_TOKEN, REPO (owner/name), AFTER (master's head commit).
set -uo pipefail

# How many green runs are examined, newest first, before giving up. Pushes
# that were promoted or skipped are green runs too, but never full ones.
MAX_RUNS=30

answer() {
  echo "needed=$1"
  [ -z "${GITHUB_OUTPUT:-}" ] || echo "needed=$1" >> "$GITHUB_OUTPUT"
  exit 0
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
  echo "Master moved from $sha (full run $id) to $AFTER: running." >&2
  answer true
done <<< "$runs"

echo "No green full run among the last $MAX_RUNS: running." >&2
answer true
