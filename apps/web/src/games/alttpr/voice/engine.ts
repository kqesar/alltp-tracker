// The voice engine: the microphone, the speech model and its recognizer.
// Loaded only once the player turns voice commands on (stores/voiceStore.ts
// imports it on demand), so the tracker's first load never carries it. Vosk
// runs in a Web Worker on the player's machine: no audio leaves it.
import {
  type ServerMessageError,
  type ServerMessageResult,
  VoskClient,
} from "@lichess-org/vosk-browser";
import wasmUrl from "@lichess-org/vosk-browser/dist/vosk.wasm?url";
import workerUrl from "@lichess-org/vosk-browser/dist/vosk.worker.js?url";
import { GRAMMAR } from "@/games/alttpr/logic/voice";

/**
 * The speech model, served beside the app (scripts/fetch-voice-model.mjs puts
 * it there). The worker keeps it in IndexedDB once extracted, by this URL:
 * a new model needs a new name.
 */
export const MODEL_URL = `${import.meta.env.BASE_URL}models/vosk-model-small-en-us-0.15.tar.gz`;

/** Why listening could not start. */
export type VoiceFailure = "denied" | "model" | "no-microphone";

export class VoiceError extends Error {
  override readonly name = "VoiceError";
  constructor(readonly failure: VoiceFailure) {
    super(failure);
  }
}

/**
 * The audio worklet: hands the microphone's samples on in chunks of 4096
 * (about 85 ms at 48 kHz), off the main thread's audio callback.
 */
const CAPTURE_WORKLET = `
class Capture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunk = new Float32Array(4096);
    this.at = 0;
  }
  process(inputs) {
    const samples = inputs[0] && inputs[0][0];
    if (samples) {
      for (let i = 0; i < samples.length; i++) {
        this.chunk[this.at++] = samples[i];
        if (this.at === this.chunk.length) {
          this.port.postMessage(this.chunk, [this.chunk.buffer]);
          this.chunk = new Float32Array(4096);
          this.at = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("tracker-voice-capture", Capture);
`;

/** Load the model into its worker, or say why it could not. */
const loadModel = (): Promise<VoskClient> =>
  new Promise((resolve, reject) => {
    const client = new VoskClient({
      logLevel: -1,
      modelUrl: new URL(MODEL_URL, location.href).href,
      wasmUrl: new URL(wasmUrl, location.href).href,
      workerUrl,
    });
    client.on("load", (message) => {
      if ("result" in message && message.result) resolve(client);
      else reject(new VoiceError("model"));
    });
    // A model that cannot be fetched or read says so as an error, not a load
    client.on("error", () => {
      client.terminate();
      reject(new VoiceError("model"));
    });
  });

/** The microphone, or why it is not there. */
const openMicrophone = async (deviceId: string | null) => {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    throw new VoiceError(
      name === "NotAllowedError" || name === "SecurityError"
        ? "denied"
        : "no-microphone",
    );
  }
};

/** A running recognizer, which `stop` releases: microphone, audio, worker. */
export interface VoiceSession {
  stop(): void;
}

/**
 * Listen: open the microphone, load the model (downloaded once, then from
 * IndexedDB) and hand each final result's text on. Only the grammar's
 * phrases can be heard (logic/voice.ts).
 * @param deviceId - The microphone, or the system's default
 * @param onText - Each final result
 * @param onLoading - Called while the model loads, the microphone open
 */
export const listen = async ({
  deviceId,
  onLoading,
  onText,
}: {
  deviceId: string | null;
  onLoading: () => void;
  onText: (text: string) => void;
}): Promise<VoiceSession> => {
  const stream = await openMicrophone(deviceId);
  onLoading();
  let client: VoskClient;
  try {
    client = await loadModel();
  } catch (error) {
    for (const track of stream.getTracks()) track.stop();
    throw error;
  }

  const audio = new AudioContext();
  const worklet = URL.createObjectURL(
    new Blob([CAPTURE_WORKLET], { type: "text/javascript" }),
  );
  await audio.audioWorklet.addModule(worklet);
  URL.revokeObjectURL(worklet);
  const recognizer = new client.KaldiRecognizer(
    audio.sampleRate,
    JSON.stringify(GRAMMAR),
  );
  recognizer.on("result", (message) => {
    const text = (message as ServerMessageResult).result?.text;
    if (text) onText(text);
  });
  recognizer.on("error", (message) => {
    console.error("Voice:", (message as ServerMessageError).error);
  });

  const capture = new AudioWorkletNode(audio, "tracker-voice-capture");
  capture.port.onmessage = ({ data }: MessageEvent<Float32Array>) =>
    recognizer.acceptWaveformFloat(data, audio.sampleRate);
  const source = audio.createMediaStreamSource(stream);
  source.connect(capture);

  return {
    stop: () => {
      source.disconnect();
      capture.port.onmessage = null;
      for (const track of stream.getTracks()) track.stop();
      void audio.close();
      recognizer.remove();
      client.terminate();
    },
  };
};
