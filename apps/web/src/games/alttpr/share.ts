// How an ALttPR run is packed into a shared link (share/packed.ts): its
// checked locations as a bitset over the pack's ordered locations, its item
// values and its timeline as varints over ordered tables. The link carries
// the tables' sizes and their digest, and a link of a shorter table (before
// an item or a location was added) still reads: the tables grow at the end.

import { MAP_LOCATIONS } from "@alltp/pack-alttpr";
import { DOOR_LOCATION_IDS } from "@/games/alttpr/data/doorRando";
import { items as freshItems, itemsMax } from "@/games/alttpr/data/items";
import { isTimelineKey } from "@/games/alttpr/logic/timeline";
import type { Stamp } from "@/games/stamp";
import {
  BitReader,
  BitWriter,
  ByteReader,
  ByteWriter,
  isCount,
  isSigned,
  MAX_FIELD_NUMBER,
  unzigzag,
  zigzag,
} from "@/share/bytes";
import {
  bitsetField,
  type FieldCodec,
  type Layout,
  LINK_VERSION,
  type PackCodec,
  packRun,
  type Tables,
  unpackRun,
} from "@/share/packed";

/**
 * The locations links index: the map's, then the Door Randomizer's (its key
 * drops, pots, enemies and shop items), appended so a link made before them
 * still reads. A run without them sets none of their bits, which deflate
 * carries in a few bytes.
 */
const LOCATIONS: readonly string[] = [...MAP_LOCATIONS, ...DOOR_LOCATION_IDS];

/**
 * The tracker's item ids in the order links index them: the order they had
 * when the packed form first shipped, which no later change of the grid or of
 * `data/items.ts` moves. A new item goes at the end (a spec holds this list
 * to the ids the tracker has), so a link made before it still reads, the new
 * item left as a fresh run has it.
 */
export const SHARE_ITEMS: readonly string[] = `
  blank bombos book boots byrna cape ether firerod flippers flute hammer
  hookshot icerod lantern mirror moonpearl mushroom net powder quake shoparrow
  shopkey shovel somaria agahnim agahnim2 boomerang bottle bow glove shield
  sword tunic
  bigkey0 bigkey1 bigkey2 bigkey3 bigkey4 bigkey5 bigkey6 bigkey7 bigkey8
  bigkey9
  map0 map1 map2 map3 map4 map5 map6 map7 map8 map9
  compass0 compass1 compass2 compass3 compass4 compass5 compass6 compass7
  compass8 compass9
  bigkey12 compass12 map10 map12
  boss0 boss1 boss2 boss3 boss4 boss5 boss6 boss7 boss8 boss9
  chest0 chest1 chest2 chest3 chest4 chest5 chest6 chest7 chest8 chest9 chest12
  reward0 reward1 reward2 reward3 reward4 reward5 reward6 reward7 reward8
  reward9
  magic
  hearts tenbombs
  escape fluteactive heldcrystals heldgreen heldpendants
  heartquarters
  triforce goalpieces
  knownboss0 knownboss1 knownboss2 knownboss3 knownboss4 knownboss5
  knownboss6 knownboss7 knownboss8 knownboss9
  bottlecontents1 bottlecontents2 bottlecontents3 bottlecontents4
  bombcapacity arrowcapacity
`
  .trim()
  .split(/\s+/);

/** The sizes of the tables of the links made before they carried sizes. */
const LEGACY_SIZES = [217, 98];

/**
 * Every key a timeline can hold, in a fixed order: what a stamp's key is
 * packed as. Found by asking the validation which candidates it knows, so
 * the table cannot drift from what an import accepts. Derived from the
 * item and location tables a link was made against, so an older link's keys
 * are the ones it was written with.
 */
const timelineKeys = (
  items: readonly string[],
  locations: readonly string[],
): readonly string[] => [
  ...items
    .flatMap((id) => [
      `item:${id}`,
      ...Array.from(
        { length: itemsMax[id] ?? 0 },
        (_, level) => `item:${id}:${level + 1}`,
      ),
    ])
    .filter(isTimelineKey),
  // The map's alone: a Door Randomizer location is no timeline find
  ...locations.filter((id) => MAP_LOCATIONS.has(id)).map((id) => `check:${id}`),
];

