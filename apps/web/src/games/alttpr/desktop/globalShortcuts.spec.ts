import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Mechanism,
  Report,
} from "@/games/alttpr/desktop/globalShortcutsStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { useKeyboardLayoutStore } from "@/games/alttpr/stores/keyboardLayoutStore";
import { chordText, keyLabel } from "@/games/alttpr/utils/keyLabels";

const tauri = vi.hoisted(() => ({
  handlers: new Map<string, (event: { payload: unknown }) => void>(),
  invoke: vi.fn(),
  listen: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: tauri.listen }));

const { useGlobalShortcutsStore, DEFAULT_GLOBAL } = await import(
  "@/games/alttpr/desktop/globalShortcutsStore"
);
const {
  APPLY_DELAY_MS,
  loadSystemKeyLabels,
  openDesktopSettings,
  runGlobalStep,
  startGlobalShortcuts,
  stopGlobalShortcuts,
  syncGlobalShortcuts,
  syncIfChanged,
  wantedBindings,
} = await import("@/games/alttpr/desktop/globalShortcuts");

const mechanism = (kind: Mechanism["kind"], more: Partial<Mechanism> = {}) =>
  ({
    command: "/opt/alltp-tracker",
    configurable: false,
    kind,
    os: "linux",
    portalVersion: kind === "portal" ? 2 : null,
    reason: null,
    session: kind === "portal" ? "wayland" : "x11",
    ...more,
  }) satisfies Mechanism;

const reportOf = (m: Mechanism): Report => ({
  bindings: [],
  mechanism: m,
  state: "idle",
});

/** The calls to `global_shortcuts_apply`, with their arguments. */
const applies = () =>
  tauri.invoke.mock.calls
    .filter(([command]) => command === "global_shortcuts_apply")
    .map(([, args]) => args as { bindings: unknown[]; rebind: boolean });

/** Answer the app's commands: ready with this mechanism, and apply. */
const answer = (m: Mechanism, pending: string[] = []) => {
  tauri.invoke.mockImplementation((command: string) => {
    if (command === "global_shortcuts_ready") {
      return Promise.resolve({ mechanism: m, pending });
    }
    if (command === "global_shortcuts_apply") {
      return Promise.resolve(reportOf(m));
    }
    return Promise.resolve(undefined);
  });
};

const started = async (m: Mechanism, pending: string[] = []) => {
  answer(m, pending);
  await startGlobalShortcuts();
  tauri.invoke.mockClear();
};

const press = (action: string) =>
  tauri.handlers.get("global-step")?.({ payload: { action } });

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  tauri.handlers.clear();
  tauri.invoke.mockReset();
  tauri.listen.mockReset();
  tauri.listen.mockImplementation(
    (name: string, handler: (event: { payload: unknown }) => void) => {
      tauri.handlers.set(name, handler);
      return Promise.resolve(() => {});
    },
  );
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGlobalShortcutsStore.setState(
    {
      ...DEFAULT_GLOBAL,
      capturing: false,
      declined: false,
      failure: null,
      mechanism: null,
      report: null,
      settingsError: null,
    },
    false,
  );
});

afterEach(() => {
  stopGlobalShortcuts();
  vi.useRealTimers();
});

