#!/usr/bin/env bash
# Writes the updater's latest.json for a release from the installers and the
# signatures already attached to it, and attaches it. The desktop builds run in
# parallel: when each one wrote latest.json itself, two writing at once lost one
# side's entries (v2.42.0 shipped without its Linux ones), so the last job of
# desktop-release.yml writes it once, after every build (docs/desktop.md,
# "Releases").
#
# Usage: updater-json.sh <tag> [--dry-run]   (GH_REPO and GH_TOKEN set)
# Exits 1, attaching nothing, when an installer or its signature is missing.
set -euo pipefail

tag=${1:?usage: updater-json.sh <tag> [--dry-run]}
dry_run=${2:-}
version=${tag#v}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# Each updater platform key and the installer it points at, by file name
# suffix; the keys are the ones tauri-action wrote (Tauri's updater reads
# <os>-<arch> first, then <os>-<arch>-<bundle>)
platforms=(
  "darwin-aarch64       _aarch64.app.tar.gz"
  "darwin-aarch64-app   _aarch64.app.tar.gz"
  "darwin-x86_64        _x64.app.tar.gz"
  "darwin-x86_64-app    _x64.app.tar.gz"
  "linux-x86_64         _amd64.AppImage"
  "linux-x86_64-appimage _amd64.AppImage"
  "linux-x86_64-deb     _amd64.deb"
  "linux-x86_64-rpm     .x86_64.rpm"
  "windows-x86_64       _x64-setup.exe"
  "windows-x86_64-nsis  _x64-setup.exe"
)

gh api "repos/$GH_REPO/releases/tags/$tag" --jq '.assets[] | [.name, .url] | @tsv' \
  > "$work/assets.tsv"

entries='{}'
for line in "${platforms[@]}"; do
  read -r key suffix <<< "$line"
  # The one installer of this version with that suffix (its .sig excluded)
  match=$(awk -F'\t' -v s="$suffix" -v v="$version" \
    'index($1, v) && substr($1, length($1) - length(s) + 1) == s' "$work/assets.tsv")
  if [ "$(printf '%s\n' "$match" | grep -c .)" != 1 ]; then
    echo "::error::$tag: expected one installer ending in $suffix for $key, found: ${match:-none}"
    exit 1
  fi
  name=${match%%$'\t'*}
  url=${match#*$'\t'}
  sig="$work/$name.sig"
  if ! gh release download "$tag" --pattern "$name.sig" --output "$sig" --clobber 2> /dev/null; then
    echo "::error::$tag: $name has no signature ($name.sig)"
    exit 1
  fi
  entries=$(jq --arg key "$key" --rawfile sig "$sig" --arg url "$url" \
    '. + {($key): {signature: ($sig | rtrimstr("\n")), url: $url}}' <<< "$entries")
done

jq -n --arg version "$version" --arg date "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
  --argjson platforms "$entries" \
  '{version: $version, notes: "", pub_date: $date, platforms: $platforms}' \
  > "$work/latest.json"

echo "latest.json for $tag: $(jq '.platforms | length' "$work/latest.json") platforms"
if [ "$dry_run" = --dry-run ]; then
  cat "$work/latest.json"
else
  gh release upload "$tag" "$work/latest.json" --clobber
fi