/** The timeline keys of this version. */
export const TIMELINE_KEYS = timelineKeys(SHARE_ITEMS, LOCATIONS);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The item values, in the order of the item table: a flag is 0 or 1, a
 * counter its signed value. A save missing an item, or holding one this
 * version does not track, is not packed (it stays as it is).
 */
const itemsField = (ids: readonly string[]): FieldCodec => ({
  pack: (value) => {
    if (!isRecord(value)) return null;
    if (Object.keys(value).length !== ids.length) return null;
    const out = new ByteWriter();
    for (const id of ids) {
      const held = value[id];
      if (typeof freshItems[id] === "boolean") {
        if (typeof held !== "boolean") return null;
        out.uint(held ? 1 : 0);
      } else {
        if (!isSigned(held)) return null;
        out.int(held);
      }
    }
    return out.done();
  },
  unpack: (bytes) => {
    const read = new ByteReader(bytes);
    const items: Record<string, number | boolean> = {};
    for (const id of ids) {
      if (typeof freshItems[id] === "boolean") {
        const flag = read.uint();
        if (flag !== 0 && flag !== 1) return undefined;
        items[id] = flag === 1;
      } else {
        const count = read.int();
        if (count === null) return undefined;
        items[id] = count;
      }
    }
    return read.done ? items : undefined;
  },
});

/** A stamp whose instants a varint holds. */
const isPackable = (stamp: unknown): stamp is Stamp =>
  isRecord(stamp) &&
  isCount(stamp.at) &&
  (stamp.ms === null || isCount(stamp.ms));

/** The Rice parameters tried for the times between finds. */
const RICE_PARAMETERS = Array.from({ length: 41 }, (_, k) => k);

/** The bits `gaps` take as Rice codes of parameter `k`. */
const riceCost = (gaps: readonly number[], k: number): number =>
  gaps.reduce((sum, gap) => sum + Math.floor(gap / 2 ** k) + 1 + k, 0);

/**
 * How each find's timer reading stands to the clock: `null` before the timer
 * started, else the drift (the instant less the reading). A timer running
 * straight keeps its drift, and only a pause or a stop changes it, so a run
 * of finds is one state, written once.
 */
type Reading = number | null;

/** The bits one key takes: enough for an index in the table. */
const keyBitsOf = (keys: readonly string[]): number =>
  Math.max(1, Math.ceil(Math.log2(keys.length)));

/**
 * The timeline as link 2 wrote it, read: links of this layout recorded by
 * v2.58.0's writer (`share/fixtures/links-alttpr-v2.json`) hold this reader
 * to them. The finds in the order they came, in three parts. Varints: how
 * many finds, the first one's instant, the Rice parameter of the gaps, then
 * the readings as runs of finds that share one, each its length, then 0 for
 * no reading or 1 and its drift whole. Then bits, no padding between them:
 * each find's key (an index in the key table), then the time since the find
 * before as a Rice code. The tracker writes it for a timeline with no find
 * alone, the one byte both layouts share (`versionFor`), and link 3
 * (`compactField`) for any other.
 * @param keys - The key table the link was made against
 */
const wholeDriftsField = (keys: readonly string[]): FieldCodec => {
  const keyBits = keyBitsOf(keys);
  return {
    pack: (value) =>
      isRecord(value) && Object.keys(value).length === 0
        ? Uint8Array.of(0)
        : null,
    unpack: (bytes) => {
      const read = new ByteReader(bytes);
      const length = read.uint();
      if (length === null || length > keys.length) return undefined;
      if (length === 0) return read.done ? {} : undefined;
      const first = read.uint();
      const k = read.uint();
      const runCount = read.uint();
      if (first === null || k === null || runCount === null) return undefined;
      if (first > MAX_FIELD_NUMBER || k > 40 || runCount > length)
        return undefined;

      const readings: Reading[] = [];
      for (let i = 0; i < runCount; i++) {
        const run = read.uint();
        const timed = read.uint();
        const reading =
          timed === 1 ? read.int() : timed === 0 ? null : undefined;
        if (run === null || run < 1 || reading === undefined) return undefined;
        if (readings.length + run > length) return undefined;
        if (reading !== null && Math.abs(reading) > MAX_FIELD_NUMBER)
          return undefined;
        for (let at = 0; at < run; at++) readings.push(reading);
      }
      if (readings.length !== length) return undefined;

      const bits = new BitReader(read.rest());
      const found: string[] = [];
      for (let i = 0; i < length; i++) {
        const slot = bits.bits(keyBits);
        const key = slot === null ? undefined : keys[slot];
        if (key === undefined || found.includes(key)) return undefined;
        found.push(key);
      }
      const timeline: Record<string, Stamp> = {};
      let at = first;
      for (const [i, key] of found.entries()) {
        if (i > 0) {
          const gap = bits.rice(k, MAX_FIELD_NUMBER);
          if (gap === null) return undefined;
          at += gap;
          if (at > MAX_FIELD_NUMBER) return undefined;
        }
        const reading = readings[i];
        const ms = reading === null ? null : at - reading;
        if (ms !== null && (ms < 0 || ms > MAX_FIELD_NUMBER)) return undefined;
        timeline[key] = { at, ms };
      }
      return bits.padded ? timeline : undefined;
    },
  };
};

