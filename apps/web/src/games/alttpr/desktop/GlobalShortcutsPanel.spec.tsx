import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BindingReport,
  Mechanism,
  Report,
} from "@/games/alttpr/desktop/globalShortcutsStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const tauri = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: tauri.listen }));

const {
  default: GlobalShortcutsPanel,
  commandFor,
  statusText,
} = await import("@/games/alttpr/desktop/GlobalShortcutsPanel");
const { DEFAULT_GLOBAL, useGlobalShortcutsStore } = await import(
  "@/games/alttpr/desktop/globalShortcutsStore"
);

const mechanism = (
  kind: Mechanism["kind"],
  more: Partial<Mechanism> = {},
): Mechanism => ({
  command: "/opt/ALLTP Tracker/alltp-tracker",
  configurable: false,
  kind,
  os: "linux",
  portalVersion: kind === "portal" ? 2 : null,
  reason: null,
  session: kind === "portal" ? "wayland" : "x11",
  ...more,
});

const binding = (
  action: string,
  status: BindingReport["status"],
  more: Partial<BindingReport> = {},
): BindingReport => ({
  action,
  message: null,
  status,
  trigger: null,
  ...more,
});

const report = (
  m: Mechanism,
  state: Report["state"],
  bindings: BindingReport[] = [],
): Report => ({ bindings, mechanism: m, state });

const show = (
  m: Mechanism,
  more: Partial<ReturnType<typeof useGlobalShortcutsStore.getState>> = {},
) => {
  act(() => useGlobalShortcutsStore.setState({ mechanism: m, ...more }));
  const onStatus = vi.fn();
  const view = render(<GlobalShortcutsPanel onStatus={onStatus} />);
  return { onStatus, ...view };
};

const status = () => screen.getByTestId("global-shortcuts-status");

beforeEach(() => {
  localStorage.clear();
  tauri.invoke.mockReset();
  tauri.invoke.mockResolvedValue(undefined);
  tauri.listen.mockReset();
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGlobalShortcutsStore.setState(
    {
      ...DEFAULT_GLOBAL,
      capturing: false,
      failure: null,
      mechanism: null,
      pending: false,
      report: null,
    },
    false,
  );
});

