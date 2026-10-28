import { useEffect, useState } from "react";
import { page } from "@/components/ui/lazyDialog";
import { CloseIcon } from "@/components/ui/ToolbarIcons";
import { GAMES, type GameId, loadGame, switchGame } from "@/games/registry";
import {
  clearSharedRun,
  decodeRun,
  gameOfSave,
  RunLinkError,
  sharedPayload,
} from "@/share/runLink";
import { useUpdateStore } from "@/stores/updateStore";

/** How long "Shared run opened" stays on screen. */
const OPENED_MS = 4000;

/** The longest reason shown: a hostile link may make a long one. */
const MAX_REASON_CHARS = 200;

type Offer =
  | { kind: "ask"; game: GameId; load: () => void }
  /** `newer`: a newer tracker wrote it, so a reload, the address kept, may open it */
  | { kind: "refused"; reason: string; newer?: true }
  | { kind: "opened" };

/**
 * Read a link's run and check it with its game's own import, applying
 * nothing: an offer to open it, or why it cannot be.
 */
const inspect = async (payload: string): Promise<Offer> => {
  try {
    const save = await decodeRun(payload);
    const game = gameOfSave(save);
    if (game === null) {
      return {
        kind: "refused",
        reason: "This link does not hold a tracker run.",
      };
    }
    const result = (await loadGame(game)).importRun(save);
    if (result.ok) return { game, kind: "ask", load: result.load };
    return {
      kind: "refused",
      reason: result.reason.slice(0, MAX_REASON_CHARS),
      ...(result.newer && { newer: true }),
    };
  } catch (error) {
    return {
      kind: "refused",
      reason:
        error instanceof RunLinkError
          ? error.message
          : "This link could not be opened.",
    };
  }
};

/**
 * The notice that the address carries a shared run (`#run=…`): Open loads it
 * as an Import does (same validation, migrations and undo point) and clears
 * the fragment; Keep mine only clears it. Nothing is applied until the player
 * answers, and a link that is not a valid run only says so. One of the
 * page's notices, a live region that stays in the page, empty, so it is heard
 * the moment it fills. It watches the address, so a link opened in a tab
 * already on the tracker asks too. A link a newer tracker wrote offers
 * Reload, which keeps the address: the latest release, once loaded, opens
 * it; only the player's dismissal clears it.
 * @param game - The game this page tracks: another one's run switches to it
 */
export const SharedRunPrompt = ({ game }: { game: GameId }) => {
  const [offer, setOffer] = useState<Offer | null>(null);
  // A new version already waiting is taken on the way; else a plain reload,
  // which fetches the latest release from the network (sw/sw.ts)
  const update = useUpdateStore((state) => state.apply);

  useEffect(() => {
    let current = true;
    const read = () => {
      const payload = sharedPayload();
      if (payload === null) return;
      void inspect(payload).then((next) => {
        if (current) setOffer(next);
      });
    };
    read();
    window.addEventListener("hashchange", read);
    return () => {
      current = false;
      window.removeEventListener("hashchange", read);
    };
  }, []);

  useEffect(() => {
    if (offer?.kind !== "opened") return;
    const timer = setTimeout(() => setOffer(null), OPENED_MS);
    return () => clearTimeout(timer);
  }, [offer]);

  const dismiss = () => {
    clearSharedRun();
    setOffer(null);
  };

  const open = () => {
    if (offer?.kind !== "ask") return;
    offer.load();
    clearSharedRun();
    // Another game's run is laid in its own store; the page then loads that game
    if (offer.game === game) setOffer({ kind: "opened" });
    else switchGame(offer.game);
  };

  return (
    <div className="notice" data-testid="shared-run-prompt" role="status">
      {offer?.kind === "ask" && (
        <div className="notice__card">
          <p className="notice__message">
            Open this shared run? It replaces the run on this device.
            {offer.game !== game &&
              ` It switches to ${GAMES[offer.game].name}.`}
          </p>
          <div className="notice__actions">
            <button
              className="notice__button notice__button--primary"
              data-testid="shared-run-open"
              onClick={open}
              type="button"
            >
              Open
            </button>
            <button
              className="notice__button"
              data-testid="shared-run-keep"
              onClick={dismiss}
              type="button"
            >
              Keep mine
            </button>
          </div>
        </div>
      )}
      {offer?.kind === "refused" && (
        <div className="notice__card">
          <p className="notice__message" data-testid="shared-run-refused">
            {offer.reason} Nothing was changed.
          </p>
          <div className="notice__actions">
            {offer.newer && (
              <button
                className="notice__button notice__button--primary"
                data-testid="shared-run-reload"
                onClick={() => (update ?? page.reload)()}
                type="button"
              >
                Reload
              </button>
            )}
            <button
              aria-label="Dismiss"
              className="notice__button"
              data-testid="shared-run-dismiss"
              onClick={dismiss}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}
      {offer?.kind === "opened" && (
        <div className="notice__card">
          <p className="notice__message">
            Shared run opened. Undo takes it back.
          </p>
        </div>
      )}
    </div>
  );
};