/** The layout version whose timeline is written in bits throughout (link 3). */
const COMPACT = 3;

/** The Rice parameter of `values` that costs the fewest bits. */
const bestRice = (values: readonly number[]): number =>
  RICE_PARAMETERS.reduce((best, now) =>
    riceCost(values, now) < riceCost(values, best) ? now : best,
  );

/**
 * The timeline as link 3 writes it. Link 2 (`wholeDriftsField`) wrote each run
 * of finds sharing a reading as varints, its drift whole: an epoch-sized
 * number, six bytes. A timer on the game's clock is set anew at every pause,
 * so its runs are short, and a run of about 250 finds passed 2000
 * characters. Here the finds are in the same order, but every part is bits
 * after five varints: how many finds, the first one's instant, the gaps'
 * Rice parameter and whether they mark a shared instant (`k * 2 + 1` if
 * they do), the runs' and the drifts' changes' Rice parameters. Then:
 * - each find's key, an index in the key table;
 * - each find's time since the one before, as a Rice code; or, when they
 *   mark a shared instant (autotracking lays a check and the item it gave
 *   in one, about three finds in ten), `0` for one, else `1` and the gap
 *   less one: whichever the writer found shorter;
 * - the runs of finds sharing a reading, until every find has one: the run's
 *   length less one as a Rice code, then `0` for no reading (the timer not
 *   started), or `1` and the change from the last drift written (the first
 *   instant before any), zigzagged, as a Rice code: a few seconds of pause,
 *   about fifteen bits.
 * Two runs side by side never share a reading: a writer would have made them
 * one, so such a field is refused, as one with a key twice.
 * @param keys - The key table the link was made against
 */
