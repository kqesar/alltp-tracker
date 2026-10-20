#!/usr/bin/env bash
# Did a pull request of this repository already test the tree of the pushed
# commit, in full? Prints `tested=true` or `tested=false` (and appends it to
# $GITHUB_OUTPUT when set). docs/ci.md says why, and what makes a record
# trustworthy.
#
# The record is the artifact `tested-<tree>` that the `tested` job of ci.yml
# uploads once every test job of a pull request has passed. An artifact
# proves nothing by itself: any run can upload one under any name, and a pull
# request runs its own copy of the workflows. So a record counts only if the
# run that holds it:
#   - belongs to a pull request whose head is in this repository, never a fork
#     (a fork's workflows are the fork author's code);
#   - is ci.yml, on the `pull_request` event, completed and successful;
#   - has a successful `ci` job and every browser-test shard (all of the n in
#     "k/n"), and no job that failed.
#
# Any doubt, or any error, answers `false`: the full pipeline runs.
#
# Environment: GH_TOKEN, REPO (owner/name), AFTER (the pushed commit).
set -uo pipefail

# How many runs holding a record are examined: they are listed newest first,
# and a tree is rarely tested more than a couple of times
MAX_RUNS=10

answer() {
  echo "tested=$1"
  [ -z "${GITHUB_OUTPUT:-}" ] || echo "tested=$1" >> "$GITHUB_OUTPUT"
  exit 0
}

refuse() {
  echo "Not promoted: $1" >&2
  answer false
}

[ -n "${AFTER:-}" ] && [ -n "${REPO:-}" ] || refuse "missing input"

tree=$(gh api "repos/$REPO/git/commits/$AFTER" --jq .tree.sha) || refuse "the commit could not be read"
[[ "$tree" =~ ^[0-9a-f]{40}$ ]] || refuse "unexpected tree id '$tree'"
echo "Tree of $AFTER: $tree" >&2

# Artifacts of a fork's run are listed too, with that fork as head repository
runs=$(gh api "repos/$REPO/actions/artifacts?name=tested-$tree&per_page=100" --jq "
  [.artifacts[]
   | select(.expired | not)
   | select(.workflow_run.head_repository_id == .workflow_run.repository_id)
   | .workflow_run.id]
  | unique | reverse | .[0:$MAX_RUNS] | .[]") || refuse "the artifacts could not be listed"
[ -n "$runs" ] || refuse "no pull request has recorded this tree"

# The run must be what the record claims; only exact answers pass
run_verdict() {
  jq -r --arg repo "$REPO" '
    if .event != "pull_request" then "not a pull_request run"
    elif .path != ".github/workflows/ci.yml" then "not the CI workflow"
    elif .status != "completed" or .conclusion != "success" then "the run did not succeed"
    elif .repository.full_name != $repo or .head_repository.full_name != $repo
      or .head_repository.id != .repository.id or .head_repository.fork then "the head is not this repository"
    else "ok" end'
}

# The jobs must be what a complete run holds
jobs_verdict() {
  jq -r '
    if .total_count != (.jobs | length) then "the job list is truncated"
    elif [.jobs[] | select(.conclusion != "success" and .conclusion != "skipped")] | length > 0
      then "a job did not succeed"
    elif [.jobs[] | select(.name == "ci" and .conclusion == "success")] | length != 1
      then "the ci job did not succeed"
    else
      [.jobs[] | select(.conclusion == "success" and (.name | test("^E2E \\(.*, [0-9]+/[0-9]+\\)$")))
       | .name | capture(", (?<k>[0-9]+)/(?<n>[0-9]+)\\)$")] as $shards
      | if ($shards | length) == 0 then "no browser-test shard"
        elif ($shards | map(.n) | unique | length) != 1 then "the shards disagree on their count"
        elif ($shards | map(.k) | unique | length) != ($shards[0].n | tonumber)
          or ($shards | length) != ($shards[0].n | tonumber) then "a browser-test shard is missing"
        else "ok" end
    end'
}

for id in $runs; do
  run=$(gh api "repos/$REPO/actions/runs/$id") || { echo "Run $id: unreadable" >&2; continue; }
  verdict=$(run_verdict <<< "$run") || verdict="unreadable"
  if [ "$verdict" != ok ]; then echo "Run $id: $verdict" >&2; continue; fi

  jobs=$(gh api "repos/$REPO/actions/runs/$id/jobs?per_page=100") || { echo "Run $id: jobs unreadable" >&2; continue; }
  verdict=$(jobs_verdict <<< "$jobs") || verdict="unreadable"
  if [ "$verdict" != ok ]; then echo "Run $id: $verdict" >&2; continue; fi

  echo "Tree $tree was tested by pull request run $id: promoting." >&2
  answer true
done

refuse "no trusted run recorded this tree"
