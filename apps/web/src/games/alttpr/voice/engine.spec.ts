import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GRAMMAR } from "@/games/alttpr/logic/voice";
import { listen, VoiceError } from "@/games/alttpr/voice/engine";

/** What the fake Vosk client does: load, or fail to. */
const vosk = vi.hoisted(() => ({
  fail: false,
  recognizers: [] as {
    grammar: string;
    sampleRate: number;
    acceptWaveformFloat: ReturnType<typeof import("vitest").vi.fn>;
    listeners: Record<string, (message: unknown) => void>;
    remove: ReturnType<typeof import("vitest").vi.fn>;
  }[],
  terminate: [] as unknown[],
}));

vi.mock("@lichess-org/vosk-browser", () => ({
  VoskClient: class {
    private readonly listeners: Record<string, (message: unknown) => void> = {};
    constructor() {
      queueMicrotask(() =>
        vosk.fail
          ? this.listeners.error?.({ error: "404", event: "error" })
          : this.listeners.load?.({ event: "load", result: true }),
      );
    }
    on(event: string, listener: (message: unknown) => void) {
      this.listeners[event] = listener;
    }
    terminate() {
      vosk.terminate.push(this);
    }
    get KaldiRecognizer() {
      return class {
        listeners: Record<string, (message: unknown) => void> = {};
        acceptWaveformFloat = vi.fn();
        remove = vi.fn();
        constructor(
          readonly sampleRate: number,
          readonly grammar: string,
        ) {
          vosk.recognizers.push(this as never);
        }
        on(event: string, listener: (message: unknown) => void) {
          this.listeners[event] = listener;
        }
      };
    }
  },
}));
vi.mock("@lichess-org/vosk-browser/dist/vosk.wasm?url", () => ({
  default: "/vosk.wasm",
}));
vi.mock("@lichess-org/vosk-browser/dist/vosk.worker.js?url", () => ({
  default: "/vosk.worker.js",
}));

const track = { stop: vi.fn() };
const getUserMedia = vi.fn();
/** The audio graph the engine builds, for the test to drive. */
const audio = {
  capture: null as {
    port: { onmessage: ((e: unknown) => void) | null };
  } | null,
  closed: false,
  disconnected: false,
};

beforeEach(() => {
  vosk.fail = false;
  vosk.recognizers = [];
  vosk.terminate = [];
  track.stop.mockReset();
  getUserMedia.mockReset();
  getUserMedia.mockResolvedValue({ getTracks: () => [track] });
  audio.capture = null;
  audio.closed = false;
  audio.disconnected = false;
  vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia } });
  vi.stubGlobal(
    "AudioContext",
    class {
      sampleRate = 48_000;
      audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
      createMediaStreamSource() {
        return {
          connect: vi.fn(),
          disconnect: () => {
            audio.disconnected = true;
          },
        };
      }
      close() {
        audio.closed = true;
        return Promise.resolve();
      }
    },
  );
  vi.stubGlobal(
    "AudioWorkletNode",
    class {
      port = { onmessage: null };
      constructor() {
        audio.capture = this;
      }
    },
  );
  vi.stubGlobal("URL", Object.assign(URL, { revokeObjectURL: vi.fn() }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const options = () => ({
  deviceId: null,
  onLoading: vi.fn(),
  onText: vi.fn(),
});

describe("listen", () => {
  it("hears with the grammar, at the microphone's own rate", async () => {
    const given = options();
    const session = await listen(given);

    expect(given.onLoading).toHaveBeenCalledOnce();
    const [recognizer] = vosk.recognizers;
    expect(recognizer?.sampleRate).toBe(48_000);
    expect(JSON.parse(recognizer?.grammar ?? "[]")).toEqual(GRAMMAR);

    // A chunk of the microphone goes to the recognizer, a result comes back
    const chunk = new Float32Array(4096);
    audio.capture?.port.onmessage?.({ data: chunk });
    expect(recognizer?.acceptWaveformFloat).toHaveBeenCalledWith(chunk, 48_000);
    recognizer?.listeners.result?.({ result: { text: "tracker hammer" } });
    recognizer?.listeners.result?.({ result: { text: "" } });
    expect(given.onText).toHaveBeenCalledExactlyOnceWith("tracker hammer");

    session.stop();
    expect(track.stop).toHaveBeenCalled();
    expect(audio).toMatchObject({ closed: true, disconnected: true });
    expect(recognizer?.remove).toHaveBeenCalled();
    expect(vosk.terminate).toHaveLength(1);
  });

  it("opens the microphone picked", async () => {
    await listen({ ...options(), deviceId: "usb-mic" });
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({ deviceId: { exact: "usb-mic" } }),
    });
  });

  it.each([
    ["NotAllowedError", "denied"],
    ["SecurityError", "denied"],
    ["NotFoundError", "no-microphone"],
    ["OverconstrainedError", "no-microphone"],
  ])("says a %s is %s", async (name, failure) => {
    getUserMedia.mockRejectedValue(new DOMException("", name));
    await expect(listen(options())).rejects.toEqual(
      new VoiceError(failure as never),
    );
  });

  it("says the model failed, and lets the microphone go", async () => {
    vosk.fail = true;
    await expect(listen(options())).rejects.toMatchObject({ failure: "model" });
    expect(track.stop).toHaveBeenCalled();
    expect(vosk.terminate).toHaveLength(1);
  });
});