const compactField = (keys: readonly string[]): FieldCodec => {
  const index = new Map(keys.map((key, at) => [key, at]));
  const keyBits = keyBitsOf(keys);
  /** The most a drift's change is: two drifts of a field's magnitude, zigzagged. */
  const maxChange = MAX_FIELD_NUMBER * 4;
  return {
    pack: (value) => {
      if (!isRecord(value)) return null;
      const finds: { key: number; stamp: Stamp }[] = [];
      for (const [key, stamp] of Object.entries(value)) {
        const at = index.get(key);
        if (at === undefined || !isPackable(stamp)) return null;
        finds.push({ key: at, stamp });
      }
      finds.sort((a, b) => a.stamp.at - b.stamp.at || a.key - b.key);
      const out = new ByteWriter();
      out.uint(finds.length);
      if (finds.length === 0) return out.done();
      const first = finds[0].stamp.at;

      const gaps = finds
        .slice(1)
        .map(({ stamp }, i) => stamp.at - finds[i].stamp.at);
      const moved = gaps.filter((gap) => gap > 0).map((gap) => gap - 1);
      const kGap = bestRice(gaps);
      const kMoved = bestRice(moved);
      const shared =
        gaps.length + riceCost(moved, kMoved) < riceCost(gaps, kGap);

      const runs: { length: number; reading: Reading }[] = [];
      for (const { stamp } of finds) {
        const reading = stamp.ms === null ? null : stamp.at - stamp.ms;
        const last = runs.at(-1);
        if (last !== undefined && last.reading === reading) last.length++;
        else runs.push({ length: 1, reading });
      }
      const changes: number[] = [];
      let drift = first;
      for (const { reading } of runs) {
        if (reading === null) continue;
        changes.push(zigzag(reading - drift));
        drift = reading;
      }
      const kRun = bestRice(runs.map(({ length }) => length - 1));
      const kChange = bestRice(changes);

      for (const head of [
        first,
        shared ? kMoved * 2 + 1 : kGap * 2,
        kRun,
        kChange,
      ]) {
        out.uint(head);
      }
      const bits = new BitWriter();
      for (const { key } of finds) bits.bits(key, keyBits);
      for (const gap of gaps) {
        if (!shared) bits.rice(gap, kGap);
        else if (gap === 0) bits.bits(0, 1);
        else {
          bits.bits(1, 1);
          bits.rice(gap - 1, kMoved);
        }
      }
      let change = 0;
      for (const { length, reading } of runs) {
        bits.rice(length - 1, kRun);
        bits.bits(reading === null ? 0 : 1, 1);
        if (reading !== null) bits.rice(changes[change++], kChange);
      }
      return Uint8Array.from([...out.done(), ...bits.done()]);
    },
    unpack: (bytes) => {
      const read = new ByteReader(bytes);
      const length = read.uint();
      if (length === null || length > keys.length) return undefined;
      if (length === 0) return read.done ? {} : undefined;
      const first = read.uint();
      const gapHead = read.uint();
      const kRun = read.uint();
      const kChange = read.uint();
      if (
        first === null ||
        gapHead === null ||
        kRun === null ||
        kChange === null
      ) {
        return undefined;
      }
      const kGap = Math.floor(gapHead / 2);
      const shared = gapHead % 2 === 1;
      if (first > MAX_FIELD_NUMBER || kGap > 40 || kRun > 40 || kChange > 40)
        return undefined;

      const bits = new BitReader(read.rest());
      const found: string[] = [];
      for (let i = 0; i < length; i++) {
        const slot = bits.bits(keyBits);
        const key = slot === null ? undefined : keys[slot];
        if (key === undefined || found.includes(key)) return undefined;
        found.push(key);
      }
      const instants = [first];
      for (let i = 1; i < length; i++) {
        let gap: number | null = 0;
        if (!shared) gap = bits.rice(kGap, MAX_FIELD_NUMBER);
        else {
          const moved = bits.bits(1);
          if (moved === null) return undefined;
          if (moved === 1) {
            const less = bits.rice(kGap, MAX_FIELD_NUMBER);
            gap = less === null ? null : less + 1;
          }
        }
        if (gap === null) return undefined;
        const at = instants[i - 1] + gap;
        if (at > MAX_FIELD_NUMBER) return undefined;
        instants.push(at);
      }

      const timeline: Record<string, Stamp> = {};
      let done = 0;
      let drift = first;
      let before: Reading | undefined;
      while (done < length) {
        const less = bits.rice(kRun, length - 1 - done);
        const timed = bits.bits(1);
        if (less === null || timed === null) return undefined;
        let reading: Reading = null;
        if (timed === 1) {
          const written = bits.rice(kChange, maxChange);
          if (written === null) return undefined;
          reading = drift + unzigzag(written);
          if (Math.abs(reading) > MAX_FIELD_NUMBER) return undefined;
          drift = reading;
        }
        if (reading === before) return undefined;
        before = reading;
        for (const at of instants.slice(done, done + less + 1)) {
          const ms = reading === null ? null : at - reading;
          if (ms !== null && (ms < 0 || ms > MAX_FIELD_NUMBER)) {
            return undefined;
          }
          timeline[found[done++]] = { at, ms };
        }
      }
      return bits.padded ? timeline : undefined;
    },
  };
};

/**
 * Every value a run's settings can hold, as `key:value`, in the order links
 * index them: each setting's options, the crystal counts, the glitched
 * logics a seed may name, then a Mystery run's hidden settings, `hidden:`
 * standing for the list itself. A new value goes at the end, never in the
 * middle (a spec holds this list to the tracker's options), so a link made
 * before it still reads. A value written out, not derived from the labels:
 * their order is the dialog's, which may change.
 */
