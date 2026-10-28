// Voice commands: what the player may say, as the recognizer's grammar, and
// what each phrase does to the run. Pure: the voice engine (apps/web/src/
// voice/) hears a phrase and asks `commandsOf` what it means.
//
// Every command starts with the wake word, so that talking about the
// hookshot does not mark it. A phrase says what was found, not a click:
// "hook shot" holds the hookshot (saying it again keeps it), "sword" is one
// level more, never back to none. The words are those of the speech model's
// dictionary (vosk-model-small-en-us-0.15): a name it lacks is spoken as the
// words it has that sound like it ("samaria" for Somaria), as checked against
// synthesized speech of the real names in three voices.
import { MEDALLION_VALUES } from "@/games/alttpr/constants";
import { CONTROLS, type ControlId } from "@/games/alttpr/data/keymap";

/** The word every command starts with. */
export const WAKE_WORD = "tracker";

/** How a command changes a control's value. */
export type Change =
  /** Held, or beaten: a toggle on, anything else at its top */
  | { readonly to: "on" }
  /** One level, or one small key, more: never past the top */
  | { readonly to: "next" }
  /** One item fewer left in a dungeon: never below none */
  | { readonly to: "less" }
  /** The bow's and the boomerangs' bits: one more item among them */
  | { readonly bit: number }
  /** A named level, never lower than the one held: "master sword" */
  | { readonly atLeast: number }
  /** A value picked: a dungeon's medallion or prize */
  | { readonly exactly: number };

/** What a command does. */
export type VoiceAction =
  | {
      readonly kind: "set";
      readonly control: ControlId;
      readonly change: Change;
    }
  | { readonly kind: "pauseTimer" | "redo" | "startTimer" | "undo" };

const ON: Change = { to: "on" };
const NEXT: Change = { to: "next" };
const LESS: Change = { to: "less" };

/** The grid's items, by the words that say them, and what they find. */
const ITEMS: readonly (readonly [
  phrases: readonly string[],
  control: ControlId,
  change: Change,
])[] = [
  [["flute", "ocarina"], "flute", ON],
  [["hook shot"], "hookshot", ON],
  [["hammer"], "hammer", ON],
  [["fire rod"], "firerod", ON],
  [["ice rod"], "icerod", ON],
  [["boomerang", "blue boomerang"], "boomerang", { bit: 1 }],
  [["red boomerang"], "boomerang", { bit: 2 }],
  [["net", "bug net"], "net", ON],
  [["bow"], "bow", { bit: 2 }],
  [["silver arrows", "silvers"], "bow", { bit: 1 }],
  [["lantern", "lamp"], "lantern", ON],
  [["shield"], "shield", NEXT],
  [["fighter shield"], "shield", { atLeast: 1 }],
  [["fire shield"], "shield", { atLeast: 2 }],
  [["mirror shield"], "shield", { atLeast: 3 }],
  [["sword"], "sword", NEXT],
  [["fighter sword"], "sword", { atLeast: 1 }],
  [["master sword"], "sword", { atLeast: 2 }],
  [["tempered sword"], "sword", { atLeast: 3 }],
  [["golden sword", "gold sword"], "sword", { atLeast: 4 }],
  [["armor", "mail"], "tunic", NEXT],
  [["blue mail"], "tunic", { atLeast: 2 }],
  [["red mail"], "tunic", { atLeast: 3 }],
  // Agahnim is not in the dictionary: "a gannon" is how it is heard
  [["aga", "agha", "a gannon"], "agahnim", ON],
  [["aga two", "agha two", "a gannon two"], "agahnim2", ON],
  [["boots", "pegasus boots"], "boots", ON],
  [["shovel"], "shovel", ON],
  [["book"], "book", ON],
  [["quake"], "quake", ON],
  // Bombos is not in the dictionary: its two syllables are
  [["bom boss"], "bombos", ON],
  [["ether"], "ether", ON],
  [["powder", "magic powder"], "powder", ON],
  // A quarter magic already held stays: the half is a find, never a step back
  [["half magic"], "magic", { atLeast: 1 }],
  [["glove", "gloves", "power glove"], "glove", NEXT],
  [["mitts", "titan mitt"], "glove", { atLeast: 2 }],
  [["bottle"], "bottle", NEXT],
  [["heart", "heart container"], "hearts", NEXT],
  [["samaria", "red cane"], "somaria", ON],
  // Nor Byrna, which it hears as "mire": these are the words that work
  [["burner", "blue cane"], "byrna", ON],
  [["mushroom"], "mushroom", ON],
  [["cape"], "cape", ON],
  [["mirror"], "mirror", ON],
  [["moon pearl", "pearl"], "moonpearl", ON],
  [["flippers"], "flippers", ON],
  // The retro world's shops, found
  [["arrow shop"], "shoparrow", ON],
  [["key shop"], "shopkey", ON],
];

/**
 * The dungeons by key index (KEY_DUNGEONS), by the words players say them
 * with: their names, short names and abbreviations.
 */
const DUNGEONS: readonly (readonly string[])[] = [
  ["eastern", "eastern palace"],
  ["desert", "desert palace"],
  ["hera", "tower of hera"],
  ["palace of darkness", "dark palace", "pod"],
  ["swamp", "swamp palace"],
  ["skull woods", "skull"],
  ["thieves town", "thieves"],
  ["ice palace", "ice"],
  ["misery mire", "mire"],
  ["turtle rock", "turtle", "t r"],
  // Hyrule is not in the dictionary
  ["high rule castle", "escape", "h c"],
  ["castle tower", "aga tower", "c t"],
  // Nor is Ganon
  ["gannon tower", "g t"],
];

