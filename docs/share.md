# Sharing a run through its URL

The toolbar's **Share** button copies a link that holds the player's run. There is no server: the run travels in the address's **fragment** (`#run=…`), the part after the `#`, which the browser keeps to itself and never puts in a request. Opening the link asks before replacing anything.

## Format

```
https://<site>/alltp-tracker/#run=<base64url( deflate-raw( JSON ) )>
```

The JSON is one of two forms, told apart by its `format`:

- **Plain** (`alltp-tracker-save`, the first version's, and still what Super Metroid writes): what **Export** writes, `{ format, game, version, progress }`. The receiving game reads it with the validation and migrations it already has for a file; a save carries its version, and `migrate` upgrades an old one.
- **Packed** (`alltp-tracker-link`, `link: 2`; ALttPR and SMZ3): the same object with the fields that dominate its size swapped for bytes indexed by the pack's ordered tables (below), plus a `table` digest. It is expanded back to a plain save before the game's import sees it, so the validation, the migrations and the undo step are the plain form's.

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

**The table digest.** A bit or an index means whatever the table's order says it means: a pack that gains a location shifts every index after it. The link therefore carries `table`, a 32-bit FNV-1a of the ordered tables it was indexed by (six base64url characters). A link whose digest is not the running tracker's, or whose `link` is not 2, is refused with "This link comes from another version of the tracker" and nothing is changed. The digest guards against an accident, not against malice: a hostile link can claim any digest, and the game's own validation still judges what comes out. ALttPR's tables are the locations, the item ids, and the timeline keys (derived from the items and locations through `isTimelineKey`, so the key table cannot drift from what an import accepts).

**The timeline** (`timelineField`) is the heaviest field, a find's key and instant being close to noise. It is written as varints (count, first instant, a Rice parameter, then the timer readings as runs) followed by a bit block: each find's key in a fixed number of bits (an index in the key table), then the time since the previous find as a Rice code, which costs a bit or two over the gap's magnitude and so takes a long wait without making every gap pay. The finds are ordered by instant. A timer reading is stored as its *drift* from the clock (`at - ms`): a timer running straight keeps one drift, so a stretch of finds is a single run; a pause or a stop starts another; `null` (timer not started) is a run of its own. Bits rather than bytes because a varint's continuation bits make deflate's job harder: measured on a late run, byte-aligned varints cost about 1470 characters of the link, the bit block about 1110.

A save the codec cannot hold exactly (an id the pack does not list, an instant that is not a whole number, a field of another shape) is not packed: it is written plain, which any version opens.

**Bounds.** Everything below is checked at the boundary, before the game's own validation sees the run:

- the payload and inflation bounds above are unchanged: 64 K characters, 1 MiB inflated, and a deflate bomb stops at the limit;
- the envelope is validated with Zod (`format`, `game`, `link`, `table`, `progress` an object);
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
3. The envelope is checked with Zod (`format`, plain or packed, and a `game` among the known ones). The **game's own import** (`importRun` in `games/<id>/module.ts`) then expands a packed link (a table digest that is not this tracker's is refused here) and checks the run with the `parseSave` of Import: ALttPR's `validateProgress` against its tables, Super Metroid's and SMZ3's Zod schemas, counts within their pools.
4. Only then does the notice ask. **Open** loads the run exactly as Import does (one undo step; ALttPR's timer goes idle) and clears the fragment. **Keep mine** only clears the fragment.
5. A payload that does not decode, is not a tracker save, or fails a game's validation shows its reason and "Nothing was changed". Nothing is applied before Open, and the text of a refusal is cut short, since a hostile link controls it.

A link for another game is laid in that game's store, then the page loads again on it, as the game picker does (`switchGame`). The undo point does not survive that reload.

## Length

A link goes through chat apps, so its length matters. Browsers take hundreds of kilobytes (Chrome 2 MB, Firefox 1 MB, Safari 80 KB); Discord cuts a message at 2000 characters, the strictest of the common ones.

Measured on runs played through the real stores, a click or a check every 20 to 100 seconds, with the site's address (44 characters) included (`share/runLink.spec.ts`, which fails if a case passes 2000). The first version's lengths are in parentheses:

| Run | Early (~15 %) | Mid (~50 %) | Late (~95 %) |
|---|---|---|---|
| Super Metroid (plain) | 414 | 427 | 418 |
| ALttPR, with its timeline | 895 (2580) | 1294 (4922) | 1630 (7135) |
| ALttPR, without its timeline | 536 (1403) | 552 (1943) | 520 (2603) |
| SMZ3 | 980 (1512) | 1015 (2522) | 982 (3402) |

Every case is under 2000, the timeline included: a late ALttPR run is 1630, and a late SMZ3 run costs the same as an early one, since its checked locations are now a constant 40 bytes. Super Metroid stays plain: its link is about 420 characters, nothing the packing could shorten enough to be worth tying it to a table.

The synthetic runs are a floor on the timeline's cost, not a ceiling: their gaps are uniform between 20 and 100 seconds, about 16 bits of noise a find. A real run has pauses and bursts (a dungeon cleared in a minute, then ten minutes of travel), which the Rice code takes at no more than the bits their magnitude says. What would break the target is a run of about 300 finds or more (a late ALttPR run has about 220), each costing about 5 characters of the link.

What the tracker does about it:

- **The timeline is kept when it fits.** If a full link still passes 2000 characters, ALttPR drops its timeline and says so ("Link copied without the timeline, to keep it short"); the shared run still imports, only "when" is lost. After packing this is a safety net, not the usual case.
- **Past 2000 characters anyway**, the link is copied all the same and the status warns that some chat apps will cut it. It works wherever it is pasted whole: browsers, most messengers, a message edited by hand.
- **Where the rest of a link goes.** The remainder (about 500 characters for ALttPR with nothing else in it) is the run's settings and fixed keys, the envelope, the site's address and deflate's header. It does not grow with the run, which is what keeps the late cases flat.
- A QR code holds about 2.9 KB in binary: every case above fits one.

## What it does not do

- **No live following.** A link is a snapshot. Following a player (a restream, a second screen) needs a relay; the options are in the project's evolution notes (LAN through the desktop app, or a Cloudflare Durable Object).
- **The desktop app cannot open a link itself.** Its webview has no address bar and no `#run=` to read: a viewer opens the link in a browser, where the run lives apart from the app's own.
- **The clipboard is the only output.** `shareRun` hands the copy to the browser as a promise inside the click (Safari wants the copy there) and falls back to `writeText`; if the browser refuses, the status says so.

## Files

| File | Role |
|---|---|
| `apps/web/src/share/runLink.ts` | Encode, decode under the bounds, envelope, fragment helpers |
| `apps/web/src/share/packed.ts` | The packed form: codec framework, table digest, bitset field, pack and unpack |
| `apps/web/src/share/bytes.ts` | Base64url, varints, bit writer and reader (Rice codes) |
| `apps/web/src/games/alttpr/share.ts`, `games/smz3/share.ts` | A game's codec: its fields and the tables they index |
| `apps/web/src/share/shareRun.ts` | Share's action: tiers, clipboard, the status line |
| `apps/web/src/components/ui/SharedRunPrompt.tsx` | The notice that asks, opens or keeps |
| `apps/web/src/games/*/module.ts` | `importRun`, the game's own validation |
| `apps/web/e2e/share.e2e.ts` | Share, open in a fresh browser (packed and plain), Keep mine, another version's link, hostile links, axe |
| `apps/web/e2e/fixtures/share-v1-*.json` | Real exports, made into the first version's links by the e2e test |