export const SHARE_SETTINGS: readonly string[] = `
  mode:open mode:standard mode:inverted mode:retro
  goal:ganon goal:fast-ganon goal:all-dungeons goal:pedestal goal:triforce-hunt
  dungeonItems:standard dungeonItems:mc dungeonItems:mcs dungeonItems:full
  entranceShuffle:none entranceShuffle:simple entranceShuffle:restricted
  entranceShuffle:full entranceShuffle:crossed entranceShuffle:insanity
  swordless:false swordless:true
  crystalsTower:0 crystalsTower:1 crystalsTower:2 crystalsTower:3
  crystalsTower:4 crystalsTower:5 crystalsTower:6 crystalsTower:7
  crystalsGanon:0 crystalsGanon:1 crystalsGanon:2 crystalsGanon:3
  crystalsGanon:4 crystalsGanon:5 crystalsGanon:6 crystalsGanon:7
  itemPlacement:advanced itemPlacement:basic
  accessibility:items accessibility:locations accessibility:none
  itemPool:normal itemPool:hard itemPool:expert itemPool:superexpert
  itemPool:crowd_control
  itemFunctionality:normal itemFunctionality:hard itemFunctionality:expert
  itemFunctionality:superexpert
  glitches:overworld_glitches glitches:major_glitches
  glitches:hybrid_major_glitches glitches:no_logic
  hidden: hidden:goal hidden:swordless hidden:crystalsTower
  hidden:crystalsGanon hidden:itemPlacement hidden:itemPool
  hidden:itemFunctionality hidden:accessibility
  bossShuffle:none bossShuffle:simple bossShuffle:full bossShuffle:random
  hidden:bossShuffle
  playGlitches:overworld_glitches playGlitches:hybrid_major_glitches
  playGlitches:major_glitches
  hidden:glitches hidden:entranceShuffle
  goal:ganonhunt goal:completionist swords:assured swords:vanilla
  enemyHealth:easy enemyHealth:hard enemyHealth:expert
  randomizer:dr randomizer:owr
  doorShuffle:vanilla doorShuffle:basic doorShuffle:partitioned
  doorShuffle:crossed
  dropShuffle:none dropShuffle:keys dropShuffle:underworld
  pottery:none pottery:keys pottery:cave pottery:cavekeys pottery:dungeon
  pottery:reduced pottery:clustered pottery:nonempty pottery:lottery
  shopsanity:false shopsanity:true
  takeAny:none takeAny:random takeAny:fixed
  enemyShuffle:none enemyShuffle:shuffled
  doorEntrances:lite doorEntrances:lean doorEntrances:swapped
  doorEntrances:district doorEntrances:dungeonssimple doorEntrances:dungeonsfull
  owLayout:vanilla owLayout:grid owLayout:wild
  owCrossed:none owCrossed:grouped owCrossed:polar owCrossed:unrestricted
  owMixed:false owMixed:true
  owWhirlpool:false owWhirlpool:true
  owFluteShuffle:vanilla owFluteShuffle:balanced owFluteShuffle:random
  bonkDrops:false bonkDrops:true
  keyLogic:partial keyLogic:strict keyLogic:dangerous keyLogic:static
  bombBag:false bombBag:true potShuffle:false potShuffle:true
  restrictBossItems:none restrictBossItems:mapcompass restrictBossItems:dungeon
  openPyramid:auto openPyramid:yes openPyramid:no
  doorVersion:1.5.6 doorVersion:1.5.7 doorVersion:1.5.8
  shuffleLinks:false shuffleLinks:true shuffleTavern:false shuffleTavern:true
  doorIntensity:1 doorIntensity:2 doorIntensity:3
  decoupledDoors:false decoupledDoors:true
  prizeShuffle:none prizeShuffle:dungeon prizeShuffle:nearby prizeShuffle:wild
  shuffleFollowers:false shuffleFollowers:true
  customGoals:false customGoals:true
`
  .trim()
  .split(/\s+/);

/** The layout version whose settings are packed too (link 4). */
const SETTINGS_PACKED = 4;

/** The settings whose values are true or false. */
const BOOLEAN_SETTINGS: ReadonlySet<string> = new Set([
  "bombBag",
  "bonkDrops",
  "customGoals",
  "decoupledDoors",
  "owMixed",
  "owWhirlpool",
  "potShuffle",
  "shopsanity",
  "shuffleFollowers",
  "shuffleLinks",
  "shuffleTavern",
  "swordless",
]);

/** An entry of `SHARE_SETTINGS` as its key and the value it stands for. */
const entryOf = (entry: string): [string, string | number | boolean] => {
  const at = entry.indexOf(":");
  const key = entry.slice(0, at);
  const text = entry.slice(at + 1);
  if (BOOLEAN_SETTINGS.has(key)) return [key, text === "true"];
  return [key, key.startsWith("crystals") ? Number(text) : text];
};

