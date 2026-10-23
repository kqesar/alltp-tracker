# Documentation

## For players

- [User guide](guide.md): every feature, game by game, with autotracking, voice commands,
  OBS, offline use and the desktop app.

## For contributors

- [Development](development.md): setup, commands, the repository's layout, the service worker.
- [CI and releases](ci.md): what runs on a pull request, on `master` and at night, and how a
  release is cut.
- [Sharing a run](share.md): the link format, its bounds, how it is opened and validated, its
  measured lengths, and the Share dialog's QR code.
- [Desktop app](desktop.md): the Tauri app, its updates, global shortcuts, application menu and
  live follow on the LAN.
- [Search engines and link previews](seo.md): the per-game pages, their tags and preview
  images.
- [Logic engine](../packages/engine/README.md): the rule language and the three-valued solver.
- [Autotracking](../packages/autotrack/README.md): the SNI and RetroArch link, the session,
  Race Mode.
- [ALttPR pack](../packs/alttpr/README.md): the v31 rules ported from the randomizer, and the
  upstream tests they are held to.
- [Super Metroid pack](../packs/sm/README.md): Map Rando's items, objectives and memory map.
- [SMZ3 pack](../packs/smz3/README.md): samus.link's logic for both games, and its tests.
