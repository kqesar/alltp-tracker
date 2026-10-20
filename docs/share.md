# Sharing a run through its URL

The toolbar's **Share** button copies a link that holds the player's run. There is no server: the run travels in the address's **fragment** (`#run=…`), the part after the `#`, which the browser keeps to itself and never puts in a request. Opening the link asks before replacing anything.

## Format

```
https://<site>/alltp-tracker/#run=<base64url( deflate-raw( minified export ) )>
```

- The payload is what **Export** writes (`{ format, game, version, progress }`), so the receiving game reads it with the validation and migrations it already has for a file. The format needs no version of its own: a save carries its version, and `migrate` upgrades an old one.
- Compression is the browser's own `CompressionStream("deflate-raw")`: no dependency, a few milliseconds, the same call to read it back. Base64url (`-` and `_`, no padding) needs no escaping in an address.
- `window.location` on the site, the published site's address from the desktop app (`utils/view.ts`, `shareBaseUrl`): the app's own address, `tauri://localhost`, opens nowhere else.

```mermaid
sequenceDiagram
  actor A as Player
  participant TA as Tracker (A)
  participant Chat as Chat / any channel
  participant TB as Tracker (B)
  actor B as Viewer
  A->>TA: Share
  TA->>TA: export, minify, deflate, base64url
  TA->>A: link on the clipboard
  A->>Chat: paste the link
  Chat->>B: the link
  B->>TB: opens it (the fragment stays in the browser)
  TB->>TB: decode under the bounds, read the game, importRun (validation)
  TB->>B: "Open this shared run?"
  alt Open
    B->>TB: Open
    TB->>TB: load as Import does (one undo step), clear the fragment
  else Keep mine
    B->>TB: Keep mine
    TB->>TB: clear the fragment, nothing else
  end
```

## Opening a link

`SharedRunPrompt` (`components/ui/`), one of the page's notices in each game's app, never in the stream view:

1. It reads `#run=` when the page loads and on `hashchange`, so a link opened in a tab already on the tracker asks too.
2. `decodeRun` bounds the payload: at most 64 K characters, and at most 1 MiB once inflated. The inflation is read chunk by chunk and stops at the limit, so a deflate bomb (a few hundred bytes that inflate to gigabytes) costs one megabyte at most.
3. The envelope is checked with Zod (`format`, and a `game` among the known ones), then the **game's own import** (`importRun` in `games/<id>/module.ts`, which is the `parseSave` of Import) checks the run: ALttPR's `validateProgress` against its tables, Super Metroid's and SMZ3's Zod schemas, counts within their pools.
4. Only then does the notice ask. **Open** loads the run exactly as Import does (one undo step; ALttPR's timer goes idle) and clears the fragment. **Keep mine** only clears the fragment.
5. A payload that does not decode, is not a tracker save, or fails a game's validation shows its reason and "Nothing was changed". Nothing is applied before Open, and the text of a refusal is cut short, since a hostile link controls it.

A link for another game is laid in that game's store, then the page loads again on it, as the game picker does (`switchGame`). The undo point does not survive that reload.

## Length

A link goes through chat apps, so its length matters. Browsers take hundreds of kilobytes (Chrome 2 MB, Firefox 1 MB, Safari 80 KB); Discord cuts a message at 2000 characters, the strictest of the common ones.

Measured on runs played through the real stores, a click or a check every 20 to 100 seconds, with the site's address (44 characters) included (`share/runLink.spec.ts`):

| Run | Early (~15 %) | Mid (~50 %) | Late (~95 %) |
|---|---|---|---|
| Super Metroid | 414 | 427 | 418 |
| ALttPR, full | 2580 | 4922 | 7135 |
| ALttPR, without its timeline | 1403 | 1943 | 2603 |
| SMZ3 | 1512 | 2522 | 3402 |

What the tracker does about it:

- **ALttPR drops its timeline** when the full link passes 2000 characters, and says so ("Link copied without the timeline, to keep it short"). The timeline dates every find with an epoch instant and a timer reading, which no compression can predict: it is two thirds of a late run. The shared run still imports; only "when" is lost.
- **Past 2000 characters anyway** (a late ALttPR run, a mid or late SMZ3 run), the link is copied all the same and the status warns that some chat apps will cut it. It works wherever it is pasted whole: browsers, most messengers, a message edited by hand.
- Not done, and why: SMZ3's checked locations are most of its link: each is a distinct string (`"palace-of-darkness/dark-maze/top"`) that deflate cannot predict. A bitset indexed by the pack's location order would shrink them to a few dozen bytes, but it ties old links to the pack's table (a port of upstream that gains a location shifts every index), so it needs a table digest in the payload and a refusal of links from another table. Worth it only if SMZ3 links in chat become common.
- A QR code holds about 2.9 KB in binary: it would carry the timeline-free forms of ALttPR and Super Metroid, not a late SMZ3 run.

## What it does not do

- **No live following.** A link is a snapshot. Following a player (a restream, a second screen) needs a relay; the options are in the project's evolution notes (LAN through the desktop app, or a Cloudflare Durable Object).
- **The desktop app cannot open a link itself.** Its webview has no address bar and no `#run=` to read: a viewer opens the link in a browser, where the run lives apart from the app's own.
- **The clipboard is the only output.** `shareRun` hands the copy to the browser as a promise inside the click (Safari wants the copy there) and falls back to `writeText`; if the browser refuses, the status says so.

## Files

| File | Role |
|---|---|
| `apps/web/src/share/runLink.ts` | Encode, decode under the bounds, envelope, fragment helpers |
| `apps/web/src/share/shareRun.ts` | Share's action: tiers, clipboard, the status line |
| `apps/web/src/components/ui/SharedRunPrompt.tsx` | The notice that asks, opens or keeps |
| `apps/web/src/games/*/module.ts` | `importRun`, the game's own validation |
| `apps/web/e2e/share.e2e.ts` | Share, open in a fresh browser, Keep mine, hostile links, axe |
