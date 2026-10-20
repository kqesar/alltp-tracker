#!/usr/bin/env bash
# May release-please tag the release pull requests merged and still waiting for
# a tag? It tags each at ITS merge commit M, not at the commit of the run, so a
# release delayed by a red master or a replaced run would otherwise be tagged
# on a tree nobody verified, and the desktop installers built from it. Exits 0
# when every pending release is acceptable, 1 with an explicit error otherwise
# (docs/ci.md, "Releases").
#
# A pending release is accepted when, for its merge commit M (first match):
#   run      M is the commit of this run: its deploy succeeded, or plan skipped
#            it with a deployed parent;
#   built    M is a release commit (only the version moves, is-release-commit.sh)
#            whose parent is the commit of this run: the run just verified it;
#   green    a push run of ci.yml on M succeeded: tested and deployed (or skipped
#            as a release commit over a deployed parent);
#   parent   M is a release commit whose parent has such a green run.
# Anything else, or any doubt, refuses: nothing is tagged until a person decides
# (tag by hand after checking, or remove the label and cut a new release).
#
# Environment: GH_TOKEN, REPO (owner/name), RUN_SHA (the run's commit). The
# arguments, when given, are the merge commits to check instead of the pending
# pull requests' (to try the rules on past commits).
set -uo pipefail

here=$(dirname "${BASH_SOURCE[0]}")
CI_WORKFLOW="${CI_WORKFLOW:-ci.yml}"

: "${REPO:?REPO is required}" "${RUN_SHA:?RUN_SHA is required}"

# Does is-release-commit.sh say `release=true` for BEFORE..AFTER? $3 is
# REQUIRE_PARENT_DEPLOYED. Its stderr says why not.
is_release() {
  [ "$(GITHUB_OUTPUT='' BEFORE="$1" AFTER="$2" REQUIRE_PARENT_DEPLOYED="$3" \
    bash "$here/is-release-commit.sh" 2>/dev/null | sed -n 's/^release=//p')" = true ]
}

# A push run of ci.yml on this commit ended in success. An API failure counts
# as "no": a doubt refuses.
has_green_run() {
  local n
  n=$(gh api "repos/$REPO/actions/workflows/$CI_WORKFLOW/runs?head_sha=$1&event=push&status=success" \
    --jq '.total_count' 2>/dev/null) || return 1
  [ "${n:-0}" -ge 1 ]
}

# Prints why M is acceptable and returns 0, or returns 1
accept() {
  local m=$1 parent
  if [ "$m" = "$RUN_SHA" ]; then
    echo "this run's own commit"
    return 0
  fi
  parent=$(gh api "repos/$REPO/commits/$m" --jq '.parents | if length == 1 then .[0].sha else empty end' 2>/dev/null)
  [[ "$parent" =~ ^[0-9a-f]{40}$ ]] || return 1
  if [ "$parent" = "$RUN_SHA" ] && is_release "$parent" "$m" false; then
    echo "a release commit over the commit this run verified"
    return 0
  fi
  if has_green_run "$m"; then
    echo "a green $CI_WORKFLOW run on it"
    return 0
  fi
  if is_release "$parent" "$m" true; then
    echo "a release commit over a parent with a green $CI_WORKFLOW run"
    return 0
  fi
  return 1
}

if [ "$#" -gt 0 ]; then
  commits=("$@")
else
  # The labels are release-please's: it tags the merged pull requests that
  # carry `autorelease: pending`
  # A listing that fails must not look like an empty one: refuse
  listing=$(gh pr list --repo "$REPO" --base master --state merged \
    --label 'autorelease: pending' --json mergeCommit --limit 100 \
    --jq '.[].mergeCommit.oid // empty') \
    || { echo "::error::Could not list the pending release pull requests: nothing is tagged."; exit 1; }
  mapfile -t commits <<< "$listing"
  [ -n "$listing" ] || commits=()
fi

refused=0
for m in ${commits[@]+"${commits[@]}"}; do
  if why=$(accept "$m"); then
    echo "Release at $m accepted: $why."
  else
    refused=1
    echo "::error::Release at $m refused: no run verified this commit (it is neither this run's commit, nor a release commit over a verified parent, and it has no green $CI_WORKFLOW run). Nothing is tagged. Check it, then tag it by hand or remove the autorelease: pending label (docs/ci.md, \"Releases\")."
  fi
done
[ "$refused" = 0 ] || exit 1
[ "${#commits[@]}" -gt 0 ] || echo "No release waiting for a tag."
