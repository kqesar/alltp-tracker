import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceControl, VoiceLiveRegion } from "@/components/map/VoiceControl";
import { useGameStore } from "@/stores/gameStore";
import { shutdownVoice, useVoiceStore } from "@/stores/voiceStore";
import { listen } from "@/voice/engine";

vi.mock("@/voice/engine", () => ({ listen: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  useVoiceStore.setState(useVoiceStore.getInitialState(), true);
  vi.mocked(listen).mockResolvedValue({ stop: vi.fn() });
});

afterEach(() => {
  shutdownVoice();
  vi.useRealTimers();
});

const button = () => screen.getByTestId("voice-button");

describe("VoiceControl", () => {
  it("says whether the tracker listens, and opens the dialog", () => {
    render(<VoiceControl />);
    expect(button()).toHaveAccessibleName("Voice commands: off");
    expect(button()).toHaveTextContent("Voice");

    fireEvent.click(button());
    const dialog = screen.getByRole("dialog", { name: "Voice commands" });
    expect(within(dialog).getByTestId("voice-status")).toHaveTextContent(
      /^Off\. The first start downloads the speech model, 40 MB/,
    );
    expect(within(dialog).getByTestId("voice-start")).toHaveFocus();
  });

  it("starts listening from the dialog, and stops", async () => {
    render(<VoiceControl />);
    fireEvent.click(button());
    await act(async () => {
      fireEvent.click(screen.getByTestId("voice-start"));
    });

    expect(button()).toHaveAccessibleName("Voice commands: listening");
    expect(screen.getByTestId("voice-status")).toHaveTextContent("Listening.");
    fireEvent.click(screen.getByTestId("voice-stop"));
    expect(button()).toHaveAccessibleName("Voice commands: off");
  });

  it("shows a command it heard for a moment", () => {
    vi.useFakeTimers();
    render(<VoiceControl />);
    act(() =>
      useVoiceStore.setState({
        heard: { at: 1, changed: true, words: "Hookshot" },
        status: "listening",
      }),
    );
    expect(button()).toHaveTextContent("Hookshot");
    act(() => vi.advanceTimersByTime(3000));
    expect(button()).toHaveTextContent("Listening");

    act(() =>
      useVoiceStore.setState({
        heard: { at: 2, changed: false, words: "Hookshot" },
      }),
    );
    expect(button()).toHaveTextContent("Hookshot: no change");
  });

  it("says why it stopped, and what to do", () => {
    useVoiceStore.setState({ failure: "denied", status: "failed" });
    render(<VoiceControl />);
    expect(button()).toHaveAccessibleName("Voice commands: stopped");
    fireEvent.click(button());
    expect(screen.getByTestId("voice-status")).toHaveTextContent(
      "Stopped: The browser was refused the microphone.",
    );
  });

  it("tells what to say, with the words the model knows", () => {
    render(<VoiceControl />);
    fireEvent.click(button());
    const guide = screen.getByTestId("voice-guide");
    const row = within(guide).getByText("Bombos Medallion").closest("div");
    expect(row).toHaveTextContent("Bombos Medallionbom boss");
    expect(guide).toHaveTextContent("palace of darkness or dark palace");
    // Each find named, never two rows alike
    const labels = within(guide)
      .getAllByRole("term")
      .map((term) => term.textContent);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Silver Arrows",
        "Master Sword",
        "Sword, one level up",
      ]),
    );
    expect(guide).toHaveTextContent("undo, redo");
  });
});

describe("the voice dialog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists the microphones, and listens with the one picked", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        addEventListener: vi.fn(),
        enumerateDevices: vi.fn().mockResolvedValue([
          { deviceId: "default", kind: "audioinput", label: "Default" },
          { deviceId: "usb", kind: "audioinput", label: "USB microphone" },
          { deviceId: "cam", kind: "videoinput", label: "Camera" },
          { deviceId: "other", kind: "audioinput", label: "" },
        ]),
        removeEventListener: vi.fn(),
      },
    });
    render(<VoiceControl />);
    fireEvent.click(button());
    const select = await screen.findByRole("combobox", { name: "Microphone" });
    await vi.waitFor(() =>
      expect(
        within(select)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["The system's default", "USB microphone", "Microphone 2"]),
    );

    fireEvent.change(select, { target: { value: "usb" } });
    expect(useVoiceStore.getState().deviceId).toBe("usb");
    fireEvent.change(select, { target: { value: "" } });
    expect(useVoiceStore.getState().deviceId).toBeNull();
  });

  it("frees the speech model's storage, or says why it could not", async () => {
    const outcomes = ["onsuccess", "onblocked"];
    vi.stubGlobal("indexedDB", {
      deleteDatabase: () => {
        const request: Record<string, (() => void) | undefined> = {};
        const outcome = outcomes.shift() ?? "onerror";
        queueMicrotask(() => request[outcome]?.());
        return request;
      },
    });
    render(<VoiceControl />);
    fireEvent.click(button());
    const remove = screen.getByTestId("voice-remove-model");
    const status = screen.getByTestId("voice-remove-status");

    await act(async () => fireEvent.click(remove));
    expect(status).toHaveTextContent("Removed: about 60 MB freed.");
    await act(async () => fireEvent.click(remove));
    expect(status).toHaveTextContent("It could not be removed");
  });
});

describe("VoiceLiveRegion", () => {
  it("says each command as it is heard", () => {
    render(<VoiceLiveRegion />);
    const live = screen.getByTestId("voice-live");
    expect(live).toHaveTextContent("");
    act(() =>
      useVoiceStore.setState({
        heard: { at: 1, changed: true, words: "Hookshot" },
      }),
    );
    expect(live).toHaveTextContent("Voice: Hookshot");
    act(() =>
      useVoiceStore.setState({
        heard: { at: 2, changed: false, words: "Undo" },
      }),
    );
    expect(live).toHaveTextContent("Voice: Undo, nothing to change");
  });
});
