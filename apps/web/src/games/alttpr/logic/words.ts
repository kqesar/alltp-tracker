// How a run words what its map shows. A seed generated for a logic has
// checks in or out of logic; a No Logic seed promises no route, so nothing
// in it is in logic: its map shows what the glitches it is played with
// reach (`playGlitches`), and says so.
import {
  GLITCHES_LABELS,
  noLogicRun,
  type PlayGlitches,
  playGlitchesOf,
  type RunSettings,
} from "@/games/alttpr/data/presets";
import type { MarkerState } from "@/games/alttpr/logic/solution";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** A run's words for a check the map says yes or no to. */
export type LogicWords = {
  /** The seed has No Logic: the map says what is reachable. */
  readonly noLogic: boolean;
  /** A check at yes: "in logic", or "reachable". */
  readonly yes: string;
  /**
   * The same in full: "in logic", or "reachable without glitches",
   * "reachable with Overworld Glitches".
   */
  readonly yesFull: string;
  /** The lead of what brings a check to yes: "In logic with". */
  readonly yesWith: string;
  /**
   * A check at no, in full: "out of logic", or "not reachable without
   * glitches", "not reachable with Overworld Glitches".
   */
  readonly no: string;
  /** The same in a word or two, where room is short: "Out of logic". */
  readonly noShort: string;
  /** What a screen reader hears of each marker state. */
  readonly states: Readonly<Record<MarkerState, string>>;
};

/** The words a screen reader hears for each state, from a run's no. */
const statesOf = (no: string): Readonly<Record<MarkerState, string>> => ({
  available: "available",
  margin: `${no}, doable outside Basic's safety margin`,
  opened: "done",
  possible: "maybe available",
  seen: "visible, not reachable yet",
  trick: `${no}, doable with a trick`,
  unavailable: no,
});

/** A run with a logic: in logic, or out of it. */
const IN_LOGIC: LogicWords = {
  no: "out of logic",
  noLogic: false,
  noShort: "Out of logic",
  states: statesOf("out of logic"),
  yes: "in logic",
  yesFull: "in logic",
  yesWith: "In logic with",
};

/** "without glitches", "with Overworld Glitches". */
export const playedWith = (play: PlayGlitches | "none"): string =>
  play === "none" ? "without glitches" : `with ${GLITCHES_LABELS[play]}`;

/** A No Logic run's words, by the glitches it is played with. */
const NO_LOGIC = Object.fromEntries(
  (
    [
      "none",
      "overworld_glitches",
      "hybrid_major_glitches",
      "major_glitches",
    ] as const
  ).map((play) => {
    const no = `not reachable ${playedWith(play)}`;
    return [
      play,
      {
        no,
        noLogic: true,
        noShort: "Not reachable",
        states: statesOf(no),
        yes: "reachable",
        yesFull: `reachable ${playedWith(play)}`,
        yesWith: "Reachable with",
      },
    ];
  }),
) as Readonly<Record<PlayGlitches | "none", LogicWords>>;

/**
 * A run's words for what its map shows: in or out of logic, or, for a No
 * Logic run, reachable or not with the glitches it is played with. The
 * same object for the same words, so a selector may return it.
 */
export const logicWordsOf = (settings: RunSettings): LogicWords =>
  noLogicRun(settings) ? NO_LOGIC[playGlitchesOf(settings)] : IN_LOGIC;

/** The run's words for what its map shows (`logicWordsOf`). */
export const useLogicWords = (): LogicWords =>
  useGameStore((state) => logicWordsOf(state.settings));

/** A sentence's start: "Out of logic". */
export const capitalized = (words: string): string =>
  words.charAt(0).toUpperCase() + words.slice(1);
