import { useEffect, useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { MicIcon } from "@/components/ui/ToolbarIcons";
import { controlTitle } from "@/games/alttpr/data/keymap";
import { findName } from "@/games/alttpr/logic/runLog";
import {
  type Change,
  VOICE_GUIDE,
  WAKE_WORD,
} from "@/games/alttpr/logic/voice";
import {
  removeVoiceModel,
  setVoiceDevice,
  startVoice,
  stopVoice,
  useVoiceStore,
  type VoiceStatus,
} from "@/games/alttpr/stores/voiceStore";
import type { VoiceFailure } from "@/games/alttpr/voice/engine";

/** How long the button shows a command it heard. */
const HEARD_MS = 3000;

/** Each status in a few words, on the button and in the dialog. */
const STATUS_WORDS: Record<VoiceStatus, string> = {
  elsewhere: "Listening in another tab",
  failed: "Stopped",
  listening: "Listening",
  loading: "Loading the speech model",
  off: "Off",
  opening: "Opening the microphone",
};

/** What went wrong, and what to do about it. */
const FAILURES: Record<VoiceFailure, string> = {
  denied:
    "The browser was refused the microphone. Allow it in this site's settings, then start again.",
  model:
    "The speech model could not be loaded. Check your connection, then start again.",
  "no-microphone": "No microphone was found. Plug one in, then start again.",
};

/**
 * What an item's phrases find, in the board's words: the item, a named
 * level or bit ("Master Sword", "Silver Arrows"), or one level more.
 */
const findLabel = (control: string, change: Change): string => {
  if ("bit" in change) return findName(`item:${control}:${change.bit}`);
  if ("atLeast" in change) return findName(`item:${control}:${change.atLeast}`);
  if ("to" in change && change.to === "next") {
    return `${controlTitle(control)}, one level up`;
  }
  if ("to" in change && change.to === "heart") return "A whole heart";
  if ("to" in change && change.to === "piece") return "A heart piece";
  return controlTitle(control);
};

/** A phrase to say, as the player says it. */
const Say = ({ phrase }: { phrase: string }) => (
  <q className="voice-say">{phrase}</q>
);

/** The microphones the browser lists, named once it has the permission. */
const useMicrophones = () => {
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const listening = useVoiceStore((state) => state.status === "listening");
  // biome-ignore lint/correctness/useExhaustiveDependencies: listening grants the permission that names the devices: list them again then
  useEffect(() => {
    const devices = navigator.mediaDevices;
    if (!devices?.enumerateDevices) return;
    const list = () =>
      void devices
        .enumerateDevices()
        .then((all) =>
          setMicrophones(all.filter(({ kind }) => kind === "audioinput")),
        );
    list();
    devices.addEventListener?.("devicechange", list);
    return () => devices.removeEventListener?.("devicechange", list);
  }, [listening]);
  return microphones;
};

/** What to say: the commands, grouped as the board is. */
const Guide = () => (
  <div className="voice-guide">
    <section aria-labelledby="voice-guide-items">
      <h3 className="voice-guide__title" id="voice-guide-items">
        Items
      </h3>
      <dl className="voice-guide__list">
        {VOICE_GUIDE.items.map(({ change, control, phrases }) => (
          <div className="voice-guide__row" key={phrases[0]}>
            <dt>{findLabel(control, change)}</dt>
            <dd>
              {phrases.map((phrase, index) => (
                <span key={phrase}>
                  {index > 0 && " or "}
                  <Say phrase={phrase} />
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
    <section aria-labelledby="voice-guide-dungeons">
      <h3 className="voice-guide__title" id="voice-guide-dungeons">
        Dungeons
      </h3>
      <p className="voice-guide__note">
        A dungeon's name, then one of:{" "}
        {VOICE_GUIDE.parts.map((phrases, index) => (
          <span key={phrases[0]}>
            {index > 0 && ", "}
            <Say phrase={phrases[0]} />
          </span>
        ))}
        . For example, <Say phrase={`${WAKE_WORD} eastern boss`} />.
      </p>
      <ul className="voice-guide__names">
        {VOICE_GUIDE.dungeons.map((names) => (
          <li key={names[0]}>
            {names.map((name, index) => (
              <span key={name}>
                {index > 0 && " or "}
                <Say phrase={name} />
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
    <section aria-labelledby="voice-guide-run">
      <h3 className="voice-guide__title" id="voice-guide-run">
        Run
      </h3>
      <p className="voice-guide__note">
        {VOICE_GUIDE.run.map((phrases, index) => (
          <span key={phrases[0]}>
            {index > 0 && ", "}
            <Say phrase={phrases[0]} />
          </span>
        ))}
        .
      </p>
    </section>
  </div>
);

/** The dialog: turn voice commands on or off, pick the microphone, learn what to say. */
const VoiceDialog = ({ onClose }: { onClose: () => void }) => {
  const status = useVoiceStore((state) => state.status);
  const failure = useVoiceStore((state) => state.failure);
  const deviceId = useVoiceStore((state) => state.deviceId);
  const microphones = useMicrophones();
  const micId = useId();
  const [removed, setRemoved] = useState<"failed" | "removed" | null>(null);
  const on = status !== "off" && status !== "failed";

  return (
    <Modal
      footer={
        <>
          <button
            className="modal-btn modal-btn--ghost"
            onClick={onClose}
            type="button"
          >
            Done
          </button>
          {on ? (
            <button
              className="modal-btn modal-btn--primary"
              data-autofocus
              data-testid="voice-stop"
              onClick={stopVoice}
              type="button"
            >
              Stop listening
            </button>
          ) : (
            <button
              className="modal-btn modal-btn--primary"
              data-autofocus
              data-testid="voice-start"
              onClick={() => void startVoice()}
              type="button"
            >
              Start listening
            </button>
          )}
        </>
      }
      isOpen
      onClose={onClose}
      title="Voice commands"
      wide
    >
      <div className="voice">
        <p className="modal__message">
          Say <Say phrase={WAKE_WORD} />, then what you found:{" "}
          <Say phrase={`${WAKE_WORD} hook shot`} />. It works while the game has
          the focus. The speech is recognized in this browser: no sound leaves
          your computer.
        </p>
        <p
          className={`voice__status voice__status--${status}`}
          data-testid="voice-status"
          role="status"
        >
          {STATUS_WORDS[status]}
          {status === "failed" && failure ? `: ${FAILURES[failure]}` : "."}
          {(status === "off" || status === "loading") && (
            <span className="voice__note">
              {" "}
              The first start downloads the speech model, 40 MB, kept for next
              time.
            </span>
          )}
        </p>
        <label className="voice__field">
          <span className="voice__label" id={micId}>
            Microphone
          </span>
          <select
            aria-labelledby={micId}
            className="voice__select"
            data-testid="voice-microphone"
            onChange={(event) => setVoiceDevice(event.target.value || null)}
            value={deviceId ?? ""}
          >
            <option value="">The system's default</option>
            {microphones
              .filter(({ deviceId: id }) => id && id !== "default")
              .map((microphone, index) => (
                <option key={microphone.deviceId} value={microphone.deviceId}>
                  {microphone.label || `Microphone ${index + 1}`}
                </option>
              ))}
          </select>
        </label>
        <details className="voice__guide" data-testid="voice-guide">
          <summary>What to say</summary>
          <Guide />
        </details>
        <p className="voice__note">
          English words only. Not in an OBS dock, which has no microphone: speak
          to the tracker in a browser tab.
        </p>
        {!on && (
          <div className="voice__remove">
            <button
              className="modal-btn modal-btn--ghost"
              data-testid="voice-remove-model"
              onClick={() =>
                void removeVoiceModel().then((gone) =>
                  setRemoved(gone ? "removed" : "failed"),
                )
              }
              type="button"
            >
              Remove the speech model
            </button>
            <output className="voice__note" data-testid="voice-remove-status">
              {removed === "removed" &&
                "Removed: about 60 MB freed. The next start downloads it again."}
              {removed === "failed" &&
                "It could not be removed: close the tracker's other tabs, then try again."}
            </output>
          </div>
        )}
      </div>
    </Modal>
  );
};

/**
 * Voice commands, beside the run timer: a button that says whether the
 * tracker is listening (always in sight while it does) and shows each
 * command it hears for a moment, and opens the dialog that turns them on.
 */
export const VoiceControl = () => {
  const status = useVoiceStore((state) => state.status);
  const heard = useVoiceStore((state) => state.heard);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!heard) return;
    setShown(heard.changed ? heard.words : `${heard.words}: no change`);
    const timer = setTimeout(() => setShown(null), HEARD_MS);
    return () => clearTimeout(timer);
  }, [heard]);

  const words = STATUS_WORDS[status];
  return (
    <>
      <button
        aria-label={`Voice commands: ${words.toLowerCase()}`}
        className={`voice-button voice-button--${status}`}
        data-testid="voice-button"
        onClick={() => setOpen(true)}
        title="Voice commands"
        type="button"
      >
        <MicIcon />
        <span aria-hidden="true" className="voice-button__text">
          {shown ?? (status === "off" ? "Voice" : words)}
        </span>
      </button>
      {open && <VoiceDialog onClose={() => setOpen(false)} />}
    </>
  );
};

/**
 * What voice commands did, said politely to a screen reader as each is
 * heard: the command's words, or that it changed nothing.
 */
export const VoiceLiveRegion = () => {
  const heard = useVoiceStore((state) => state.heard);
  return (
    <span className="sr-only" data-testid="voice-live" role="status">
      {heard &&
        `Voice: ${heard.words}${heard.changed ? "" : ", nothing to change"}`}
    </span>
  );
};