/**
 * The run's settings (link 4): one varint a setting, its entry in the
 * settings table, in the settings' own order; for `hidden`, the `hidden:`
 * entry, then each hidden setting's, in the list's order. JSON spelled them
 * out, about 160 characters of every link; this is about thirteen bytes.
 * Settings with a key or a value the table does not have (another type
 * included: `"7"` for 7) are not packed, and the save stays plain. A reader
 * refuses what a writer never writes: a key twice, a hidden setting twice or
 * away from its list.
 * @param entries - The settings table the link was made against
 */
const settingsField = (entries: readonly string[]): FieldCodec => {
  const index = new Map(entries.map((entry, at) => [entry, at]));
  return {
    pack: (value) => {
      if (!isRecord(value) || Object.keys(value).length === 0) return null;
      const written: (number | undefined)[] = [];
      for (const [key, held] of Object.entries(value)) {
        if (key !== "hidden") {
          const at = index.get(`${key}:${String(held)}`);
          if (at === undefined || entryOf(entries[at])[1] !== held) return null;
          written.push(at);
          continue;
        }
        if (!Array.isArray(held) || new Set(held).size !== held.length) {
          return null;
        }
        written.push(index.get("hidden:"));
        for (const setting of held) {
          written.push(
            typeof setting === "string" && setting !== ""
              ? index.get(`hidden:${setting}`)
              : undefined,
          );
        }
      }
      const out = new ByteWriter();
      for (const at of written) {
        if (at === undefined) return null;
        out.uint(at);
      }
      return out.done();
    },
    unpack: (bytes) => {
      const read = new ByteReader(bytes);
      const settings: Record<string, unknown> = {};
      let hidden: unknown[] | null = null;
      while (!read.done) {
        const at = read.uint();
        const entry = at === null ? undefined : entries[at];
        if (entry === undefined) return undefined;
        const [key, value] = entryOf(entry);
        if (key === "hidden" && value !== "") {
          if (hidden === null || hidden.includes(value)) return undefined;
          hidden.push(value);
          continue;
        }
        if (Object.hasOwn(settings, key)) return undefined;
        hidden = key === "hidden" ? [] : null;
        settings[key] = hidden ?? value;
      }
      return settings;
    },
  };
};

/**
 * The fields over the tables a link was made against: the whole of today's,
 * or a prefix of each. The timeline's key table follows from the location
 * and item tables, and the digest covers it too. The fields follow the
 * link's layout version: the timeline's whole drifts in runs (link 2), or
 * bits throughout (link 3 on), and the settings as JSON, or packed over the
 * settings table (link 4 on).
 */
const layoutAt = (
  [locations, items, settings]: Tables,
  version: number,
): Layout => {
  const keys = timelineKeys(items, locations);
  const fields: Record<string, FieldCodec> = {
    checked: bitsetField(locations, "record"),
    items: itemsField(items),
    timeline: version >= COMPACT ? compactField(keys) : wholeDriftsField(keys),
  };
  if (settings === undefined)
    return { digested: [locations, items, keys], fields };
  return {
    digested: [locations, items, keys, settings],
    fields: { ...fields, settings: settingsField(settings) },
  };
};

const CODEC: PackCodec = {
  at: layoutAt,
  game: "alttpr",
  legacySizes: LEGACY_SIZES,
  tables: [LOCATIONS, SHARE_ITEMS, SHARE_SETTINGS],
  // The settings table is link 4's
  tablesIn: (version) => (version >= SETTINGS_PACKED ? 3 : 2),
  version: SETTINGS_PACKED,
  // A save without a find is written as link 2, which every tracker since
  // the packed form opens: its timeline is the one byte all layouts share,
  // and its settings as JSON cost it nothing that matters, the short link
  // Share falls back to among such saves being far under a chat's limit.
  // Any other is link 4, which the settings packed keep short
  versionFor: ({ timeline }) =>
    isRecord(timeline) && Object.keys(timeline).length > 0
      ? SETTINGS_PACKED
      : LINK_VERSION,
};

/** An export as a packed link's text, for the Share action. */
export const packLink = (save: string): string => packRun(save, CODEC);

/** What an import is given: a packed link's save, or the text as it is. */
export const unpackLink = (text: string) => unpackRun(text, CODEC);