describe("a global key press", () => {
  it("steps its control as a click does, as one undo step", () => {
    expect(useGameStore.getState().items.hookshot).toBe(false);
    runGlobalStep("advance:hookshot");
    expect(useGameStore.getState().items.hookshot).toBe(true);
    expect(useGameStore.getState().past).toHaveLength(1);
    runGlobalStep("back:hookshot");
    expect(useGameStore.getState().items.hookshot).toBe(false);
  });

  it("ignores an action the tracker does not know", () => {
    const before = useGameStore.getState().items;
    runGlobalStep("advance:nothing");
    runGlobalStep("rm -rf");
    expect(useGameStore.getState().items).toBe(before);
    expect(useGameStore.getState().past).toHaveLength(0);
  });

  it("leaves a key cell alone while the board does not show it", () => {
    useGameStore.setState({ bigKeysVisible: false });
    runGlobalStep("advance:smallkey3");
    expect(useGameStore.getState().smallKeys[3]).toBe(0);
    useGameStore.setState({ bigKeysVisible: true });
    runGlobalStep("advance:smallkey3");
    expect(useGameStore.getState().smallKeys[3]).toBe(1);
  });

  it("runs even when the window's own shortcuts are off", () => {
    useGameStore.getState().setShortcutsEnabled(false);
    runGlobalStep("advance:hookshot");
    expect(useGameStore.getState().items.hookshot).toBe(true);
  });
});

describe("starting", () => {
  it("steps on the app's events, learns the mechanism and runs the steps that waited, in order", async () => {
    answer(mechanism("hotkeys"), ["advance:hookshot", "advance:bow"]);
    await startGlobalShortcuts();

    expect(useGlobalShortcutsStore.getState().mechanism?.kind).toBe("hotkeys");
    expect(useGameStore.getState().items.hookshot).toBe(true);
    expect(useGameStore.getState().items.bow).toBe(1);
    const stepsDone = useGameStore.getState().past.length;
    expect(stepsDone).toBe(2);

    press("advance:boomerang");
    expect(useGameStore.getState().past).toHaveLength(3);
  });

  it("asks the app for its keys once, with none bound at first", async () => {
    answer(mechanism("hotkeys"));
    await startGlobalShortcuts();
    expect(applies()).toEqual([{ bindings: [], rebind: false }]);
  });

  it("registers the saved keys when the switch was on", async () => {
    useGlobalShortcutsStore.setState({
      enabled: true,
      keymap: { "advance:hookshot": "Control+Alt+Shift+KeyH" },
    });
    answer(mechanism("hotkeys"));
    await startGlobalShortcuts();
    expect(applies()).toEqual([
      {
        bindings: [
          {
            action: "advance:hookshot",
            chord: "Control+Alt+Shift+KeyH",
            description: "Hookshot forward",
          },
        ],
        rebind: false,
      },
    ]);
  });

  it("shows a change the player made in the desktop's settings", async () => {
    const m = mechanism("portal");
    tauri.invoke.mockImplementation((command: string) =>
      Promise.resolve(
        command === "global_shortcuts_ready"
          ? { mechanism: m, pending: [] }
          : {
              ...reportOf(m),
              bindings: [
                {
                  action: "advance:hookshot",
                  message: null,
                  status: "active",
                  trigger: "Ctrl+Alt+H",
                },
              ],
            },
      ),
    );
    await startGlobalShortcuts();
    tauri.handlers.get("global-shortcuts-changed")?.({
      payload: {
        bindings: [{ action: "advance:hookshot", trigger: "Ctrl+Alt+J" }],
      },
    });
    expect(useGlobalShortcutsStore.getState().report?.bindings[0].trigger).toBe(
      "Ctrl+Alt+J",
    );
  });
});

