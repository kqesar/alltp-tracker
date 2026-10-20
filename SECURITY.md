# Security

## Reporting a vulnerability

Report it privately through GitHub:
[Security → Report a vulnerability](https://github.com/kqesar/alltp-tracker/security/advisories/new).
Please do not open a public issue. Include what you found, how to reproduce it, and the
version (the site's build or the desktop app's release).

The maintainer aims to answer within a week. Once a fix is released, the advisory is published
with credit to you, unless you prefer otherwise.

## Scope

- The site, [kqesar.github.io/alltp-tracker](https://kqesar.github.io/alltp-tracker/), and
  its service worker.
- The desktop app for Windows, macOS and Linux, including its updater (the update manifest
  and the signature checked on each update) and its connections to SNI and RetroArch.
- The release pipeline that builds the installers and signs their updates.

Out of scope: SNI, QUsb2Snes, RetroArch, emulators and the randomizer sites the tracker reads
from (alttpr.com, maprando.com, samus.link). Report those to their own projects.

Only the latest release is supported.
