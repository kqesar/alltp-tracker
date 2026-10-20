// What search engines and link previews are told about each game. The
// tracker's own names live in src/games/registry.ts (GAMES): the page title is
// built the same way there (`pageTitle`), and an e2e test holds the two
// together. This file stays free of imports: the Vite config loads it with
// Node's type stripping.

/** Where the site is served: the origin and the base path of GitHub Pages. */
export const SITE = "https://kqesar.github.io/alltp-tracker/";

/** The product's display name (`PRODUCT_NAME` in src/games/registry.ts). */
export const PRODUCT = "Rando Atlas";

export type SeoGame = {
  /** The game's id (`GameId`): its page lives at `<site>/<id>/`. */
  id: string;
  /** The game's name, as `GAMES[id].name` has it. */
  name: string;
  /** The meta description: one sentence, under 160 characters. */
  description: string;
  /** What the tracker does for this game, as a short list. */
  features: string[];
  /** The randomizer the tracker follows for it. */
  randomizer: { href: string; name: string };
};

export const SEO_GAMES: readonly SeoGame[] = [
  {
    description:
      "Free item and map tracker for A Link to the Past randomizer runs: what you can reach, live, with autotracking. Works offline.",
    features: [
      "Works out in real time which chests you can reach and which dungeons you can clear, with the randomizer's own logic.",
      "Open, Inverted and Crosskeys runs, with an assistant for shuffled entrances.",
      "Autotracking through SNI or QUsb2Snes, and RetroArch in the desktop app.",
      "Run timer, splits and timeline, and an OBS stream view.",
    ],
    id: "alttpr",
    name: "A Link to the Past",
    randomizer: { href: "https://alttpr.com/", name: "alttpr.com" },
  },
  {
    description:
      "Free item tracker for Super Metroid as Map Rando plays it: items, seed objectives and autotracking from your emulator. Works offline.",
    features: [
      "Every beam, suit, movement item, pack and tank of a Map Rando seed.",
      "The seed's objectives, from its preset or ticked as its pause screen lists them.",
      "Autotracking through SNI or QUsb2Snes, and RetroArch in the desktop app.",
      "An OBS stream view.",
    ],
    id: "sm",
    name: "Super Metroid",
    randomizer: { href: "https://maprando.com/", name: "Map Rando" },
  },
  {
    description:
      "Free item and map tracker for SMZ3, Super Metroid and A Link to the Past in one seed, as samus.link generates it. Logic and autotracking. Works offline.",
    features: [
      "Both games' items, and a map of Hyrule and a map of Zebes under one logic.",
      "The randomizer's own logic, ported from its source and held to its official tests.",
      "Keysanity, the weeklies' presets and each setting of the run type.",
      "Autotracking through SNI or QUsb2Snes, and RetroArch in the desktop app.",
    ],
    id: "smz3",
    name: "SMZ3",
    randomizer: { href: "https://samus.link/", name: "samus.link" },
  },
];
