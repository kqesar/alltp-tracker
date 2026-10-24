import {
  detectEnvironment,
  diagnosticReport,
  parseUserAgent,
} from "@alltp/autotrack";
import { useEffect, useId, useRef, useState } from "react";
import { detailOf, headlineOf, phaseOf } from "@/autotrack/status";
import { RaceModeOption } from "@/components/autotrack/RaceModeOption";
import { SetupGuide } from "@/components/autotrack/SetupGuide";
import {
  RaceBadge,
  raceReason,
  StatusDot,
} from "@/components/autotrack/StatusDot";
import { Modal } from "@/components/ui/Modal";
import { seedLineText } from "@/games/alttpr/autotrack/seed";
import { Readout } from "@/games/alttpr/components/autotrack/Readout";
import {
  connectAutotrack,
  disconnectAutotrack,
  preloadAutotrack,
  retryAutotrack,
  stopAutotrack,
  syncFromGame,
  useAutotrackStore,
  useSeedCheck,
} from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { copyStatus, copyText } from "@/utils/clipboard";

/** What Sync from game did, in a few words. */
const syncedText = (changed: number | null) => {
  if (changed === null) return "No game in play read yet.";
  if (changed === 0) return "The board already matches the game.";
  return `${changed} ${changed === 1 ? "mark" : "marks"} set to the game's. Undo takes ${changed === 1 ? "it" : "them"} back.`;
};

/**
 * The autotracking dialog: the status with the race-legal badge, Connect or
 * Disconnect, Retry now while the session waits, the diagnostic report to
 * copy, Sync from game, Race Mode (the ROM's flag or always on), the setup
 * guide ticked live, and what was read. It
 * opens only on the player's click; nothing in it pops up on its own.
 * @param onClose - Called to close the dialog
 */
