import { promptText } from "@/autotrack/seed";
import {
  keepRunType,
  switchToSeed,
  useAutotrackStore,
  useSeedCheck,
} from "@/stores/autotrackStore";

/**
 * The notice that the seed autotracking reads is of another run type than
 * the board's, which has a run on it (a fresh board switches on its own):
 * Switch starts the seed's run type with the game laid on it, one undo
 * step; Keep mine keeps the player's for this seed, at the next visit too.
 * One of the page's notices, beside UpdatePrompt, and like it a live region
 * that stays in the page, empty, so it is heard the moment it fills.
 */
export const SeedPrompt = () => {
  const check = useSeedCheck();
  const kept = useAutotrackStore((state) => state.keptSeed);
  const asking = check?.kind === "differs" && check.seed !== kept;

  return (
    <div className="notice" data-testid="seed-prompt" role="status">
      {asking && (
        <div className="notice__card">
          <p className="notice__message">{promptText(check)}</p>
          <div className="notice__actions">
            <button
              className="notice__button notice__button--primary"
              data-testid="seed-switch"
              onClick={switchToSeed}
              type="button"
            >
              Switch
            </button>
            <button
              className="notice__button"
              data-testid="seed-keep"
              onClick={keepRunType}
              type="button"
            >
              Keep mine
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