describe("the Global tab", () => {
  it("starts with the switch off and says what the system does", () => {
    show(mechanism("hotkeys", { os: "windows", session: null }));
    expect(screen.getByTestId("global-shortcuts-enabled")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(status()).toHaveTextContent(
      "Global shortcuts work in every app, the emulator included.",
    );
    expect(status()).not.toHaveTextContent("X11");
  });

  it("turns on, announced in the dialog's status line, and shows the hint while nothing is bound", async () => {
    const { onStatus } = show(mechanism("hotkeys"));
    expect(screen.queryByTestId("global-shortcuts-hint")).toBeNull();

    await userEvent.click(screen.getByTestId("global-shortcuts-enabled"));

    expect(useGlobalShortcutsStore.getState().enabled).toBe(true);
    expect(onStatus).toHaveBeenCalledWith("Global shortcuts on.");
    expect(screen.getByTestId("global-shortcuts-hint")).toHaveTextContent(
      "Pick a key for each control you want to reach from the emulator.",
    );
  });

  it("names X11 on a Linux session of it", () => {
    show(mechanism("hotkeys"));
    expect(status()).toHaveTextContent(
      /pick combinations no other app uses \(X11\)\.$/,
    );
  });

  it("waits for the app to say what it can do", () => {
    render(<GlobalShortcutsPanel onStatus={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Looking for/);
    expect(screen.queryByTestId("global-shortcuts-enabled")).toBeNull();
  });
});

describe("what it says of each mechanism and state", () => {
  const portal = mechanism("portal", { configurable: true });
  const active = [
    binding("advance:hookshot", "active", { trigger: "Ctrl+Alt+H" }),
    binding("advance:bow", "unbound"),
  ];

  it.each([
    [
      "the portal before anything is sent",
      () => statusText(portal, null, false, null),
      "Your desktop manages global shortcuts. When you close this dialog, it asks you to approve the keys below.",
    ],
    [
      "the portal while the desktop decides",
      () => statusText(portal, null, true, null),
      "Waiting for your desktop's approval…",
    ],
    [
      "a partly approved portal set",
      () => statusText(portal, report(portal, "partial", active), false, null),
      "Your desktop approved 1 of 2 shortcuts. It shows the keys it chose; change them in its settings.",
    ],
    [
      "a declined portal",
      () => statusText(portal, report(portal, "refused"), false, null),
      "Your desktop's approval was declined.",
    ],
    [
      "a portal that failed",
      () =>
        statusText(
          portal,
          report(portal, "unavailable", [
            binding("advance:bow", "unbound", { message: "D-Bus said no" }),
          ]),
          false,
          null,
        ),
      "Your desktop could not register global shortcuts (D-Bus said no). Bind keys in its settings to the commands below instead.",
    ],
    [
      "a portal that gave way to the command line",
      () =>
        statusText(
          mechanism("command", { reason: "An app id is required" }),
          null,
          false,
          null,
        ),
      "Your desktop could not register global shortcuts (An app id is required). Bind keys in its settings to the commands below instead.",
    ],
    [
      "the command line",
      () => statusText(mechanism("command"), null, false, null),
      "Your desktop has no global shortcut service the tracker can use. Bind keys in your window manager to commands like these:",
    ],
    [
      "an app that failed to answer",
      () => statusText(mechanism("hotkeys"), null, false, "channel closed"),
      "The app could not register global shortcuts (channel closed). Bind keys in your window manager to the commands below instead.",
    ],
  ])("%s", (_name, text, expected) => {
    expect(text()).toBe(expected);
  });

  it("offers Ask again after a refusal, as a new session", async () => {
    show(portal, { enabled: true, report: report(portal, "refused") });
    tauri.invoke.mockResolvedValue(report(portal, "idle"));

    await userEvent.click(screen.getByTestId("global-shortcuts-again"));

    expect(tauri.invoke).toHaveBeenCalledWith("global_shortcuts_apply", {
      bindings: [],
      rebind: true,
    });
    expect(screen.getByTestId("global-shortcuts-status")).toBeInTheDocument();
  });

  it("offers the desktop's settings only where the portal can open them", async () => {
    const approved = report(portal, "active", active.slice(0, 1));
    const { unmount } = show(portal, { enabled: true, report: approved });
    await userEvent.click(screen.getByTestId("global-shortcuts-settings"));
    expect(tauri.invoke).toHaveBeenCalledWith("global_shortcuts_configure");
    unmount();

    const old = mechanism("portal", { configurable: false, portalVersion: 1 });
    show(old, {
      enabled: true,
      report: report(old, "active", active.slice(0, 1)),
    });
    expect(screen.queryByTestId("global-shortcuts-settings")).toBeNull();
  });

  it("offers Ask again and the settings in no other state", () => {
    show(portal, {
      enabled: true,
      report: report(portal, "active", active.slice(0, 1)),
    });
    expect(screen.queryByTestId("global-shortcuts-again")).toBeNull();
  });

  it("sends the bindings to the desktop on request", async () => {
    show(portal, {
      enabled: true,
      keymap: { "advance:hookshot": "Control+Alt+Shift+KeyH" },
    });
    tauri.invoke.mockResolvedValue(report(portal, "active"));
    await userEvent.click(screen.getByTestId("global-shortcuts-send"));
    expect(tauri.invoke).toHaveBeenCalledWith("global_shortcuts_apply", {
      bindings: [
        {
          action: "advance:hookshot",
          chord: "Control+Alt+Shift+KeyH",
          description: "Hookshot forward",
        },
      ],
      rebind: false,
    });
  });
});

describe("what it says of each key", () => {
  it("marks a key another app holds, in words and a glyph", () => {
    const m = mechanism("hotkeys");
    show(m, {
      enabled: true,
      keymap: { "advance:hookshot": "Control+Alt+Shift+KeyJ" },
      report: report(m, "unavailable", [binding("advance:hookshot", "taken")]),
    });
    const note = screen.getByTestId("shortcut-note-advance-hookshot");
    expect(note).toHaveTextContent("In use by another app or the system");
    expect(note).toHaveTextContent("⚠");
  });

  it("shows the key the desktop chose beside the player's", () => {
    const m = mechanism("portal");
    show(m, {
      enabled: true,
      keymap: { "advance:hookshot": "Control+Alt+Shift+KeyH" },
      report: report(m, "active", [
        binding("advance:hookshot", "active", { trigger: "Meta+H" }),
      ]),
    });
    expect(
      screen.getByTestId("shortcut-note-advance-hookshot"),
    ).toHaveTextContent("Desktop: Meta+H");
  });

  it("says a key the desktop did not approve is not approved", () => {
    const m = mechanism("portal");
    show(m, {
      enabled: true,
      keymap: { "advance:hookshot": "Control+Alt+Shift+KeyH" },
      report: report(m, "partial", [binding("advance:hookshot", "unbound")]),
    });
    expect(
      screen.getByTestId("shortcut-note-advance-hookshot"),
    ).toHaveTextContent("Not approved");
  });

  it("says nothing under a key that has none", () => {
    show(mechanism("hotkeys"), { enabled: true });
    expect(screen.queryByTestId(/^shortcut-note-/)).toBeNull();
  });
});

describe("the command line", () => {
  const command = mechanism("command");

  it("shows an example with the real executable", () => {
    show(command);
    expect(screen.getByTestId("global-command-example")).toHaveTextContent(
      'bindsym Ctrl+Alt+h exec "/opt/ALLTP Tracker/alltp-tracker" --step advance:hookshot',
    );
  });

  it("copies the command of an action", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const { onStatus } = show(command);

    await userEvent.click(screen.getByTestId("shortcut-copy-back-chest3"));

    const expected = '"/opt/ALLTP Tracker/alltp-tracker" --step back:chest3';
    expect(writeText).toHaveBeenCalledWith(expected);
    await vi.waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(`Copied: ${expected}`),
    );
    vi.unstubAllGlobals();
  });

  it("names each copy button for the action it copies", () => {
    show(command);
    expect(
      screen.getByTestId("shortcut-copy-advance-hookshot"),
    ).toHaveAccessibleName("Copy command for Hookshot forward");
  });

  it("has no switch: there is nothing to register, so it would do nothing", () => {
    show(command);
    expect(screen.queryByTestId("global-shortcuts-enabled")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("is not shown under the system's own hotkeys", () => {
    show(mechanism("hotkeys"));
    expect(screen.queryByTestId("global-command-example")).toBeNull();
    expect(screen.queryByTestId("shortcut-copy-advance-hookshot")).toBeNull();
  });

  it("builds the command that steps an action", () => {
    expect(commandFor(command, "advance:hookshot")).toBe(
      '"/opt/ALLTP Tracker/alltp-tracker" --step advance:hookshot',
    );
  });
});

describe("capturing a global key", () => {
  const capture = async (testId: string) => {
    const user = userEvent.setup();
    act(() => screen.getByTestId(testId).focus());
    await user.keyboard("{Enter}");
    return user;
  };

  it("refuses a key that would stop the player typing it everywhere, and says why", async () => {
    const { onStatus } = show(mechanism("hotkeys"), { enabled: true });
    const user = await capture("shortcut-advance-hookshot");

    await user.keyboard("{Shift>}q{/Shift}");

    expect(onStatus).toHaveBeenLastCalledWith(
      "Shift+Q would stop you typing it in every app. Add a second modifier, e.g. Ctrl+Alt+Shift.",
    );
    expect(useGlobalShortcutsStore.getState().keymap).toEqual({});
  });

  it("takes a chord with two modifiers", async () => {
    show(mechanism("hotkeys"), { enabled: true });
    const user = await capture("shortcut-advance-hookshot");

    await user.keyboard("{Control>}{Alt>}{Shift>}h{/Shift}{/Alt}{/Control}");

    expect(useGlobalShortcutsStore.getState().keymap).toEqual({
      "advance:hookshot": "Control+Alt+Shift+KeyH",
    });
  });

  it("says why a chord the tracker window uses is refused, and by whom", async () => {
    useGameStore.getState().setKeymap({ "advance:bow": "Alt+Shift+KeyH" });
    const { onStatus } = show(mechanism("hotkeys"), { enabled: true });
    const user = await capture("shortcut-advance-hookshot");

    await user.keyboard("{Alt>}{Shift>}h{/Shift}{/Alt}");

    expect(onStatus).toHaveBeenLastCalledWith(
      "Alt+Shift+H already steps Bow in the tracker window. Pick another key.",
    );
  });

  it("refuses Ctrl+Alt on Windows, where it is AltGr", async () => {
    const { onStatus } = show(mechanism("hotkeys", { os: "windows" }), {
      enabled: true,
    });
    const user = await capture("shortcut-advance-hookshot");

    await user.keyboard("{Control>}{Alt>}h{/Alt}{/Control}");

    expect(onStatus).toHaveBeenLastCalledWith(
      "On Windows, Ctrl+Alt is AltGr: add Shift, or pick another key.",
    );
  });

  it("holds no key while it listens, and lets go when the tab closes", async () => {
    const { unmount } = show(mechanism("hotkeys"), { enabled: true });
    await capture("shortcut-advance-hookshot");
    expect(useGlobalShortcutsStore.getState().capturing).toBe(true);

    unmount();
    expect(useGlobalShortcutsStore.getState().capturing).toBe(false);
  });
});

describe("accessibility", () => {
  const violationsOf = async (container: HTMLElement) => {
    const result = await axe.run(container, {
      // jsdom paints nothing: the browser tests check contrast
      rules: { "color-contrast": { enabled: false } },
    });
    return result.violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
    );
  };

  it.each([
    ["the system's hotkeys", mechanism("hotkeys")],
    ["the portal", mechanism("portal", { configurable: true })],
    ["the command line", mechanism("command")],
  ])("has no axe violation under %s", async (_name, m) => {
    const { container } = show(m, {
      enabled: true,
      keymap: { "advance:hookshot": "Control+Alt+Shift+KeyH" },
      report: report(m, "partial", [binding("advance:hookshot", "taken")]),
    });
    expect(await violationsOf(container)).toEqual([]);
  });

  it("would notice a button without a name", async () => {
    const { container } = render(<button type="button" />);
    expect(await violationsOf(container)).toEqual([
      expect.stringContaining("button-name"),
    ]);
  });

  it("names the switch and announces the status", () => {
    show(mechanism("hotkeys"));
    expect(screen.getByRole("switch")).toHaveAccessibleName(
      "Use global shortcuts",
    );
    expect(within(document.body).getAllByRole("status")).toContain(status());
  });
});
