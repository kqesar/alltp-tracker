import { detectEnvironment, parseUserAgent } from "@alltp/autotrack";
import { useEffect, useId } from "react";
import { detailOf, headlineOf, phaseOf } from "@/autotrack/status";
import { SetupGuide } from "@/components/autotrack/SetupGuide";
import { StatusDot } from "@/components/autotrack/StatusDot";
import { Modal } from "@/components/ui/Modal";
import {
  connectSmAutotrack,
  disconnectSmAutotrack,
  retrySmAutotrack,
  stopSmAutotrack,
  useSmAutotrackStore,
} from "@/games/sm/autotrack/store";

/** What the last reading said of the seed, in words. */
const SeedRead = () => {
  const reading = useSmAutotrackStore((state) => state.reading);
  const titleId = useId();
  if (reading === null || typeof reading.seed === "string") return null;
  const { seed } = reading;
  const objectives =
    typeof reading.objectives === "string" ? null : reading.objectives;
  const rows: [string, string][] = [
    ["Skill", seed.skill ?? "?"],
    ["Progression", seed.progression ?? "?"],
    ["Quality of life", seed.qol ?? "?"],
    ["Map", seed.map ?? "?"],
    ["Objectives", seed.objectives ?? "?"],
  ];
  return (
    <section
      aria-labelledby={titleId}
      className="readout"
      data-testid="sm-readout"
    >
      <h3 className="autotrack__heading" id={titleId}>
        What I read
      </h3>
      <p className="readout__meta">
        {seed.name === null ? (
          "A Map Rando seed."
        ) : (
          <>
            The Map Rando seed{" "}
            <a
              href={`https://maprando.com/seed/${seed.name}/`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {seed.name}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            .
          </>
        )}{" "}
        Compare it with your game.
      </p>
      <div className="readout__grid">
        <div className="readout__group" data-testid="sm-readout-settings">
          <h4 className="readout__title">Seed settings, from the ROM</h4>
          <dl className="readout__pairs">
            {rows.map(([label, value]) => (
              <div className="readout__pair" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {objectives !== null && (
          <div className="readout__group" data-testid="sm-readout-objectives">
            <h4 className="readout__title">Objectives</h4>
            {objectives.length === 0 ? (
              <p className="readout__none">None</p>
            ) : (
              <ul className="readout__chips">
                {objectives.map(({ done, objective }) => (
                  <li className="readout__chip" key={objective.id}>
                    {objective.name}
                    {done && ", done"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

/**
 * Super Metroid's autotracking dialog, as ALttPR's: the status, Connect or
 * Disconnect, Retry now while the session waits, Stop waiting while another
 * tab autotracks, the setup guide ticked live, and what was read of the
 * seed. It opens only on the player's click.
 * @param onClose - Called to close the dialog
 */
export const SmAutotrackDialog = ({ onClose }: { onClose: () => void }) => {
  const active = useSmAutotrackStore((state) => state.active);
  const elsewhere = useSmAutotrackStore((state) => state.elsewhere);
  const shown = useSmAutotrackStore((state) => state.shown);
  const environment = useSmAutotrackStore((state) => state.environment);
  const unavailable = useSmAutotrackStore((state) => state.unavailable);
  const phase = unavailable ? "problem" : phaseOf(shown, active, elsewhere);
  const headline = unavailable
    ? "Autotracking could not be loaded"
    : headlineOf(shown, active, elsewhere);
  const canRetry = active && !elsewhere && "retryInMs" in shown;

  // The setup guide, before any connection: the system, once, as it opens
  useEffect(() => {
    if (useSmAutotrackStore.getState().environment !== null) return;
    void detectEnvironment().then((found) =>
      useSmAutotrackStore.setState({ environment: found }),
    );
  }, []);

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
              onClick={stopSmAutotrack}
              type="button"
            >
              Stop waiting
            </button>
          ) : active ? (
            <button
              className="modal-btn modal-btn--ghost"
              data-testid="autotrack-disconnect"
              onClick={disconnectSmAutotrack}
              type="button"
            >
              Disconnect
            </button>
          ) : (
            <button
              className="modal-btn modal-btn--primary"
              data-autofocus
              data-testid="autotrack-connect"
              onClick={() => void connectSmAutotrack()}
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
              onClick={retrySmAutotrack}
              type="button"
            >
              Retry now
            </button>
          )}
        </div>
        <p className="autotrack-follow__text">
          The board follows your Map Rando game as you play: the items you hold,
          the seed's objectives and those done. The marks you set beyond it
          stay. Races allow autotracking.
        </p>

        <SetupGuide
          environment={environment ?? parseUserAgent(navigator.userAgent)}
          game="Map Rando"
          status={shown}
        />
        <SeedRead />
      </div>
    </Modal>
  );
};
