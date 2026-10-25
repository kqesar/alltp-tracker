// The minor tricks the tracker can mark checks with: their names, a line on
// what each does, and where to learn it. Which rules a trick relaxes is the
// pack's (`packs/alttpr/src/tricks.ts`); these are the player's words.
import { TRICK_IDS, type TrickId } from "@alltp/pack-alttpr";

/** A page or video that teaches a trick. */
export interface TrickGuide {
  /** What the link says: the author, the page, the chapter. */
  readonly label: string;
  /** An https address; a video's chapter is its `t=` second. */
  readonly url: string;
}

/** What a trick is called, what it does and where to learn it. */
export interface TrickWords {
  readonly name: string;
  /** One sentence for a player who has not met it. */
  readonly summary: string;
  readonly guides: readonly TrickGuide[];
}

const WATER = "https://www.youtube.com/watch?v=0YzkiaY3eys";
const BUNNY = "https://www.youtube.com/watch?v=7UeNQ1yvukY";

/**
 * The tricks in words. Every guide is an https link (the desktop app opens
 * https only); the videos are Qirn's "Stupid Tech" series, at the chapter
 * that teaches the trick.
 */
export const TRICK_WORDS: Readonly<Record<TrickId, TrickWords>> = {
  bunnyRevive: {
    guides: [
      {
        label: "Qirn, Bunny Glitches: overworld bunny revival",
        url: `${BUNNY}&t=1444s`,
      },
      {
        label: "Qirn, Water Traversal: overworld bunny revival",
        url: `${WATER}&t=4339s`,
      },
    ],
    name: "Bunny revival",
    summary:
      "Die over deep water as a bunny with a fairy in a bottle, and the fairy brings you back as Link without the Moon Pearl. Needs a bottle, the Bug-Catching Net and a fairy to catch.",
  },
  darkRooms: {
    guides: [
      {
        label: "alttpr.com: dark rooms and the Lamp",
        url: "https://alttpr.com/en/resources",
      },
    ],
    name: "Dark rooms without the Lamp",
    summary:
      "Cross a dark room without a light, from memory or with a map. The Fire Rod already lights some rooms in advanced item placement.",
  },
  dungeonRevive: {
    guides: [
      {
        label: "Qirn, Bunny Glitches: dungeon bunny revival",
        url: `${BUNNY}&t=827s`,
      },
    ],
    name: "Dungeon revival",
    summary:
      "Die as a bunny inside a Dark World dungeon, or be carried off by a Wallmaster, and you restart at its entrance as Link, without the Moon Pearl.",
  },
  fakeFlipper: {
    guides: [
      {
        label: "Qirn, Water Traversal: fake flippers",
        url: `${WATER}&t=874s`,
      },
      {
        label: "gamercal, Flipperless Water Traversal",
        url: "https://www.youtube.com/watch?v=enL-sV0DR6k",
      },
      {
        label: "ZeldaSpeedRuns: fake flippers",
        url: "https://www.zeldaspeedruns.com/alttp/misc/fake-flippers",
      },
    ],
    name: "Fake flipper",
    summary:
      "Swim in deep water without the Flippers by timing a screen transition or a fairy revival. A hit while swimming can softlock the game.",
  },
  superBunny: {
    guides: [
      { label: "Qirn, Bunny Glitches: super bunny", url: `${BUNNY}&t=319s` },
    ],
    name: "Super bunny",
    summary:
      "Keep your sword, Pegasus Boots, chests and lifting as a bunny in the Dark World, after picking up an item, falling through a hole or mirroring on a doorway.",
  },
  waterWalk: {
    guides: [
      { label: "Qirn, Water Traversal: water walk", url: `${WATER}&t=2299s` },
    ],
    name: "Water walk",
    summary:
      "Walk on deep water as if it were land, once a hidden pit flag is set (by dashing next to a pit, for one), until you touch land or take damage.",
  },
};

/** A document covering every trick but the dark rooms, linked once. */
export const MINOR_GLITCHES_GUIDE: TrickGuide = {
  label: "Minor Glitches Definitions (Google Doc)",
  url: "https://docs.google.com/document/d/1cio22fU4_cEsMcHN0I1KceUzB5P1aFgB7dOBrZuwRHU",
};

/**
 * Whether checks a trick opens are marked, and which tricks the player has
 * learned. Off by default; ticked once on, all six.
 */
export interface TrickPrefs {
  readonly enabled: boolean;
  /** Known tricks, each once, in the pack's order. */
  readonly techniques: readonly TrickId[];
}

export const DEFAULT_TRICKS: TrickPrefs = {
  enabled: false,
  techniques: TRICK_IDS,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A saved trick preference, read leniently: a switch that is not a boolean
 * keeps `base`'s, and the techniques keep the known ids, each once, in the
 * pack's order.
 * @param saved - What a save holds under `tricks`
 * @param base - The preferences to fall back on
 */
export const restoreTricks = (saved: unknown, base: TrickPrefs): TrickPrefs => {
  if (!isRecord(saved)) return base;
  const enabled =
    typeof saved.enabled === "boolean" ? saved.enabled : base.enabled;
  if (!Array.isArray(saved.techniques)) {
    return { enabled, techniques: base.techniques };
  }
  const known = new Set<unknown>(saved.techniques);
  return {
    enabled,
    techniques: TRICK_IDS.filter((id) => known.has(id)),
  };
};

/**
 * The known tricks with one more or one fewer, in the pack's order; the
 * same list when it stays as it is.
 * @param techniques - The tricks known
 * @param id - The trick to learn or forget
 * @param known - Whether it is known afterwards
 */
export const withTrick = (
  techniques: readonly TrickId[],
  id: TrickId,
  known: boolean,
): readonly TrickId[] =>
  techniques.includes(id) === known
    ? techniques
    : TRICK_IDS.filter((each) =>
        each === id ? known : techniques.includes(each),
      );
