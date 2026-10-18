// The entrance assistant's model: what the pack's entrance randomizer tables
// (packs/alttpr/src/entrances.ts) mean for a run with shuffled entrances.
// Only the assistant's own components import it, each loaded on demand: a
// run without shuffled entrances never downloads the tables.

import {
  type CrossedPool,
  crossedPool,
  type EntranceTarget,
  type OverworldEntrance,
  TARGETS,
} from "@alltp/pack-alttpr";
import type { RunSettings } from "@/data/presets";

const pools = {
  open: crossedPool("open"),
  standard: crossedPool("standard"),
} as const;

/**
 * The entrances a run shuffles, or null when the assistant has none for its
 * world: Inverted's crossed shuffle runs tables of its own, not ported yet.
 */
export const poolOf = (settings: RunSettings): CrossedPool | null =>
  settings.entranceShuffle === "none"
    ? null
    : settings.mode === "standard"
      ? pools.standard
      : settings.mode === "inverted"
        ? null
        : pools.open;

const ENTRANCE_BY_ID = new Map(
  [...pools.open.entrances, ...pools.standard.entrances].map((e) => [e.id, e]),
);
const TARGET_BY_ID = new Map(TARGETS.map((t) => [t.id, t]));

/** An entrance of the shuffle by id, or undefined. */
export const entranceById = (id: string): OverworldEntrance | undefined =>
  ENTRANCE_BY_ID.get(id);

/** A target by id, or undefined for one this version does not know. */
export const targetById = (id: string): EntranceTarget | undefined =>
  TARGET_BY_ID.get(id);

/** What an entrance may lead to: a hole drops, a door opens on the rest. */
export const targetsFor = (
  entrance: OverworldEntrance,
): readonly EntranceTarget[] =>
  TARGETS.filter((t) => (t.kind === "drop") === (entrance.kind === "hole"));

/** A target in words: "Elder House (East)", "Blind's Hideout". */
export const targetText = (target: EntranceTarget): string =>
  target.side === undefined ? target.place : `${target.place} (${target.side})`;

/** The headings a picker groups targets under, by kind. */
export const KIND_HEADINGS: Readonly<Record<EntranceTarget["kind"], string>> = {
  connector: "Caves with several doors",
  drop: "Where it drops",
  dungeon: "Dungeons",
  single: "Shops, houses and other places",
};

/**
 * An entrance's marker in words, for its accessible name and its tooltip:
 * "Kakariko Shop: leads to Elder House (East)", "…: not known yet".
 */
export const entranceText = (
  entrance: OverworldEntrance,
  target: EntranceTarget | undefined,
): string =>
  `${entrance.label}${entrance.kind === "hole" ? " (hole)" : ""}: ${
    target === undefined ? "not known yet" : `leads to ${targetText(target)}`
  }`;
