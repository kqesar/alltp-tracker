import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import {
  removeVoiceModel,
  setVoiceDevice,
  shutdownVoice,
  startVoice,
  stopVoice,
  useVoiceStore,
} from "@/games/alttpr/stores/voiceStore";
import { listen, VoiceError } from "@/games/alttpr/voice/engine";

vi.mock("@/games/alttpr/voice/engine", () => {
  class VoiceError extends Error {
    constructor(readonly failure: string) {
      super(failure);
    }
  }
  return { listen: vi.fn(), VoiceError };
});

const listenMock = vi.mocked(listen);
const stop = vi.fn();
/** What the engine hands each heard text to, once listening. */
let onText: (text: string) => void = () => {};

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  useVoiceStore.setState(useVoiceStore.getInitialState(), true);
  stop.mockReset();
  listenMock.mockReset();
  listenMock.mockImplementation(async (options) => {
    options.onLoading();
    onText = options.onText;
    return { stop };
  });
});

afterEach(() => {
  shutdownVoice();
  window.history.replaceState(null, "", "/");
});

describe("voice commands", () => {
  it("listen once started, remembered on this device", async () => {
    await startVoice();
    expect(useVoiceStore.getState()).toMatchObject({
      enabled: true,
      status: "listening",
    });
    expect(listenMock).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: null }),
    );
    expect(
      JSON.parse(localStorage.getItem("alltp-tracker-voice") ?? "{}").state,
    ).toEqual({ deviceId: null, enabled: true });
  });

  it("do what they hear, and keep the last for the live region", async () => {
    await startVoice();
    onText("tracker hook shot tracker hammer");
    expect(useGameStore.getState().items).toMatchObject({
      hammer: true,
      hookshot: true,
    });
    expect(useVoiceStore.getState().heard).toMatchObject({
      changed: true,
      words: "Hammer",
    });
    // Talk without the wake word does nothing
    onText("i need the boots");
    expect(useGameStore.getState().items.boots).toBe(false);
  });

  it("stop for good on Stop, and only for now as the tracker closes", async () => {
    await startVoice();
    shutdownVoice();
    expect(stop).toHaveBeenCalledOnce();
    expect(useVoiceStore.getState()).toMatchObject({
      enabled: true,
      status: "off",
    });

    await startVoice();
    stopVoice();
    expect(useVoiceStore.getState()).toMatchObject({
      enabled: false,
      status: "off",
    });
  });

  it("say why they stopped, and do not ask again for a refused microphone", async () => {
    listenMock.mockRejectedValueOnce(new VoiceError("denied"));
    await startVoice();
    expect(useVoiceStore.getState()).toMatchObject({
      enabled: false,
      failure: "denied",
      status: "failed",
    });

    listenMock.mockRejectedValueOnce(new VoiceError("model"));
    await startVoice();
    // A model the network could not bring is tried again on the next start
    expect(useVoiceStore.getState()).toMatchObject({
      enabled: true,
      failure: "model",
    });
  });

  it("start again with the microphone picked", async () => {
    await startVoice();
    setVoiceDevice("usb-mic");
    await vi.waitFor(() => expect(listenMock).toHaveBeenCalledTimes(2));
    expect(stop).toHaveBeenCalledOnce();
    expect(listenMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ deviceId: "usb-mic" }),
    );
  });

  it("free the speech model's storage, stopping first", async () => {
    const deleted: string[] = [];
    vi.stubGlobal("indexedDB", {
      deleteDatabase: (name: string) => {
        deleted.push(name);
        const request: Partial<IDBOpenDBRequest> = {};
        queueMicrotask(() =>
          request.onsuccess?.call(request as never, {} as never),
        );
        return request;
      },
    });
    await startVoice();
    expect(await removeVoiceModel()).toBe(true);
    expect(deleted).toEqual(["/vosk"]);
    expect(stop).toHaveBeenCalledOnce();
    expect(useVoiceStore.getState().enabled).toBe(false);
    vi.unstubAllGlobals();
  });

  it("wait while another tab listens, and take over when it stops", async () => {
    let held = false;
    const waiting: (() => void)[] = [];
    vi.stubGlobal("navigator", {
      ...navigator,
      locks: {
        request: (
          _name: string,
          options: LockOptions,
          grant: (lock: Lock | null) => unknown,
        ) => {
          if (!held) {
            held = true;
            return Promise.resolve(grant({} as Lock));
          }
          if (options.ifAvailable) return Promise.resolve(grant(null));
          return new Promise((resolve) =>
            waiting.push(() => resolve(grant({} as Lock))),
          );
        },
      },
    });
    held = true; // another tab listens
    const started = startVoice();
    await vi.waitFor(() =>
      expect(useVoiceStore.getState().status).toBe("elsewhere"),
    );
    expect(listenMock).not.toHaveBeenCalled();

    waiting.shift()?.();
    await started;
    expect(useVoiceStore.getState().status).toBe("listening");
    vi.unstubAllGlobals();
  });

  it("never listen in the stream view", async () => {
    window.history.replaceState(null, "", "/?view=obs");
    await startVoice();
    expect(listenMock).not.toHaveBeenCalled();
    expect(useVoiceStore.getState().status).toBe("off");
  });
});
