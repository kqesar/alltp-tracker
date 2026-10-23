import { type Ref, useCallback, useEffect } from "react";
import {
  ShortcutTable,
  type ShortcutTableHandle,
} from "@/games/alttpr/components/ui/ShortcutTable";
import {
  type ActionId,
  type Chord,
  controlTitle,
  parseAction,
} from "@/games/alttpr/data/keymap";
import {
  type DesktopOs,
  type GlobalRefusal,
  globalRefusalOf,
  windowHolderOf,
} from "@/games/alttpr/desktop/globalKeymap";
import {
  hasUnsentChanges,
  openDesktopSettings,
  syncGlobalShortcuts,
  syncIfChanged,
  wantedBindings,
} from "@/games/alttpr/desktop/globalShortcuts";
import {
  type BindingReport,
  type Mechanism,
  type Report,
  useGlobalShortcutsStore,
} from "@/games/alttpr/desktop/globalShortcutsStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { copyText } from "@/utils/clipboard";

/** The command a window manager's binding runs to step `action`. */
export const commandFor = (mechanism: Mechanism, action: string) =>
  `"${mechanism.command}" --step ${action}`;

/** The words for a key a global shortcut cannot be. */
const REFUSALS: Record<
  Exclude<GlobalRefusal, "window">,
  (label: string, os: DesktopOs) => string
> = {
  altgr: () => "On Windows, Ctrl+Alt is AltGr: add Shift, or pick another key.",
  key: (label) =>
    `${label} can't be a global shortcut. Pick a letter, digit, numpad or function key.`,
  typing: (label, os) =>
    os === "macos"
      ? `${label} would stop you typing it in every app (Option types characters). Add Ctrl or Cmd.`
      : `${label} would stop you typing it in every app. Add a second modifier, e.g. Ctrl+Alt+Shift.`,
};

/** What the Global tab says about the mechanism and how it stands. */
export const statusText = (
  mechanism: Mechanism,
  report: Report | null,
  pending: boolean,
  failure: string | null,
  declined = false,
): string => {
  if (failure) {
    // The commands show in command mode only: don't point at them elsewhere
    return mechanism.kind === "command"
      ? `The app could not register global shortcuts (${failure}). Bind keys in your window manager to the commands below instead.`
      : `The app could not register global shortcuts (${failure}).`;
  }
  if (mechanism.reason && mechanism.kind === "command") {
    return `Your desktop could not register global shortcuts (${mechanism.reason}). Bind keys in its settings to the commands below instead.`;
  }
  switch (mechanism.kind) {
    case "hotkeys":
      return `Global shortcuts work in every app, the emulator included. Each key goes to the tracker alone while it runs: pick combinations no other app uses${mechanism.os === "linux" ? " (X11)." : "."}`;
    case "command":
      return "Your desktop has no global shortcut service the tracker can use. Bind keys in your window manager to commands like these:";
    case "portal": {
      if (pending) return "Waiting for your desktop's approval…";
      if (declined || report?.state === "refused") {
        return "Your desktop's approval was declined. The tracker won't ask again by itself.";
      }
      if (report?.state === "unavailable") {
        return `Your desktop could not register global shortcuts (${report.bindings.find((binding) => binding.message)?.message ?? "no reason given"}).`;
      }
      if (report?.state === "active" || report?.state === "partial") {
        const approved = report.bindings.filter(
          (binding) => binding.status === "active",
        ).length;
        return `Your desktop approved ${approved} of ${report.bindings.length} shortcuts. It shows the keys it chose; change them in its settings.`;
      }
      return "Your desktop manages global shortcuts. When you close this dialog, it asks you to approve the keys below.";
    }
  }
};

/** A numpad key with no Ctrl, Alt or Meta: the one kind the floor lets through. */
const isBareNumpad = (chord: Chord | undefined) =>
  chord !== undefined &&
  /(^|\+)Numpad[^+]*$/.test(chord) &&
  !/(^|\+)(Control|Alt|Meta)\+/.test(chord);

