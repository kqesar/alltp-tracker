import { create } from "zustand";
import { persist } from "zustand/middleware";
import { commandsOf } from "@/logic/voice";
import { isObsView } from "@/utils/view";
import { applyVoice, type Heard } from "@/voice/apply";
import type { VoiceFailure, VoiceSession } from "@/voice/engine";

/**
 * Where voice commands stand: off; opening the microphone; loading the
 * speech model; listening; waiting while another tab of the tracker
 * listens; or stopped by a failure.
 */
export type VoiceStatus =
  | "elsewhere"
  | "failed"
  | "listening"
  | "loading"
  | "off"
  | "opening";

interface VoiceState {
  /** Listen whenever the tracker opens, on this device (saved). */
  enabled: boolean;
  /** The microphone picked, or null for the system's default (saved). */
  deviceId: string | null;
  status: VoiceStatus;
  /** Why it stopped, when `status` is "failed". */
  failure: VoiceFailure | null;
  /** The last command heard, which the live region says. */
  heard: (Heard & { readonly at: number }) | null;
}

/**
 * Voice commands' state, apart from the game store, so that a status change
 * never re-renders the board. Only the player's choices are saved: listening
 * on start, and the microphone.
 */
export const useVoiceStore = create<VoiceState>()(
  persist(
    (): VoiceState => ({
      deviceId: null,
      enabled: false,
      failure: null,
      heard: null,
      status: "off",
    }),
    {
      name: "alltp-tracker-voice",
      partialize: ({ deviceId, enabled }) => ({ deviceId, enabled }),
      version: 1,
    },
  ),
);

const set = useVoiceStore.setState;

/** The Web Lock one listening tab holds. */
const LOCK = "alltp-tracker-voice";

/** The running recognizer, once listening. */
let session: VoiceSession | null = null;
/** Lets go of the lock. */
let releaseLock: (() => void) | null = null;
let stopWaiting: AbortController | null = null;
/** Each start's number: a stop, or a newer start, outdates an older one. */
let generation = 0;

/**
 * Take the voice lock: at once when no other tab of the tracker listens,
 * else when that tab lets it go. Two tabs never both hear a command and
 * mark it twice. A browser without Web Locks goes ahead.
 */
const takeLock = async (mine: number): Promise<boolean> => {
  const locks = (navigator as { locks?: LockManager }).locks;
  if (locks === undefined) return true;
  const request = (options: LockOptions) =>
    new Promise<boolean>((resolve) => {
      locks
        .request(LOCK, options, (lock) => {
          if (lock === null || mine !== generation) {
            resolve(false);
            return;
          }
          resolve(true);
          return new Promise<void>((release) => {
            releaseLock = release;
          });
        })
        .catch(() => resolve(false));
    });
  if (await request({ ifAvailable: true })) return true;
  if (mine !== generation) return false;
  set({ status: "elsewhere" });
  stopWaiting = new AbortController();
  return request({ signal: stopWaiting.signal });
};

/** Let go of everything a start took, without touching the saved choice. */
const release = () => {
  generation++;
  stopWaiting?.abort();
  stopWaiting = null;
  session?.stop();
  session = null;
  releaseLock?.();
  releaseLock = null;
};

/** Do each command of a heard text, and keep the last for the live region. */
const hear = (text: string) => {
  for (const action of commandsOf(text)) {
    set({ heard: { ...applyVoice(action), at: Date.now() } });
  }
};

/**
 * Start listening: take the lock, load the engine's code, open the
 * microphone and the speech model. Remembered on this device until the
 * player stops. The stream view never listens: the tracker it shows on
 * stream does.
 */
export const startVoice = async () => {
  if (isObsView()) return;
  release();
  const mine = generation;
  set({ enabled: true, failure: null, heard: null, status: "opening" });
  if (!(await takeLock(mine)) || mine !== generation) return;
  set({ status: "opening" });
  try {
    const { listen } = await import("@/voice/engine");
    const started = await listen({
      deviceId: useVoiceStore.getState().deviceId,
      onLoading: () => {
        if (mine === generation) set({ status: "loading" });
      },
      onText: hear,
    });
    if (mine !== generation) {
      started.stop();
      return;
    }
    session = started;
    set({ status: "listening" });
  } catch (error) {
    if (mine !== generation) return;
    release();
    const failure =
      error instanceof Error && "failure" in error
        ? (error.failure as VoiceFailure)
        : "model";
    // A refused microphone stays refused: do not ask again on every start
    set({ enabled: failure !== "denied", failure, status: "failed" });
  }
};

/** Stop listening, and do not listen on start any more. */
export const stopVoice = () => {
  release();
  set({ enabled: false, failure: null, status: "off" });
};

/** Stop with the tracker, keeping the choice to listen on its next start. */
export const shutdownVoice = () => {
  release();
  set({ status: "off" });
};

/** Pick a microphone; listening starts again with it. */
export const setVoiceDevice = (deviceId: string | null) => {
  set({ deviceId });
  const { status } = useVoiceStore.getState();
  if (status === "listening" || status === "loading") void startVoice();
};

/**
 * The IndexedDB database where the engine keeps the extracted speech model
 * (Emscripten's IDBFS, mounted at /vosk by vosk-browser's worker): about
 * 60 MB once voice commands have run.
 */
const MODEL_DATABASE = "/vosk";

/**
 * Free the speech model's storage. The next start downloads it again.
 * Stops listening first: the worker holds the database open.
 * @returns Whether it is gone
 */
export const removeVoiceModel = (): Promise<boolean> => {
  stopVoice();
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(MODEL_DATABASE);
    request.onsuccess = () => resolve(true);
    request.onerror = () => resolve(false);
    request.onblocked = () => resolve(false);
  });
};
