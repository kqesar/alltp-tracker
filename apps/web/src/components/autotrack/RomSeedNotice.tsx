import type { RomSeed } from "@/autotrack/romSeed";
import { romSeedText } from "@/games/seedId";

/**
 * The notice that the ROM autotracking reads is of another seed than the
 * run's, which the board then does not follow: New run starts a new run that
 * takes the ROM's seed (New game, one undo step); Follow this ROM makes the
 * ROM's seed the run's (one undo step too), and the board follows it. One of the page's notices, beside
 * UpdatePrompt, and like it a live region that stays in the page, empty, so
 * it is heard the moment it fills.
 * @param romSeed - The game's check and answers
 */
export const RomSeedNotice = ({ romSeed }: { romSeed: RomSeed }) => {
  const check = romSeed.useCheck();
  return (
    <div className="notice" data-testid="rom-seed-notice" role="status">
      {check?.kind === "differs" && (
        <div className="notice__card">
          <p className="notice__message notice__message--ids">
            {romSeedText(check)}
          </p>
          <div className="notice__actions">
            <button
              className="notice__button notice__button--primary"
              data-testid="rom-seed-new-run"
              onClick={romSeed.startRun}
              type="button"
            >
              New run
            </button>
            <button
              className="notice__button"
              data-testid="rom-seed-follow"
              onClick={romSeed.follow}
              type="button"
            >
              Follow this ROM
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * The same, as a line of the autotracking dialog's status: with the two
 * answers while the ROM is another seed's, alone while Race Mode keeps the
 * check off. Nothing when there is nothing to say.
 * @param romSeed - The game's check and answers
 */
export const RomSeedLine = ({ romSeed }: { romSeed: RomSeed }) => {
  const check = romSeed.useCheck();
  if (check === null) return null;
  return (
    <div className="autotrack-rom-seed" data-testid="autotrack-rom-seed">
      <p className="autotrack-status__detail autotrack-rom-seed__text">
        {romSeedText(check)}
      </p>
      {check.kind === "differs" && (
        <div className="autotrack-rom-seed__actions">
          <button
            className="modal-btn modal-btn--primary"
            data-testid="autotrack-rom-seed-new-run"
            onClick={romSeed.startRun}
            type="button"
          >
            New run
          </button>
          <button
            className="modal-btn modal-btn--ghost"
            data-testid="autotrack-rom-seed-follow"
            onClick={romSeed.follow}
            type="button"
          >
            Follow this ROM
          </button>
        </div>
      )}
    </div>
  );
};
