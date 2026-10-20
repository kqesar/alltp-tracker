#!/usr/bin/env bash
# Did a pull request of this repository already test the tree of the pushed
# commit, in full? Prints `tested=true` or `tested=false` (and appends it to
# $GITHUB_OUTPUT when set). docs/ci.md says why, and what makes a record
# trustworthy.
#
# The record is the artifact `tested-full-<tree>` that the `tested` job of
# ci.yml uploads once every test job of a pull request has passed AND its unit
# tests ran in full: a pull request that ran only the specs its changes reach
# records nothing, and master tests its tree. (The name is the contract: an
# earlier `tested-<tree>` record meant no such thing and is never looked up.)
# An artifact proves nothing by itself: any run can upload one under any name,
# and a pull request runs its own copy of the workflows. So a record counts
# only if the run that holds it:
#   - belongs to a pull request whose head is in this repository, never a fork
#     (a fork's workflows are the fork author's code);
#   - is ci.yml, on the `pull_request` event, completed and successful;
#   - has a successful `ci` job whose step FULL_STEP (ci.yml) succeeded, so
#     the whole unit suite ran, and every browser-test shard (all of the n in
#     "k/n"), and no job that failed;
#   - recorded the tree of the commit it tested: the record names that commit
#     (the pull request's test merge), whose tree must be this one and whose
#     parent must be the run's own head commit;
#   - is the newest completed run holding this tree, and no newer run of the
#     same commit failed: a green run does not outvote a red one.
#
# Any doubt, or any error, answers `false`: the full pipeline runs.
#
# Environment: GH_TOKEN, REPO (owner/name), AFTER (the pushed commit).
set -uo pipefail

# The step of the `ci` job that runs the whole unit suite: keep its name in
# step with ci.yml. A rename there only stops promotions, never allows one.
FULL_STEP="Run the unit tests in full"

# How many runs holding a record are listed: newest first, but only the
# newest completed one decides, so this only bounds the runs still going
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

# Artifacts of a fork's run are listed too, with that fork as head repository.
# One line per run, newest first: run id, artifact id
candidates=$(gh api "repos/$REPO/actions/artifacts?name=tested-full-$tree&per_page=100" --jq "
  [.artifacts[]
   | select(.expired | not)
   | select(.workflow_run.head_repository_id == .workflow_run.repository_id)
   | {run: .workflow_run.id, artifact: .id}]
  | unique_by(.run) | reverse | .[0:$MAX_RUNS] | .[] | \"\\(.run) \\(.artifact)\"") \
  || refuse "the artifacts could not be listed"
[ -n "$candidates" ] || refuse "no pull request has recorded this tree in full"

# The run must be what the record claims; only exact answers pass. A run
# still going is not an answer yet.
run_verdict() {
  jq -r --arg repo "$REPO" '
    if .status != "completed" then "pending"
    elif .event != "pull_request" then "not a pull_request run"
    elif .path != ".github/workflows/ci.yml" then "not the CI workflow"
    elif .conclusion != "success" then "the run did not succeed"
    elif .repository.full_name != $repo or .head_repository.full_name != $repo
      or .head_repository.id != .repository.id or .head_repository.fork then "the head is not this repository"
    else "ok" end'
}

# The jobs must be what a complete run holds
jobs_verdict() {
  jq -r --arg step "$FULL_STEP" '
    if .total_count != (.jobs | length) then "the job list is truncated"
    elif [.jobs[] | select(.conclusion != "success" and .conclusion != "skipped")] | length > 0
      then "a job did not succeed"
    elif [.jobs[] | select(.name == "ci" and .conclusion == "success")] | length != 1
      then "the ci job did not succeed"
    elif [.jobs[] | select(.name == "ci") | (.steps // [])[] | select(.name == $step and .conclusion == "success")]
      | length != 1 then "the unit tests did not run in full"
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

# The record must name the commit its own run tested: the test merge, whose
# tree is the recorded one and whose parents hold the run's head commit.
# Arguments: run id, artifact id, the run's head commit
bound_verdict() {
  local run_id=$1 artifact=$2 head=$3 zip content merge commit
  zip=$(mktemp) || { echo "no temporary file"; return; }
  if ! gh api "repos/$REPO/actions/artifacts/$artifact/zip" > "$zip"; then
    rm -f "$zip"; echo "the record could not be downloaded"; return
  fi
  content=$(unzip -p "$zip" tested.txt 2>/dev/null)
  rm -f "$zip"
  merge=$(sed -n 's/^merge commit \([0-9a-f]\{40\}\)$/\1/p' <<< "$content")
  [ -n "$merge" ] || { echo "the record names no commit"; return; }
  [ "$(sed -n 's/^run \([0-9]*\)$/\1/p' <<< "$content")" = "$run_id" ] \
    || { echo "the record belongs to another run"; return; }
  commit=$(gh api "repos/$REPO/git/commits/$merge") || { echo "the recorded commit could not be read"; return; }
  jq -r --arg tree "$tree" --arg head "$head" '
    if .tree.sha != $tree then "the recorded commit has another tree"
    elif (.parents | map(.sha) | index($head)) == null then "the recorded commit does not contain the run head"
    else "ok" end' <<< "$commit" || echo "unreadable"
}

while read -r id artifact; do
  [[ "$id" =~ ^[0-9]+$ && "$artifact" =~ ^[0-9]+$ ]] || refuse "unexpected candidate '$id $artifact'"
  run=$(gh api "repos/$REPO/actions/runs/$id") || refuse "run $id could not be read"
  verdict=$(run_verdict <<< "$run") || verdict="unreadable"
  if [ "$verdict" = pending ]; then echo "Run $id is still going: looking at the one before." >&2; continue; fi
  # The newest completed run decides: an older green one never outvotes it
  [ "$verdict" = ok ] || refuse "run $id: $verdict"

  jobs=$(gh api "repos/$REPO/actions/runs/$id/jobs?per_page=100") || refuse "the jobs of run $id could not be read"
  verdict=$(jobs_verdict <<< "$jobs") || verdict="unreadable"
  [ "$verdict" = ok ] || refuse "run $id: $verdict"

  head=$(jq -r '.head_sha' <<< "$run")
  [[ "$head" =~ ^[0-9a-f]{40}$ ]] || refuse "run $id: unexpected head commit"
  verdict=$(bound_verdict "$id" "$artifact" "$head")
  [ "$verdict" = ok ] || refuse "run $id: $verdict"

  # The same commit pushed again (a pull request closed and reopened, say) and
  # failed since: the newer result wins
  newer=$(gh api "repos/$REPO/actions/workflows/ci.yml/runs?event=pull_request&head_sha=$head&per_page=100" \
    --jq "[.workflow_runs[] | select(.id > $id and .status == \"completed\" and .conclusion != \"success\")] | length") \
    || refuse "the runs of commit $head could not be listed"
  [ "$newer" = 0 ] || refuse "run $id: a newer run of the same commit did not succeed"

  echo "Tree $tree was tested by pull request run $id: promoting." >&2
  answer true
done <<< "$candidates"

refuse "no completed run recorded this tree"
