# Sharing a run through its URL

The toolbar's **Share** button copies a link that holds the player's run and opens a dialog that shows the same link as a QR code. There is no server: the run travels in the address's **fragment** (`#run=…`), the part after the `#`, which the browser keeps to itself and never puts in a request. Opening the link asks before replacing anything.

## Format

```
https://<site>/alltp-tracker/#run=<base64url( deflate-raw( JSON ) )>
```

The JSON is one of two forms, told apart by its `format`:

- **Plain** (`alltp-tracker-save`, the first version's, and still what Super Metroid writes): what **Export** writes, `{ format, game, version, progress }`. The receiving game reads it with the validation and migrations it already has for a file; a save carries its version, and `migrate` upgrades an old one.
- **Packed** (`alltp-tracker-link`, `link: 2`; ALttPR and SMZ3): the same object with the fields that dominate its size swapped for bytes indexed by the pack's ordered tables (below), plus the `sizes` of those tables and a `table` digest of their contents. It is expanded back to a plain save before the game's import sees it, so the validation, the migrations and the undo step are the plain form's.

The decoder accepts both; the encoder writes the packed form where a game has one. A link made by any earlier version still opens as it did (`unpackLink` passes a plain save through untouched).

- Compression is the browser's own `CompressionStream("deflate-raw")`: no dependency, a few milliseconds, the same call to read it back. Base64url (`-` and `_`, no padding) needs no escaping in an address.
- `window.location` on the site, the published site's address from the desktop app (`utils/view.ts`, `shareBaseUrl`): the app's own address, `tauri://localhost`, opens nowhere else.

### The packed form

`share/packed.ts` holds the mechanism; each game's `share.ts` (`games/alttpr/share.ts`, `games/smz3/share.ts`) names its fields and their tables. A field travels as base64url bytes inside the JSON (so deflate still sees one text), in `progress` where the plain form has its object or list.

| Field | Game | Packed as |
|---|---|---|
| `checked` | ALttPR, SMZ3 | A bitset over the pack's ordered locations (bit `i` is `locations[i]`): 217 locations are 28 bytes, 316 are 40. The ids are most of a late SMZ3 link, each a distinct string no compression predicts. |
| `items` | ALttPR | Varints over the item table's order (a flag is 0 or 1, a counter its signed value). The key names were the second weight after `checked`. |
| `timeline` | ALttPR | See below. |

**The tables, their sizes and their digest.** A bit or an index means whatever the table's order says it means: a table that gains an entry in the middle shifts every index after it. So the tables are **append-only**: a new location or item goes at the end, and none is moved or removed. The link carries `sizes`, how long each table was when it was made, and `table`, a 32-bit FNV-1a of those prefixes' contents (six base64url characters). The reader cuts its own tables to the link's sizes, rebuilds what depends on them, and compares the digest:

- the digest matches: the link reads against the prefix it was made with. What the link does not hold (an item added since) is left to the game's own import, which gives it the value a fresh run has;
- it does not match (a table reordered, an entry changed or removed), a size is longer than the tracker's table (a newer tracker made it), or `link` is not 2: the link is refused with "This link comes from another version of the tracker" and nothing is changed.

This is what keeps old links alive when the tracker grows: adding the half magic cell, or a location, no longer breaks a link made before. A table that is reordered or cut still refuses every link made against it, which is the point of the digest. The digest guards against an accident, not against malice: a hostile link can claim any digest, and the game's own validation still judges what comes out.

Where each table's order comes from:

| Table | Order |
|---|---|
| ALttPR locations | The pack's (`MAP_LOCATIONS`). A new location must come after the existing ones; a spec holds the link made before the sizes to it. |
| ALttPR items | `SHARE_ITEMS` in `games/alttpr/share.ts`, written out: the order links first shipped with, which neither the grid nor `data/items.ts` moves. A new item is appended; a spec fails until it is. |
| ALttPR timeline keys | Derived from the items and locations the link was made against, through `isTimelineKey`, so the key table cannot drift from what an import accepts, and an older link's key indices (and the bits each takes) are the ones it was written with. The digest covers them too. |
| SMZ3 locations | The pack's regions' order (`LOCATION_IDS`), appended to as above. |

A link written before `sizes` existed (the first packed links) carries none: it is read as the tables had the sizes `legacySizes` names, and its digest still has to match.

**The timeline** (`timelineField`) is the heaviest field, a find's key and instant being close to noise. It is written as varints (count, first instant, a Rice parameter, then the timer readings as runs) followed by a bit block: each find's key in a fixed number of bits (an index in the key table), then the time since the previous find as a Rice code, which costs a bit or two over the gap's magnitude and so takes a long wait without making every gap pay. The finds are ordered by instant. A timer reading is stored as its *drift* from the clock (`at - ms`): a timer running straight keeps one drift, so a stretch of finds is a single run; a pause or a stop starts another; `null` (timer not started) is a run of its own. Bits rather than bytes because a varint's continuation bits make deflate's job harder: measured on a late run, byte-aligned varints cost about 1470 characters of the link, the bit block about 1110.

A save the codec cannot hold exactly (an id the pack does not list, an instant that is not a whole number, a field of another shape) is not packed: it is written plain, which any version opens.

**Bounds.** Everything below is checked at the boundary, before the game's own validation sees the run:

- the payload and inflation bounds above are unchanged: 64 K characters, 1 MiB inflated, and a deflate bomb stops at the limit;
- the envelope is validated with Zod (`format`, `game`, `link`, `table`, `sizes` when present, `progress` an object); sizes are whole numbers, one per table, none longer than the table;
- a packed field is base64url, and its bytes are checked against the table: a bitset is exactly `ceil(n / 8)` bytes with no bit past the table's end; items are exactly one value per table entry, a flag 0 or 1; a timeline has at most one find per key, keys inside the table, no number above 2^50, runs that cover exactly the finds, a Rice parameter of at most 40, and no byte or bit left over. Each read returns "not a tracker run" on any failure, never a partial value.

```mermaid
sequenceDiagram
  actor A as Player
  participant TA as Tracker (A)
  participant Chat as Chat / any channel
  participant TB as Tracker (B)
  actor B as Viewer
  A->>TA: Share
  TA->>TA: export, pack the fields, deflate, base64url
  TA->>A: link on the clipboard
  A->>Chat: paste the link
  Chat->>B: the link
  B->>TB: opens it (the fragment stays in the browser)
  TB->>TB: decode under the bounds, read the game, importRun (unpack, then validation)
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
3. The envelope is checked with Zod (`format`, plain or packed, and a `game` among the known ones). The **game's own import** (`importRun` in `games/<id>/module.ts`) then expands a packed link (a link whose tables are not a prefix of this tracker's is refused here) and checks the run with the `parseSave` of Import: ALttPR's `validateProgress` against its tables, Super Metroid's and SMZ3's Zod schemas, counts within their pools.
4. Only then does the notice ask. **Open** loads the run exactly as Import does (one undo step; ALttPR's timer goes idle) and clears the fragment. **Keep mine** only clears the fragment.
5. A payload that does not decode, is not a tracker save, or fails a game's validation shows its reason and "Nothing was changed". Nothing is applied before Open, and the text of a refusal is cut short, since a hostile link controls it.

A link for another game is laid in that game's store, then the page loads again on it, as the game picker does (`switchGame`). The undo point does not survive that reload.

## The Share dialog and its QR code

Share does two things in one click, the same in the three games (`components/ui/ShareDialog.tsx`, on the shared `Modal`):

1. **It copies the link at once.** `shareRun` starts the copy before its first `await`: the text goes to the browser as a promise inside a `ClipboardItem` (Safari wants the copy to start in the click and accepts the text a moment later), with `writeText` as the fallback. It returns `{ link, message }`: the link made and the line to tell the player.
2. **It opens the dialog** "Share this run": the line in a `role="status"` region ("Copying…" while the link is made, then copied, copied without the timeline, long-link warning, clipboard refused, or the `RunLinkError` message), the QR code of that very link (same tier, same fallback rule), a line of help (scan it to open the run on another device; a snapshot that does not follow the game) and **Copy the snapshot link** (named after what it copies: in the desktop app it sits under live follow's own link), a `writeText` inside its own click that updates the line. The toolbar's status no longer announces Share.

A clipboard refusal still shows the QR code: it is the way out then. No link at all (`RunLinkError`, a browser that cannot compress) shows only the reason.

```mermaid
sequenceDiagram
  actor P as Player
  participant B as Share button
  participant S as shareRun
  participant D as ShareDialog
  participant Q as QrCode chunk
  P->>B: click
  B->>S: shareRun(saves): the copy starts here
  B->>D: share promise, dialog opens ("Copying...")
  S-->>D: { link, message }
  D->>Q: lazy import, once, on first display
  Q-->>D: SVG of the link
  P->>D: Copy the snapshot link (writeText in the click)
```

### The code

- **Library: `lean-qr`** (MIT, no dependencies, about 3.6 KB gzipped for `generate`, actively maintained). It picks the smallest version that holds the text and the highest error correction that fits that version, and segments the text into the cheapest modes. Called with `minCorrectionLevel: correction.L`, so correction never costs a bigger version than needed. The alternatives: `uqr` (about 3.9 KB gzipped, comparable, less active), `qrcode-generator` (about 7.6 KB gzipped) and `qrcode` (heavier, with dependencies, aimed at Node and canvas).
- **Zero bytes on page load.** `ShareDialog` loads `QrCode` with `lazy(() => import(...))`, so `lean-qr` sits in a chunk of its own (about 3.9 KB gzipped) fetched the first time the dialog shows a link; the entry chunk and the games' chunks do not change.
- **Drawing.** One inline SVG `<path>`: each horizontal run of dark modules is one `M x y h n v1 h-n z` rectangle (`modulesPath`), the `viewBox` holds the 4-module quiet zone, `shape-rendering="crispEdges"`. Dark modules are black on a white ground in every theme, because a scanner needs dark on light. `role="img"` with an `aria-label`. The square is `min(100%, 320px)` wide, so it never overflows the dialog on a phone.
- **A link a QR code cannot hold** (past version 40, about 2.9 KB: `generate` throws) shows a sentence in place of the code. No case in the table above gets there.

Sizes measured on real links (all decoded with `zbarimg`, at 2 and at 3 pixels per module):

| Link | Characters | Version | Modules |
|---|---|---|---|
| Super Metroid | ~420 | 13 | 69 |
| ALttPR without its timeline | ~550 | 16 | 81 |
| SMZ3 | ~1030 | 23 | 109 |
| ALttPR, late, with its timeline | ~1650 | 30 | 137 |
| 2000 characters | 2000 | 33 | 149 |

## Length

A link goes through chat apps, so its length matters. Browsers take hundreds of kilobytes (Chrome 2 MB, Firefox 1 MB, Safari 80 KB); Discord cuts a message at 2000 characters, the strictest of the common ones.

Measured on runs played through the real stores, a click or a check every 20 to 100 seconds, with the site's address (44 characters) included (`share/runLink.spec.ts`, which fails if a case passes 2000). The first version's lengths are in parentheses:

| Run | Early (~15 %) | Mid (~50 %) | Late (~95 %) |
|---|---|---|---|
| Super Metroid (plain) | 414 | 427 | 418 |
| ALttPR, with its timeline | 898 (2580) | 1322 (4922) | 1651 (7135) |
| ALttPR, without its timeline | 548 (1403) | 571 (1943) | 543 (2603) |
| SMZ3 | 998 (1512) | 1031 (2522) | 999 (3402) |

Every case is under 2000, the timeline included: a late ALttPR run is 1651, and a late SMZ3 run costs the same as an early one, since its checked locations are now a constant 40 bytes. Super Metroid stays plain: its link is about 420 characters, nothing the packing could shorten enough to be worth tying it to a table.

The synthetic runs are a floor on the timeline's cost, not a ceiling: their gaps are uniform between 20 and 100 seconds, about 16 bits of noise a find. A real run has pauses and bursts (a dungeon cleared in a minute, then ten minutes of travel), which the Rice code takes at no more than the bits their magnitude says. What would break the target is a run of about 300 finds or more (a late ALttPR run has about 220), each costing about 5 characters of the link.

What the tracker does about it:

- **The timeline is kept when it fits.** If a full link still passes 2000 characters, ALttPR drops its timeline and says so ("Link copied without the timeline, to keep it short"); the shared run still imports, only "when" is lost. After packing this is a safety net, not the usual case.
- **Past 2000 characters anyway**, the link is copied all the same and the status warns that some chat apps will cut it. It works wherever it is pasted whole: browsers, most messengers, a message edited by hand.
- **Where the rest of a link goes.** The remainder (about 500 characters for ALttPR with nothing else in it) is the run's settings and fixed keys, the envelope, the site's address and deflate's header. It does not grow with the run, which is what keeps the late cases flat.
- A QR code holds about 2.9 KB in binary: every case above fits one (see below).

## What it does not do

- **No live following.** A link is a snapshot. Following a player live needs a relay, which a page cannot open: the desktop app has one, for devices on the same network (a phone, a second screen; no hosted server, so no remote restream). See [Live follow on the LAN](desktop.md#live-follow-on-the-lan).
- **The desktop app cannot open a link itself.** Its webview has no address bar and no `#run=` to read: a viewer opens the link in a browser, where the run lives apart from the app's own.
- **No account, no server-side short link.** The link and its QR code are all there is: the code is drawn in the page from the same address, and nothing is stored anywhere.

## Files

| File | Role |
|---|---|
| `apps/web/src/share/runLink.ts` | Encode, decode under the bounds, envelope, fragment helpers |
| `apps/web/src/share/packed.ts` | The packed form: codec framework, table sizes and digest, bitset field, pack and unpack |
| `apps/web/src/share/bytes.ts` | Base64url, varints, bit writer and reader (Rice codes) |
| `apps/web/src/games/alttpr/share.ts`, `games/smz3/share.ts` | A game's codec: its fields and the append-only tables they index |
| `apps/web/src/share/shareRun.ts` | Share's action: tiers, clipboard, the line for the dialog; `copyLink` for the footer's copy |
| `apps/web/src/components/ui/ShareDialog.tsx` | The dialog Share opens: outcome line, QR code, Copy the snapshot link |
| `apps/web/src/components/ui/QrCode.tsx` | The QR code as one SVG path (lazy chunk with `lean-qr`) |
| `apps/web/src/components/ui/SharedRunPrompt.tsx` | The notice that asks, opens or keeps |
| `apps/web/src/games/*/module.ts` | `importRun`, the game's own validation |
| `apps/web/e2e/share.e2e.ts` | Share and its dialog (keyboard, axe), open in a fresh browser (packed and plain), Keep mine, another version's link, hostile links, axe |
| `apps/web/e2e/fixtures/share-v1-*.json` | Real exports, made into the first version's links by the e2e test |
