// How an ALttPR run is packed into a shared link (share/packed.ts): its
// checked locations as a bitset over the pack's ordered locations, its item
// values and its timeline as varints over ordered tables. The tables are
// the pack's and this version's: the link carries their digest.

import { MAP_LOCATIONS } from "@alltp/pack-alttpr";
import { items as freshItems, itemsMax } from "@/games/alttpr/data/items";
import { isTimelineKey, type Stamp } from "@/games/alttpr/logic/timeline";
import {
  BitReader,
  BitWriter,
  ByteReader,
  ByteWriter,
  isCount,
  isSigned,
  MAX_FIELD_NUMBER,
} from "@/share/bytes";
import {
  bitsetField,
  type FieldCodec,
  type PackCodec,
  packRun,
  unpackRun,
} from "@/share/packed";

const LOCATIONS: readonly string[] = [...MAP_LOCATIONS];
const ITEM_IDS = Object.keys(freshItems);

/**
 * Every key a timeline can hold, in a fixed order: what a stamp's key is
 * packed as. Found by asking the validation which candidates it knows, so
 * the table cannot drift from what an import accepts.
 */
export const TIMELINE_KEYS: readonly string[] = [
  ...ITEM_IDS.flatMap((id) => [
    `item:${id}`,
    ...Array.from(
      { length: itemsMax[id] ?? 0 },
      (_, level) => `item:${id}:${level + 1}`,
    ),
  ]).filter(isTimelineKey),
  ...LOCATIONS.map((id) => `check:${id}`),
];
const TIMELINE_INDEX = new Map(TIMELINE_KEYS.map((key, at) => [key, at]));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The item values, in the order of the item table: a flag is 0 or 1, a
 * counter its signed value. A save missing an item, or holding one this
 * version does not track, is not packed (it stays as it is).
 */
const itemsField: FieldCodec = {
  pack: (value) => {
    if (!isRecord(value)) return null;
    if (Object.keys(value).length !== ITEM_IDS.length) return null;
    const out = new ByteWriter();
    for (const id of ITEM_IDS) {
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
    for (const id of ITEM_IDS) {
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
};

/** A stamp whose instants a varint holds. */
const isPackable = (stamp: unknown): stamp is Stamp =>
  isRecord(stamp) &&
  isCount(stamp.at) &&
  (stamp.ms === null || isCount(stamp.ms));

/** The bits one key takes: enough for an index in the table. */
const KEY_BITS = Math.max(1, Math.ceil(Math.log2(TIMELINE_KEYS.length)));

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

/**
 * The timeline, finds in the order they came, in three parts. Varints: how
 * many finds, the first one's instant, the Rice parameter of the gaps, then
 * the readings as runs of finds that share one. Then bits, no padding between
 * them: each find's key (an index in the key table), then the time since the
 * find before as a Rice code, which costs a bit or two over what a gap's
 * magnitude says and so takes a long wait without making every gap pay.
 * Bits, not bytes: the finds' keys and times are close to noise, and a
 * varint's continuation bits only make deflate's job harder.
 */
const timelineField: FieldCodec = {
  pack: (value) => {
    if (!isRecord(value)) return null;
    const finds: { key: number; stamp: Stamp }[] = [];
    for (const [key, stamp] of Object.entries(value)) {
      const at = TIMELINE_INDEX.get(key);
      if (at === undefined || !isPackable(stamp)) return null;
      finds.push({ key: at, stamp });
    }
    finds.sort((a, b) => a.stamp.at - b.stamp.at || a.key - b.key);
    const out = new ByteWriter();
    out.uint(finds.length);
    if (finds.length === 0) return out.done();
    out.uint(finds[0].stamp.at);
    const gaps = finds
      .slice(1)
      .map(({ stamp }, i) => stamp.at - finds[i].stamp.at);
    const k = RICE_PARAMETERS.reduce((best, now) =>
      riceCost(gaps, now) < riceCost(gaps, best) ? now : best,
    );
    out.uint(k);

    const runs: { length: number; reading: Reading }[] = [];
    for (const { stamp } of finds) {
      const reading = stamp.ms === null ? null : stamp.at - stamp.ms;
      const last = runs.at(-1);
      if (last?.reading === reading) last.length++;
      else runs.push({ length: 1, reading });
    }
    out.uint(runs.length);
    for (const { length, reading } of runs) {
      out.uint(length);
      if (reading === null) out.uint(0);
      else {
        out.uint(1);
        out.int(reading);
      }
    }

    const bits = new BitWriter();
    for (const { key } of finds) bits.bits(key, KEY_BITS);
    for (const gap of gaps) bits.rice(gap, k);
    const head = out.done();
    const tail = bits.done();
    return Uint8Array.from([...head, ...tail]);
  },
  unpack: (bytes) => {
    const read = new ByteReader(bytes);
    const length = read.uint();
    if (length === null || length > TIMELINE_KEYS.length) return undefined;
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
      const reading = timed === 1 ? read.int() : timed === 0 ? null : undefined;
      if (run === null || run < 1 || reading === undefined) return undefined;
      if (readings.length + run > length) return undefined;
      if (reading !== null && Math.abs(reading) > MAX_FIELD_NUMBER)
        return undefined;
      for (let at = 0; at < run; at++) readings.push(reading);
    }
    if (readings.length !== length) return undefined;

    const bits = new BitReader(read.rest());
    const keys: string[] = [];
    for (let i = 0; i < length; i++) {
      const index = bits.bits(KEY_BITS);
      const key = index === null ? undefined : TIMELINE_KEYS[index];
      if (key === undefined || keys.includes(key)) return undefined;
      keys.push(key);
    }
    const timeline: Record<string, Stamp> = {};
    let at = first;
    for (const [i, key] of keys.entries()) {
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

const CODEC: PackCodec = {
  fields: {
    checked: bitsetField(LOCATIONS, "record"),
    items: itemsField,
    timeline: timelineField,
  },
  game: "alttpr",
  tables: [LOCATIONS, ITEM_IDS, TIMELINE_KEYS],
};

/** An export as a packed link's text, for the Share action. */
export const packLink = (save: string): string => packRun(save, CODEC);

/** What an import is given: a packed link's save, or the text as it is. */
export const unpackLink = (text: string) => unpackRun(text, CODEC);
