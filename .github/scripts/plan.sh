#!/usr/bin/env bash
# What has the CI pipeline to do for this push to master, or for this nightly
# run? Prints `mode=skip`, `mode=promote` or `mode=full` (and appends it to
# $GITHUB_OUTPUT when set). docs/ci.md has the decision diagram.
#
#   skip     nothing: a release commit changes nothing the tests or the site
#            can see, and a nightly run finds master unchanged since the last
#            green full run;
#   promote  no tests, only the site's build and deploy: a pull request of
#            this repository already tested this exact tree;
#   full     tests, then deploy (the nightly run does not deploy).
#
# Anything else, and any failure of a script below, is `full`. A release
# commit is checked first: it is never promoted.
#
# Environment: EVENT_NAME (push or schedule; the other events have no plan),
# plus the inputs of the scripts below: GH_TOKEN, REPO, BEFORE, AFTER.
set -uo pipefail

here=$(dirname "${BASH_SOURCE[0]}")

answer() {
  echo "mode=$1"
  [ -z "${GITHUB_OUTPUT:-}" ] || echo "mode=$1" >> "$GITHUB_OUTPUT"
  exit 0
}

# The value a script prints for a key; its stderr is the log of this step
ask() {
  GITHUB_OUTPUT='' bash "$here/$1" | sed -n "s/^$2=//p"
}

case "${EVENT_NAME:-}" in
  push)
    [ "$(ask is-release-commit.sh release)" = true ] && answer skip
    [ "$(ask find-tested-tree.sh tested)" = true ] && answer promote
    answer full
    ;;
  schedule)
    [ "$(ask nightly-needed.sh needed)" = false ] && answer skip
    answer full
    ;;
  *)
    answer full
    ;;
esac