/** The note under a key: what the system said about it. */
const noteOf = (binding: BindingReport | undefined) => {
  if (!binding) return null;
  if (binding.status === "taken") {
    return {
      text: "In use by another app or the system",
      warn: true,
    };
  }
  if (binding.status === "invalid") {
    return { text: binding.message ?? "Can't be registered", warn: true };
  }
  if (binding.status === "unbound") {
    return { text: "Not approved", warn: true };
  }
  if (binding.trigger)
    return { text: `Desktop: ${binding.trigger}`, warn: false };
  return binding.message ? { text: binding.message, warn: false } : null;
};

/**
 * The Global tab of the shortcuts dialog (desktop app only): keys that work
 * while the emulator has the focus. Off by default, and bound key by key: a
 * global key is taken from every app. How they are registered depends on the
 * system (`Mechanism.kind`), and the panel says which, and why.
 * @param onStatus - The dialog's status line, which announces each change
 */
const GlobalShortcutsPanel = ({
  onStatus,
  ref,
}: {
  onStatus: (message: string) => void;
  ref?: Ref<ShortcutTableHandle>;
}) => {
  const enabled = useGlobalShortcutsStore((state) => state.enabled);
  const keymap = useGlobalShortcutsStore((state) => state.keymap);
  const mechanism = useGlobalShortcutsStore((state) => state.mechanism);
  const report = useGlobalShortcutsStore((state) => state.report);
  const pending = useGlobalShortcutsStore((state) => state.pending);
  const failure = useGlobalShortcutsStore((state) => state.failure);
  const declined = useGlobalShortcutsStore((state) => state.declined);
  const settingsError = useGlobalShortcutsStore((state) => state.settingsError);
  const windowKeymap = useGameStore((state) => state.shortcuts.keymap);
  const { setGlobalEnabled, setGlobalKeymap } =
    useGlobalShortcutsStore.getState();

  const setCapturing = useCallback(
    (capturing: boolean) => useGlobalShortcutsStore.setState({ capturing }),
    [],
  );
  // Leaving the tab (or closing the dialog) ends a capture, so no key stays
  // released, and sends the desktop what the player chose
  useEffect(
    () => () => {
      setCapturing(false);
      syncIfChanged();
    },
    [setCapturing],
  );

  if (!mechanism) {
    return (
      <p className="shortcuts__hint" role="status">
        Looking for your system's global shortcut service…
      </p>
    );
  }

  const os = mechanism.os;
  const kind = mechanism.kind;
  const refusalOf = (chord: Chord) => globalRefusalOf(chord, os, windowKeymap);
  const refusalMessage = (
    refusal: GlobalRefusal,
    label: string,
    chord: Chord,
  ) => {
    if (refusal !== "window") return REFUSALS[refusal](label, os);
    const holder = windowHolderOf(windowKeymap, chord);
    return `${label} already steps ${holder ? controlTitle(parseAction(holder).control) : "a control"} in the tracker window. Pick another key.`;
  };

  const bindingOf = (action: ActionId) =>
    report?.bindings.find((binding) => binding.action === action);
  const copy = (action: ActionId) => {
    const command = commandFor(mechanism, action);
    void copyText(command).then((result) =>
      onStatus(
        result === "copied"
          ? `Copied: ${command}`
          : "Could not copy the command.",
      ),
    );
  };

  // After a refusal the desktop holds none of the keys, whatever the last report says
  const refused =
    kind === "portal" && (declined || report?.state === "refused");
  const noteFor = (action: ActionId) => {
    if (!keymap[action]) return null;
    return refused
      ? { text: "Not approved", warn: true }
      : noteOf(bindingOf(action));
  };
  const noteIdOf = (action: ActionId) =>
    `global-note-${action.replace(":", "-")}`;

  const rowExtra = (action: ActionId) => {
    if (kind === "command") {
      const { control, direction } = parseAction(action);
      return (
        <button
          aria-label={`Copy command for ${controlTitle(control)} ${direction === "back" ? "back" : "forward"}`}
          className="shortcut-copy"
          data-testid={`shortcut-copy-${direction}-${control}`}
          onClick={() => copy(action)}
          type="button"
        >
          Copy
        </button>
      );
    }
    const note = noteFor(action);
    if (!note) return null;
    return (
      <span
        className={`shortcut-note${note.warn ? " shortcut-note--warn" : ""}`}
        data-testid={`shortcut-note-${action.replace(":", "-")}`}
        id={noteIdOf(action)}
      >
        {note.warn && <span aria-hidden="true">⚠ </span>}
        {note.text}
      </span>
    );
  };

  const bound = Object.keys(keymap).length;
  const bareNumpad = Object.values(keymap).some(isBareNumpad);
  // Sent once the desktop has the same keys: nothing left to send
  const unsent =
    kind === "portal" &&
    enabled &&
    !refused &&
    !pending &&
    wantedBindings().length > 0 &&
    hasUnsentChanges();

  return (
    <div className="global-panel">
      <div className="shortcuts__intro">
        {/* Nothing to register in command mode: the switch would do nothing */}
        {kind !== "command" && (
          <button
            aria-checked={enabled}
            className="switch"
            data-testid="global-shortcuts-enabled"
            onClick={() => {
              setGlobalEnabled(!enabled);
              onStatus(`Global shortcuts ${enabled ? "off" : "on"}.`);
            }}
            role="switch"
            type="button"
          >
            <span aria-hidden="true" className="switch__track" />
            Use global shortcuts
          </button>
        )}
        <p
          className="shortcuts__hint"
          data-testid="global-shortcuts-status"
          role="status"
        >
          {statusText(mechanism, report, pending, failure, declined)}
        </p>
        {kind === "command" && (
          <pre className="global-command" data-testid="global-command-example">
            <code>
              {`bindsym Ctrl+Alt+h exec "${mechanism.command}" --step advance:hookshot`}
            </code>
          </pre>
        )}
        {kind === "command" && (
          <p className="shortcuts__hint">
            That line is for sway or i3; other window managers have their own
            syntax for running a command on a key. The command also works from a
            Stream Deck or a script.
          </p>
        )}
        {kind === "portal" && (
          <div className="shortcuts__actions shortcuts__actions--start">
            {unsent && (
              <button
                className="modal-btn modal-btn--primary"
                data-testid="global-shortcuts-send"
                onClick={() => void syncGlobalShortcuts()}
                type="button"
              >
                Send to desktop
              </button>
            )}
            {refused && (
              <button
                className="modal-btn modal-btn--primary"
                data-testid="global-shortcuts-again"
                onClick={() => void syncGlobalShortcuts(true)}
                type="button"
              >
                Ask again
              </button>
            )}
            {mechanism.configurable &&
              (report?.state === "active" || report?.state === "partial") && (
                <button
                  className="modal-btn modal-btn--ghost"
                  data-testid="global-shortcuts-settings"
                  onClick={() => void openDesktopSettings()}
                  type="button"
                >
                  Open shortcut settings
                </button>
              )}
          </div>
        )}
        {kind === "portal" && settingsError && (
          <p
            className="shortcuts__hint"
            data-testid="global-shortcuts-settings-error"
            role="status"
          >
            {`Could not open your desktop's shortcut settings (${settingsError}).`}
          </p>
        )}
        {enabled && bound === 0 && kind !== "command" && (
          <p className="shortcuts__hint" data-testid="global-shortcuts-hint">
            Pick a key for each control you want to reach from the emulator.
            Ctrl+Alt+Shift combinations rarely clash with other apps. Numpad
            keys don't either, but see the note that appears once one is bound.
          </p>
        )}
        {enabled && kind !== "command" && bareNumpad && (
          <p className="shortcuts__hint" data-testid="global-shortcuts-numpad">
            A numpad key bound on its own is taken from every app while global
            shortcuts are on: with NumLock on, that digit can't be typed
            anywhere else. Turn the switch off, or add a modifier, to get it
            back.
          </p>
        )}
      </div>

      <ShortcutTable
        keymap={keymap}
        noteId={(action) => (noteFor(action) ? noteIdOf(action) : undefined)}
        onCapturingChange={setCapturing}
        onChange={setGlobalKeymap}
        onStatus={onStatus}
        ref={ref}
        refusalMessage={refusalMessage}
        refusalOf={refusalOf}
        rowExtra={rowExtra}
      />
    </div>
  );
};

export default GlobalShortcutsPanel;