describe("with the system's own hotkeys", () => {
  const bindHookshot = () =>
    useGlobalShortcutsStore.setState({
      enabled: true,
      keymap: { "advance:hookshot": "Control+Alt+Shift+KeyH" },
    });

  it("registers a change once, after a short pause", async () => {
    await started(mechanism("hotkeys"));
    bindHookshot();
    useGlobalShortcutsStore.setState({
      keymap: {
        "advance:bow": "Control+Alt+Shift+KeyB",
        "advance:hookshot": "Control+Alt+Shift+KeyH",
      },
    });
    await vi.advanceTimersByTimeAsync(APPLY_DELAY_MS - 1);
    expect(applies()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(applies()).toHaveLength(1);
    expect(applies()[0].bindings).toHaveLength(2);
    expect(applies()[0].rebind).toBe(false);
  });

  it("applies as the player edits, so closing the dialog sends nothing more", async () => {
    await started(mechanism("hotkeys"));
    bindHookshot();
    await vi.advanceTimersByTimeAsync(APPLY_DELAY_MS);
    tauri.invoke.mockClear();

    bindHookshot();
    useGlobalShortcutsStore.setState({
      keymap: { "advance:hookshot": "Control+Alt+Shift+KeyJ" },
    });
    syncIfChanged();
    await vi.advanceTimersByTimeAsync(0);
    expect(applies()).toHaveLength(0);
  });

  it("releases everything when the switch goes off", async () => {
    await started(mechanism("hotkeys"));
    bindHookshot();
    await vi.advanceTimersByTimeAsync(APPLY_DELAY_MS);
    tauri.invoke.mockClear();

    useGlobalShortcutsStore.setState({ enabled: false });
    await vi.advanceTimersByTimeAsync(APPLY_DELAY_MS);
    expect(applies()).toEqual([{ bindings: [], rebind: false }]);
  });

  it("holds no key while one is being captured, so the key pressed is not eaten", async () => {
    await started(mechanism("hotkeys"));
    bindHookshot();
    await vi.advanceTimersByTimeAsync(APPLY_DELAY_MS);
    tauri.invoke.mockClear();

    useGlobalShortcutsStore.setState({ capturing: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(applies()).toEqual([{ bindings: [], rebind: false }]);

    tauri.invoke.mockClear();
    useGlobalShortcutsStore.setState({ capturing: false });
    await vi.advanceTimersByTimeAsync(APPLY_DELAY_MS);
    expect(applies()).toHaveLength(1);
    expect(applies()[0].bindings).toHaveLength(1);
  });

  it("leaves unknown actions out of what it asks for", () => {
    useGlobalShortcutsStore.setState({
      enabled: true,
      keymap: {
        "advance:hookshot": "Control+Alt+KeyH",
        "advance:nothing": "Control+Alt+KeyJ",
      } as never,
      mechanism: mechanism("hotkeys"),
    });
    expect(wantedBindings().map((binding) => binding.action)).toEqual([
      "advance:hookshot",
    ]);
  });
});

describe("with the desktop's portal", () => {
  const bindHookshot = () =>
    useGlobalShortcutsStore.setState({
      enabled: true,
      keymap: { "advance:hookshot": "Control+Alt+Shift+KeyH" },
    });

  it("does not ask the desktop at each change, only when the player is done", async () => {
    await started(mechanism("portal"));
    bindHookshot();
    useGlobalShortcutsStore.setState({
      keymap: { "advance:hookshot": "Control+Alt+Shift+KeyJ" },
    });
    await vi.advanceTimersByTimeAsync(APPLY_DELAY_MS * 5);
    expect(applies()).toHaveLength(0);

    syncIfChanged();
    await vi.advanceTimersByTimeAsync(0);
    expect(applies()).toHaveLength(1);
    expect(applies()[0].bindings).toHaveLength(1);

    // Nothing changed since: closing again asks nothing
    syncIfChanged();
    await vi.advanceTimersByTimeAsync(0);
    expect(applies()).toHaveLength(1);
  });

  it("takes the keys back at once when the switch goes off", async () => {
    await started(mechanism("portal"));
    bindHookshot();
    syncIfChanged();
    await vi.advanceTimersByTimeAsync(0);
    tauri.invoke.mockClear();

    useGlobalShortcutsStore.setState({ enabled: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(applies()).toEqual([{ bindings: [], rebind: false }]);
  });

  it("asks for a new session when told to ask again", async () => {
    await started(mechanism("portal"));
    bindHookshot();
    await syncGlobalShortcuts(true);
    expect(applies()).toEqual([
      {
        bindings: [expect.objectContaining({ action: "advance:hookshot" })],
        rebind: true,
      },
    ]);
  });

  it("says the desktop is deciding while it waits", async () => {
    await started(mechanism("portal"));
    bindHookshot();
    let answerApply: (report: Report) => void = () => {};
    tauri.invoke.mockImplementation(
      () =>
        new Promise<Report>((resolve) => {
          answerApply = resolve;
        }),
    );
    const done = syncGlobalShortcuts();
    expect(useGlobalShortcutsStore.getState().pending).toBe(true);
    answerApply(reportOf(mechanism("portal")));
    await done;
    expect(useGlobalShortcutsStore.getState().pending).toBe(false);
  });

  it("opens the desktop's shortcut settings, and keeps the reason it could not", async () => {
    await started(mechanism("portal"));
    await openDesktopSettings();
    expect(tauri.invoke).toHaveBeenCalledWith("global_shortcuts_configure");

    tauri.invoke.mockRejectedValueOnce("no session");
    await openDesktopSettings();
    expect(useGlobalShortcutsStore.getState().settingsError).toBe("no session");
    expect(useGlobalShortcutsStore.getState().failure).toBeNull();
  });

  it("remembers a refusal and does not ask the desktop again by itself", async () => {
    answer(mechanism("portal"));
    await startGlobalShortcuts();
    bindHookshot();
    tauri.invoke.mockResolvedValue({
      ...reportOf(mechanism("portal")),
      state: "refused",
    });
    await syncGlobalShortcuts();
    expect(useGlobalShortcutsStore.getState().declined).toBe(true);
    tauri.invoke.mockClear();

    // Closing the dialog, the next launch's start-up sync: nothing is asked
    syncIfChanged();
    await syncGlobalShortcuts();
    await vi.advanceTimersByTimeAsync(APPLY_DELAY_MS * 3);
    expect(applies()).toHaveLength(0);

    // The player's own Ask again does
    answer(mechanism("portal"));
    await syncGlobalShortcuts(true);
    expect(applies()).toHaveLength(1);
    expect(useGlobalShortcutsStore.getState().declined).toBe(false);
  });

  it("does not ask at the next launch when the saved state says declined", async () => {
    useGlobalShortcutsStore.setState({
      declined: true,
      enabled: true,
      keymap: { "advance:hookshot": "Control+Alt+Shift+KeyH" },
    });
    answer(mechanism("portal"));
    await startGlobalShortcuts();
    expect(applies()).toHaveLength(0);
  });

  it("forgets a refusal when the switch is turned off and on again", () => {
    useGlobalShortcutsStore.setState({ declined: true, enabled: true });
    useGlobalShortcutsStore.getState().setGlobalEnabled(false);
    expect(useGlobalShortcutsStore.getState().declined).toBe(false);
  });
});

describe("with the command line", () => {
  it("registers nothing, whatever the keymap holds", async () => {
    useGlobalShortcutsStore.setState({
      enabled: true,
      keymap: { "advance:hookshot": "Control+Alt+Shift+KeyH" },
    });
    answer(mechanism("command"));
    await startGlobalShortcuts();
    expect(applies()).toEqual([{ bindings: [], rebind: false }]);

    useGlobalShortcutsStore.setState({
      keymap: { "advance:bow": "Control+Alt+Shift+KeyB" },
    });
    await vi.advanceTimersByTimeAsync(APPLY_DELAY_MS * 3);
    expect(applies()).toHaveLength(1);
  });
});

describe("when the app fails", () => {
  it("keeps the reason for the Global tab instead of throwing", async () => {
    await started(mechanism("hotkeys"));
    tauri.invoke.mockRejectedValue("the main thread is gone");
    await syncGlobalShortcuts();
    expect(useGlobalShortcutsStore.getState().failure).toBe(
      "the main thread is gone",
    );
    expect(useGlobalShortcutsStore.getState().pending).toBe(false);
  });

  it("forgets the failure once the app answers again", async () => {
    await started(mechanism("hotkeys"));
    tauri.invoke.mockRejectedValueOnce("busy");
    await syncGlobalShortcuts();
    answer(mechanism("hotkeys"));
    await syncGlobalShortcuts();
    expect(useGlobalShortcutsStore.getState().failure).toBeNull();
  });
});

describe("the key labels of a Linux layout", () => {
  const layoutOf = () => useKeyboardLayoutStore.getState().layout;

  beforeEach(() => {
    useKeyboardLayoutStore.setState({ layout: null });
  });

  it("show what AZERTY prints on the physical Q key", async () => {
    tauri.invoke.mockImplementation((command: string) =>
      Promise.resolve(
        command === "key_labels"
          ? { KeyA: "q", KeyQ: "a", Semicolon: "m" }
          : command === "global_shortcuts_ready"
            ? { mechanism: mechanism("hotkeys"), pending: [] }
            : reportOf(mechanism("hotkeys")),
      ),
    );
    await startGlobalShortcuts();
    await vi.waitFor(() => expect(layoutOf()).not.toBeNull());

    expect(layoutOf()?.get("KeyQ")).toBe("a");
    expect(keyLabel("KeyQ", layoutOf())).toBe("A");
    expect(chordText("Control+Alt+Shift+KeyQ", layoutOf())).toBe(
      "Ctrl+Alt+Shift+A",
    );
  });

  it("stay the fallback where the webview reads the layout itself, as on macOS and Windows", async () => {
    answer(mechanism("hotkeys"));
    tauri.invoke.mockImplementation((command: string) =>
      Promise.resolve(
        command === "key_labels"
          ? {}
          : command === "global_shortcuts_ready"
            ? { mechanism: mechanism("hotkeys"), pending: [] }
            : reportOf(mechanism("hotkeys")),
      ),
    );
    await startGlobalShortcuts();
    await loadSystemKeyLabels();
    expect(layoutOf()).toBeNull();
  });

  it("stay the fallback when the app cannot say", async () => {
    tauri.invoke.mockRejectedValue("no display");
    await loadSystemKeyLabels();
    expect(layoutOf()).toBeNull();
  });
});

describe("what is saved", () => {
  it("keeps the player's keys under their own key, and drops what the app said", async () => {
    useGlobalShortcutsStore.setState({
      enabled: true,
      failure: "x",
      keymap: { "advance:hookshot": "Control+Alt+KeyH" },
      mechanism: mechanism("hotkeys"),
    });
    const saved = JSON.parse(
      localStorage.getItem("alltp-tracker-global-shortcuts") ?? "{}",
    );
    expect(saved.state).toEqual({
      declined: false,
      enabled: true,
      keymap: { "advance:hookshot": "Control+Alt+KeyH" },
    });
    expect(localStorage.getItem("alltp-tracker-state")).not.toContain(
      "Control+Alt+KeyH",
    );
  });

  it("keeps a refusal across a restart", async () => {
    useGlobalShortcutsStore.setState({ declined: true });
    await useGlobalShortcutsStore.persist.rehydrate();
    expect(useGlobalShortcutsStore.getState().declined).toBe(true);
  });

  it("restores leniently: an unknown action or a malformed chord is dropped", async () => {
    localStorage.setItem(
      "alltp-tracker-global-shortcuts",
      JSON.stringify({
        state: {
          enabled: true,
          keymap: {
            "advance:bow": "Control+Alt+KeyB",
            "advance:nothing": "Control+Alt+KeyN",
            "back:bow": "not a chord",
          },
        },
        version: 1,
      }),
    );
    await useGlobalShortcutsStore.persist.rehydrate();
    expect(useGlobalShortcutsStore.getState().enabled).toBe(true);
    expect(useGlobalShortcutsStore.getState().keymap).toEqual({
      "advance:bow": "Control+Alt+KeyB",
    });
  });

  it("starts off, with no key", () => {
    expect(DEFAULT_GLOBAL).toEqual({ enabled: false, keymap: {} });
  });
});
