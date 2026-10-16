import {
  type BridgeInfo,
  type DeviceInfo,
  type DeviceKind,
  detectEnvironment,
  diagnosticReport,
  parseUserAgent,
  type SessionStatus,
} from "@alltp/autotrack";
import { useEffect, useId, useRef, useState } from "react";
import { headlineOf, phaseOf } from "@/autotrack/status";
import { Readout } from "@/components/autotrack/Readout";
import { SetupGuide } from "@/components/autotrack/SetupGuide";
import {
  RaceBadge,
  raceReason,
  StatusDot,
} from "@/components/autotrack/StatusDot";
import { Modal } from "@/components/ui/Modal";
import {
  connectAutotrack,
  disconnectAutotrack,
  preloadAutotrack,
  retryAutotrack,
  useAutotrackStore,
} from "@/stores/autotrackStore";
import { commandKey } from "@/utils/platform";

const BRIDGE_NAMES: Record<BridgeInfo["kind"], string> = {
  qusb2snes: "QUsb2Snes",
  sni: "SNI",
  unknown: "The bridge",
};

const DEVICE_NAMES: Partial<Record<DeviceKind, string>> = {
  emunwa: "NWA emulator",
  fxpakpro: "FX Pak Pro",
  luabridge: "BizHawk",
  retroarch: "RetroArch",
  "snes-classic": "SNES Classic",
};

const bridgeName = (bridge: BridgeInfo) =>
  [BRIDGE_NAMES[bridge.kind], bridge.version].filter(Boolean).join(" ");

/** "RetroArch 1.22.2", from the kind of device and what Info reported. */
const deviceName = (info: DeviceInfo) =>
  [DEVICE_NAMES[info.device.kind] ?? info.name, info.version]
    .filter(Boolean)
    .join(" ");

/** The line under the headline: what is connected, or what happens next. */
const detailOf = (status: SessionStatus, active: boolean): string => {
  if (!active) {
    return "Reads your game through SNI or QUsb2Snes as you play. Set it up below, then connect.";
  }
  switch (status.code) {
    case "connected":
      return [
        bridgeName(status.bridge),
        deviceName(status.device),
        status.device.device.id,
      ]
        .filter(Boolean)
        .join(" · ");
    case "attaching":
      return `${bridgeName(status.bridge)} · ${status.device.id}`;
    default:
      if (!("retryInMs" in status)) return "";
      return status.retryInMs === null
        ? "Waiting for you: see the step below, then click Retry now."
        : "Trying again on its own: see the step below.";
  }
};

/**
 * The autotracking dialog: the status with the race-legal badge, Connect or
 * Disconnect, Retry now while the session waits, the diagnostic report to
 * copy, the setup guide ticked live, and what was read. It opens only on the
 * player's click; nothing in it pops up on its own.
 * @param onClose - Called to close the dialog
 */
export const AutotrackDialog = ({ onClose }: { onClose: () => void }) => {
  const active = useAutotrackStore((state) => state.active);
  const shown = useAutotrackStore((state) => state.shown);
  const environment = useAutotrackStore((state) => state.environment);
  const reading = useAutotrackStore((state) => state.reading);
  const unavailable = useAutotrackStore((state) => state.unavailable);
  const connectOnStart = useAutotrackStore((state) => state.connectOnStart);
  const setConnectOnStart = useAutotrackStore(
    (state) => state.setConnectOnStart,
  );
  const [copied, setCopied] = useState("");
  const [manualReport, setManualReport] = useState<string | null>(null);
  const reportRef = useRef<HTMLTextAreaElement>(null);
  const optionId = useId();

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

  const phase = unavailable ? "problem" : phaseOf(shown, active);
  const headline = unavailable
    ? "Autotracking could not be loaded"
    : headlineOf(shown, active);
  const race =
    active && shown.code === "connected" && shown.race.active
      ? shown.race
      : null;
  const canRetry = active && "retryInMs" in shown;

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
    try {
      await navigator.clipboard.writeText(report);
      setManualReport(null);
      setCopied("Copied.");
    } catch {
      setManualReport(report);
      setCopied(`Press ${commandKey()}+C to copy.`);
    }
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
                : detailOf(shown, active)}
            </p>
            {active && shown.code === "connected" && (
              <p className="autotrack-status__detail" data-testid="race-mode">
                {race
                  ? raceReason(race)
                  : "Race Mode is off: this seed is not a race seed."}
              </p>
            )}
          </div>
        </div>

        <div className="autotrack-actions">
          {active ? (
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
        <div className="autotrack-option">
          <input
            checked={connectOnStart}
            className="autotrack-option__input"
            data-testid="autotrack-connect-on-start"
            id={optionId}
            onChange={(event) => setConnectOnStart(event.target.checked)}
            type="checkbox"
          />
          <label htmlFor={optionId}>
            Connect when the tracker opens, on this device
          </label>
        </div>

        <SetupGuide
          environment={environment ?? parseUserAgent(navigator.userAgent)}
          status={shown}
        />
        {reading && (
          <Readout
            live={active && shown.code === "connected"}
            reading={reading}
          />
        )}
      </div>
    </Modal>
  );
};
