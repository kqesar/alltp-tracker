import { controlTitle } from "@/games/alttpr/data/keymap";
import { isControlShown } from "@/games/alttpr/hooks/useItemShortcuts";
import { smallKeysMax } from "@/games/alttpr/logic/settings";
import { changedValue, type VoiceAction } from "@/games/alttpr/logic/voice";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { itemRange } from "@/games/alttpr/stores/persistence";
import { isRunning } from "@/utils/runTimer";

/** What a heard command did, said back to the player. */
export interface Heard {
  /** Its words: the control or the run command */
  readonly words: string;
  /** Whether it changed anything: a find already marked changes nothing */
  readonly changed: boolean;
}

/**
 * Do what a voice command says, as the player's own step (one undo step,
 * like a click), and say what it did. A control the board does not show
 * (a key cell's while they are hidden) is left alone, as its shortcut is.
 * @param action - A command, from `commandsOf`
 */
export const applyVoice = (action: VoiceAction): Heard => {
  const store = useGameStore.getState();
  switch (action.kind) {
    case "undo":
      store.undo();
      return { changed: store.past.length > 0, words: "Undo" };
    case "redo":
      store.redo();
      return { changed: store.future.length > 0, words: "Redo" };
    case "startTimer":
      store.startTimer();
      return {
        changed: !isRunning(store.timer) && !store.timer.finished,
        words: "Start the timer",
      };
    case "pauseTimer":
      store.pauseTimer();
      return { changed: isRunning(store.timer), words: "Pause the timer" };
    default:
      break;
  }

  const { change, control } = action;
  const words = controlTitle(control);
  if (!isControlShown(control)) return { changed: false, words };

  const [, kind, index] = /^(smallkey|medallion)(\d+)$/.exec(control) ?? [];
  const dungeon = Number(index);
  if (kind === "smallkey") {
    const now = store.smallKeys[dungeon] ?? 0;
    const next = changedValue(change, now, 0, smallKeysMax(dungeon));
    store.setSmallKeys(dungeon, Number(next));
    return { changed: next !== now, words };
  }
  if (kind === "medallion") {
    const now = store.medallions[dungeon] ?? 0;
    const next = Number(changedValue(change, now, 0, 3));
    if (next !== now) store.handleMedallionChange(dungeon, next);
    return { changed: next !== now, words };
  }
  const now = store.items[control];
  const [min, max] =
    typeof now === "number" ? itemRange(control, store.settings) : [0, 1];
  const next = changedValue(change, now ?? false, min, max);
  store.setItem(control, next);
  return { changed: next !== now, words };
};