/** The boss each dungeon's "boss" beats: the grid's ten, then the Agahnims. */
const bossOf = (index: number): ControlId | null => {
  if (index < 10) return `boss${index}`;
  if (index === 11) return "agahnim";
  return index === 12 ? "agahnim2" : null;
};

/** A dungeon's parts, by the words that say them, and what they find. */
const PARTS: readonly (readonly [
  phrases: readonly string[],
  control: (index: number) => ControlId | null,
  change: Change,
])[] = [
  [["boss"], bossOf, ON],
  [["chest", "item"], (index) => `chest${index}`, LESS],
  [["big key"], (index) => `bigkey${index}`, ON],
  [["key", "small key"], (index) => `smallkey${index}`, NEXT],
  [["map"], (index) => `map${index}`, ON],
  [["compass"], (index) => `compass${index}`, ON],
  [
    ["bom boss"],
    (index) => `medallion${index}`,
    { exactly: MEDALLION_VALUES.BOMBOS },
  ],
  [
    ["ether"],
    (index) => `medallion${index}`,
    { exactly: MEDALLION_VALUES.ETHER },
  ],
  [
    ["quake"],
    (index) => `medallion${index}`,
    { exactly: MEDALLION_VALUES.QUAKE },
  ],
  // A dungeon's prize: 1 the Pendant of Courage, 2 another pendant, 3 a
  // crystal, 4 crystal 5 or 6 (logic/packItems.ts REWARDS)
  [["green pendant"], (index) => `reward${index}`, { exactly: 1 }],
  [
    ["pendant", "blue pendant", "red pendant"],
    (index) => `reward${index}`,
    { exactly: 2 },
  ],
  [["crystal"], (index) => `reward${index}`, { exactly: 3 }],
  [
    ["red crystal", "crystal five", "crystal six"],
    (index) => `reward${index}`,
    { exactly: 4 },
  ],
];

/** Commands about the run rather than a control. */
const RUN: readonly (readonly [readonly string[], VoiceAction])[] = [
  [["undo"], { kind: "undo" }],
  [["redo"], { kind: "redo" }],
  [["start timer", "start"], { kind: "startTimer" }],
  [["pause timer", "stop timer", "pause"], { kind: "pauseTimer" }],
];

/**
 * What to say, for the player: each item's phrases, the dungeons' names,
 * what may follow a dungeon's name, and the run's commands. The first
 * phrase of each is the one to show first.
 */
export const VOICE_GUIDE = {
  dungeons: DUNGEONS,
  items: ITEMS.map(([phrases, control, change]) => ({
    change,
    control,
    phrases,
  })),
  parts: PARTS.map(([phrases]) => phrases),
  run: RUN.map(([phrases]) => phrases),
} as const;

const KNOWN_CONTROLS = new Set(CONTROLS);

/** Every phrase, without the wake word, and its action. */
const buildCommands = (): ReadonlyMap<string, VoiceAction> => {
  const commands = new Map<string, VoiceAction>();
  const add = (phrase: string, action: VoiceAction) => {
    const known = commands.get(phrase);
    if (known && JSON.stringify(known) !== JSON.stringify(action)) {
      throw new Error(`"${phrase}" says two things`);
    }
    commands.set(phrase, action);
  };
  for (const [phrases, control, change] of ITEMS) {
    for (const phrase of phrases) add(phrase, { change, control, kind: "set" });
  }
  DUNGEONS.forEach((names, index) => {
    for (const [phrases, controlOf, change] of PARTS) {
      const control = controlOf(index);
      // A part the dungeon lacks: Hyrule Castle's boss, Eastern's keys
      if (control === null || !KNOWN_CONTROLS.has(control)) continue;
      for (const name of names) {
        for (const phrase of phrases) {
          add(`${name} ${phrase}`, { change, control, kind: "set" });
        }
      }
    }
  });
  for (const [phrases, action] of RUN) {
    for (const phrase of phrases) add(phrase, action);
  }
  return commands;
};

/** Every command, by its phrase without the wake word. */
export const COMMANDS: ReadonlyMap<string, VoiceAction> = buildCommands();

/**
 * The recognizer's grammar: every command with its wake word, and `[unk]`
 * for anything else, so that it hears nothing but these phrases.
 */
export const GRAMMAR: readonly string[] = [
  ...[...COMMANDS.keys()].map((phrase) => `${WAKE_WORD} ${phrase}`),
  "[unk]",
];

/**
 * The commands in a recognized text, in the order said: each phrase that
 * follows the wake word and means something. A phrase left unfinished, or
 * one never said after the wake word, means nothing.
 * @param text - A final result of the recognizer
 */
export const commandsOf = (text: string): VoiceAction[] =>
  text
    .toLowerCase()
    .replaceAll("[unk]", " ")
    .split(new RegExp(`\\b${WAKE_WORD}\\b`))
    .slice(1)
    .map((said) => COMMANDS.get(said.trim().replace(/\s+/g, " ")))
    .filter((action) => action !== undefined);

/**
 * A control's value once a command has changed it: what was found, kept
 * within the control's range.
 * @param change - What the command says
 * @param value - The control's value now
 * @param min - The lowest it goes
 * @param max - The highest it goes
 */
export const changedValue = (
  change: Change,
  value: boolean | number,
  min: number,
  max: number,
): boolean | number => {
  if (typeof value === "boolean") return true;
  if ("bit" in change) return value | change.bit;
  if ("atLeast" in change) return Math.max(value, change.atLeast);
  if ("exactly" in change) return change.exactly;
  switch (change.to) {
    case "next":
      return Math.min(value + 1, max);
    case "less":
      return Math.max(value - 1, min);
    default:
      // Held or beaten: the top of its range (a boss's 2, a big key's 1)
      return max;
  }
};
