import { detectEnvironment, parseUserAgent } from "@alltp/autotrack";
import { type ReactNode, useEffect } from "react";
import type { GameAutotrack } from "@/autotrack/gameSession";
import { detailOf, headlineOf, phaseOf } from "@/autotrack/status";
import { SetupGuide } from "@/components/autotrack/SetupGuide";
import { StatusDot } from "@/components/autotrack/StatusDot";
import { Modal } from "@/components/ui/Modal";

/**
 * A game's autotracking dialog, as ALttPR's: the status, Connect or
 * Disconnect, Retry now while the session waits, Stop waiting while another
 * tab autotracks, what the board follows, the setup guide ticked live, and
 * what was read of the seed. It opens only on the player's click.
 * @param session - The game's autotracking
 * @param game - The game as the setup guide names it
 * @param follows - What the board follows, in a sentence or two
 * @param children - What was read of the seed
 * @param onClose - Called to close the dialog
 */
export const GameAutotrackDialog = <Reading,>({
  children,
  follows,
  game,
  onClose,
  session,
}: {
  children?: ReactNode;
  follows: ReactNode;
  game: string;
  onClose: () => void;
  session: GameAutotrack<Reading>;
}) => {
  const active = session.useStore((state) => state.active);
  const elsewhere = session.useStore((state) => state.elsewhere);
  const shown = session.useStore((state) => state.shown);
  const environment = session.useStore((state) => state.environment);
  const unavailable = session.useStore((state) => state.unavailable);
  const phase = unavailable ? "problem" : phaseOf(shown, active, elsewhere);
  const headline = unavailable
    ? "Autotracking could not be loaded"
    : headlineOf(shown, active, elsewhere, session.seed);
  const canRetry = active && !elsewhere && "retryInMs" in shown;

  // The setup guide, before any connection: the system, once, as it opens
  useEffect(() => {
    if (session.useStore.getState().environment !== null) return;
    void detectEnvironment().then((found) =>
      session.useStore.setState({ environment: found }),
    );
  }, [session]);

  return (
    <Modal
      footer={
        <button
          className="modal-btn modal-btn--ghost"
          onClick={onClose}
          type="button"
        >
          Done
        </button>
      }
      isOpen
      onClose={onClose}
      title="Autotracking"
      wide
    >
      <div className="autotrack" data-testid="autotrack-dialog">
        <div className="autotrack-status" data-phase={phase}>
          <StatusDot large phase={phase} />
          <div className="autotrack-status__text">
            <div className="autotrack-status__title">
              <p
                className="autotrack-status__headline"
                data-testid="autotrack-headline"
              >
                {headline}
              </p>
            </div>
            <p className="autotrack-status__detail">
              {unavailable
                ? "Reload the page to try again; your run is saved."
                : detailOf(shown, active, elsewhere)}
            </p>
          </div>
        </div>

        <div className="autotrack-actions">
          {elsewhere ? (
            // Stops waiting here only: the other tab, and the wish to
            // connect on start, stay as they are
            <button
              className="modal-btn modal-btn--ghost"
              data-testid="autotrack-stop-waiting"
              onClick={session.stop}
              type="button"
            >
              Stop waiting
            </button>
          ) : active ? (
            <button
              className="modal-btn modal-btn--ghost"
              data-testid="autotrack-disconnect"
              onClick={session.disconnect}
              type="button"
            >
              Disconnect
            </button>
          ) : (
            <button
              className="modal-btn modal-btn--primary"
              data-autofocus
              data-testid="autotrack-connect"
              onClick={() => void session.connect()}
              type="button"
            >
              Connect
            </button>
          )}
          {canRetry && (
            <button
              className="modal-btn modal-btn--primary"
              data-autofocus
              data-testid="autotrack-retry"
              onClick={session.retry}
              type="button"
            >
              Retry now
            </button>
          )}
        </div>
        <p className="autotrack-follow__text">{follows}</p>

        <SetupGuide
          environment={environment ?? parseUserAgent(navigator.userAgent)}
          game={game}
          status={shown}
        />
        {children}
      </div>
    </Modal>
  );
};
