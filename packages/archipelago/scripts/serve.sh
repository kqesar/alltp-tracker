#!/bin/sh
# serve.sh <multiworld.archipelago> <host> <port> [extra server args...]
# Hosts a copy of the multiworld with the frozen AP server of the release in
# $AP_DIR (the extracted Archipelago_<version>_linux-x86_64.tar.gz), saves
# off, in a temp HOME. Hosting needs no ROM. Used by record-fixtures.mjs, and
# by hand for test/real-server.spec.ts (README, "Checked against a real server").
set -eu
: "${AP_DIR:?set AP_DIR to the extracted Archipelago release, the folder holding ArchipelagoServer}"
MW=$1; HOST=$2; PORT=$3; shift 3
RUN=$(mktemp -d "${TMPDIR:-/tmp}/ap-serve-$PORT.XXXXXX")
cp "$MW" "$RUN/"
cd "$RUN"
# The server reads its console from stdin: keep it open and empty.
tail -f /dev/null | HOME="$RUN" exec "$AP_DIR/ArchipelagoServer" \
  --host "$HOST" --port "$PORT" --disable_save --loglevel debug "$@" "$RUN/$(basename "$MW")"