export const AutotrackDialog = ({ onClose }: { onClose: () => void }) => {
  const active = useAutotrackStore((state) => state.active);
  const elsewhere = useAutotrackStore((state) => state.elsewhere);
  const shown = useAutotrackStore((state) => state.shown);
  const environment = useAutotrackStore((state) => state.environment);
  const reading = useAutotrackStore((state) => state.reading);
  const unavailable = useAutotrackStore((state) => state.unavailable);
  const connectOnStart = useAutotrackStore((state) => state.connectOnStart);
  const setConnectOnStart = useAutotrackStore(
    (state) => state.setConnectOnStart,
  );
  const raceChoice = useAutotrackStore((state) => state.raceChoice);
  const setRaceChoice = useAutotrackStore((state) => state.setRaceChoice);
  const [copied, setCopied] = useState("");
  const [synced, setSynced] = useState("");
  const [manualReport, setManualReport] = useState<string | null>(null);
  const reportRef = useRef<HTMLTextAreaElement>(null);
  const optionId = useId();
  const followId = useId();

  // The session's code, so that Connect starts at once; the system, for the
  // guide's tabs and the report
  useEffect(() => {
    preloadAutotrack();
    if (useAutotrackStore.getState().environment !== null) return;
    // It never fails: what it cannot read, it reports as unknown
    void detectEnvironment().then((found) =>
      useAutotrackStore.setState({ environment: found }),
    );
  }, []);

  // A copy the clipboard refused waits, selected, for the player's own copy
  useEffect(() => {
    if (manualReport !== null) reportRef.current?.select();
  }, [manualReport]);

  const phase = unavailable ? "problem" : phaseOf(shown, active, elsewhere);
  const headline = unavailable
    ? "Autotracking could not be loaded"
    : headlineOf(shown, active, elsewhere);
  const connected = active && !elsewhere && shown.code === "connected";
  const race = connected && shown.race.active ? shown.race : null;
  const shuffled = useGameStore(
    (state) => state.settings.entranceShuffle !== "none",
  );
  const canRetry = active && "retryInMs" in shown;
  const seedCheck = useSeedCheck();
  const keptSeed = useAutotrackStore((state) => state.keptSeed);
  const seedFile = useAutotrackStore((state) => state.seedFile?.result);

  const copyReport = async () => {
    const state = useAutotrackStore.getState();
    const report = diagnosticReport({
      bridge: state.bridge,
      devices: state.devices,
      environment: state.environment,
      now: Date.now(),
      status: state.status,
      statusSince: state.since,
    });
    // The report is shown in a field only once the copy fails, so there is
    // nothing to select beforehand
    const result = await copyText(report);
    setManualReport(result === "copied" ? null : report);
    setCopied(copyStatus(result));
  };

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
              {race && <RaceBadge race={race} />}
            </div>
            <p className="autotrack-status__detail">
              {unavailable
                ? "Reload the page to try again; your run is saved."
                : detailOf(shown, active, elsewhere)}
            </p>
            {connected && (
              <p className="autotrack-status__detail" data-testid="race-mode">
                {race
                  ? raceReason(race)
                  : "Race Mode is off: this seed is not a race seed."}
              </p>
            )}
            {connected && seedCheck && (
              <p
                className="autotrack-status__detail"
                data-testid="autotrack-seed"
              >
                {seedLineText(
                  seedCheck,
                  "seed" in seedCheck && seedCheck.seed === keptSeed,
                  typeof seedFile === "string" ? seedFile : undefined,
                )}
              </p>
            )}
          </div>
        </div>

        <div className="autotrack-actions">
          {elsewhere ? (
            // Stops waiting here only: the other tab, and the wish to
            // connect on start, stay as they are
            <button
              className="modal-btn modal-btn--ghost"
              data-testid="autotrack-stop-waiting"
              onClick={stopAutotrack}
              type="button"
            >
              Stop waiting
            </button>
          ) : active ? (
            <button
              className="modal-btn modal-btn--ghost"
              data-testid="autotrack-disconnect"
              onClick={disconnectAutotrack}
              type="button"
            >
              Disconnect
            </button>
          ) : (
            <button
              className="modal-btn modal-btn--primary"
              data-autofocus
              data-testid="autotrack-connect"
              onClick={() => void connectAutotrack()}
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
              onClick={retryAutotrack}
              type="button"
            >
              Retry now
            </button>
          )}
          <button
            className="modal-btn modal-btn--ghost"
            data-testid="autotrack-copy-report"
            onClick={() => void copyReport()}
            type="button"
          >
            Copy diagnostic report
          </button>
          <output
            className="autotrack-actions__status"
            data-testid="autotrack-copy-status"
          >
            {copied}
          </output>
        </div>
        {manualReport !== null && (
          <textarea
            aria-label="Diagnostic report"
            className="autotrack-report"
            data-testid="autotrack-report"
            readOnly
            ref={reportRef}
            rows={8}
            value={manualReport}
          />
        )}
        {active && !elsewhere && (
          <div className="autotrack-follow" data-testid="autotrack-follow">
            <p className="autotrack-follow__text" id={followId}>
              The board follows your game as you play, and the marks you set
              beyond it stay. Sync from game sets the board to the game,
              clearing them.
              {race &&
                ` In Race Mode, what races forbid tracking stays yours to mark: pendants and crystals, chests inside dungeons, bottles${shuffled ? ", where entrances lead" : ""}.`}
            </p>
            <div className="autotrack-actions">
              <button
                aria-describedby={followId}
                className="modal-btn modal-btn--ghost"
                data-testid="autotrack-sync"
                onClick={() => setSynced(syncedText(syncFromGame()))}
                type="button"
              >
                Sync from game
              </button>
              <output
                className="autotrack-actions__status"
                data-testid="autotrack-sync-status"
              >
                {synced}
              </output>
            </div>
          </div>
        )}
        <div className="check-option">
          <input
            checked={connectOnStart}
            className="check-option__input"
            data-testid="autotrack-connect-on-start"
            id={optionId}
            onChange={(event) => setConnectOnStart(event.target.checked)}
            type="checkbox"
          />
          <label htmlFor={optionId}>
            Connect when the tracker opens, on this device
          </label>
        </div>
        <RaceModeOption onChange={setRaceChoice} value={raceChoice} />

        <SetupGuide
          environment={environment ?? parseUserAgent(navigator.userAgent)}
          status={shown}
        />
        {reading && <Readout live={connected} reading={reading} />}
      </div>
    </Modal>
  );
};
