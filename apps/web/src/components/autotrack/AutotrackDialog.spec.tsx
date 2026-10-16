import {
  parseUserAgent,
  type SessionStatus,
  TransportError,
} from "@alltp/autotrack";
import { MEMORY_RANGE, type MemoryRangeId } from "@alltp/pack-alttpr";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FakeVisibility,
  GRANTED,
  ManualClock,
  readingOf,
  SAVE,
  STATUSES,
  seedMemory,
  settle,
  statusOf,
} from "@/autotrack/fixtures";
import { readMemory } from "@/autotrack/reading";
import { AutotrackDialog } from "@/components/autotrack/AutotrackDialog";
import {
  setAutotrackOptions,
  stopAutotrack,
  useAutotrackStore,
} from "@/stores/autotrackStore";
import { useGameStore } from "@/stores/gameStore";
import { MemoryTransport } from "../../../../../packages/autotrack/test/memory-transport";

const FIREFOX_LINUX = parseUserAgent(
  "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
);

const STEPS = ["get-bridge", "run-bridge", "emulator", "permission", "game"];

/** The store as a running session leaves it, showing `status`. */
const show = (status: SessionStatus, active = true) =>
  act(() =>
    useAutotrackStore.setState({ active, shown: status, since: 0, status }),
  );

const step = (id: string) => screen.getByTestId(`setup-step-${id}`);
const toggle = (id: string) => screen.getByTestId(`setup-toggle-${id}`);
const states = () =>
  STEPS.map((id) => step(id).getAttribute("data-state") ?? "");
const opened = () =>
  STEPS.filter((id) => toggle(id).getAttribute("aria-expanded") === "true");

const open = async (onClose = () => {}) => {
  render(<AutotrackDialog onClose={onClose} />);
  // Its effects: the session's code fetched ahead, the system detected
  await act(() => settle());
};

beforeEach(() => {
  localStorage.clear();
  act(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    useAutotrackStore.setState(useAutotrackStore.getInitialState(), true);
    useAutotrackStore.setState({ environment: FIREFOX_LINUX });
  });
});

afterEach(() => {
  act(() => stopAutotrack());
  setAutotrackOptions({});
});

describe("AutotrackDialog's setup guide", () => {
  it("starts at the first step, naming the download for this system", async () => {
    await open();

    expect(states()).toEqual([
      "pending",
      ...STEPS.slice(1).map(() => "pending"),
    ]);
    expect(opened()).toEqual(["get-bridge"]);
    expect(step("get-bridge")).toHaveTextContent(
      "sni-v0.0.103-linux-amd64.tar.xz",
    );
    expect(screen.getByTestId("setup-count")).toHaveTextContent(
      "0 of 5 steps done",
    );
    expect(screen.getByTestId("autotrack-headline")).toHaveTextContent("Off");
  });

  it("ticks the steps as the session gets through them", async () => {
    await open();

    show(STATUSES.connected);

    expect(states()).toEqual(STEPS.map(() => "done"));
    expect(opened()).toEqual([]);
    expect(screen.getByTestId("setup-count")).toHaveTextContent(
      "5 of 5 steps done",
    );
    expect(toggle("game")).toHaveAccessibleName("Load the game, done");
  });

  it("opens the first failing step with its fix, and follows the session", async () => {
    await open();

    show(STATUSES["bridge-unreachable"]);

    expect(states()).toEqual([
      "pending",
      "failing",
      "pending",
      "pending",
      "pending",
    ]);
    expect(opened()).toEqual(["run-bridge"]);
    expect(toggle("run-bridge")).toHaveAccessibleName(
      "Run SNI, needs attention",
    );
    const fix = within(step("run-bridge")).getByTestId("setup-fix");
    expect(fix).toHaveTextContent(
      "SNI isn't running, or the browser is blocking it",
    );
    // Where to allow it, in this browser's words
    expect(fix).toHaveTextContent("Device apps and services");

    show(STATUSES["memory-unreadable"]);
    expect(opened()).toEqual(["emulator"]);
    expect(within(step("emulator")).getByTestId("setup-fix")).toHaveTextContent(
      "bsnes-mercury",
    );
  });

  it("opens and closes any step on a click", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(toggle("permission"));
    await user.click(toggle("get-bridge"));

    expect(opened()).toEqual(["permission"]);
    expect(step("permission")).toHaveTextContent("Device apps and services");
  });

  it("switches systems by tab, from the pointer or the keyboard", async () => {
    const user = userEvent.setup();
    await open();
    const tab = (name: string) => screen.getByRole("tab", { name });
    expect(tab("Linux")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Linux");
    await user.click(toggle("run-bridge"));
    expect(step("run-bridge")).toHaveTextContent("./sni");

    await user.click(tab("Windows"));
    expect(tab("Windows")).toHaveAttribute("aria-selected", "true");
    expect(tab("Linux")).toHaveAttribute("tabindex", "-1");
    expect(step("run-bridge")).toHaveTextContent("sni.exe");
    // Another system's CPU is unknown: every download of it
    expect(
      within(step("get-bridge")).getAllByText(/^sni-v0\.0\.103-windows/),
    ).toHaveLength(4);

    await user.keyboard("{ArrowRight}");
    expect(tab("macOS")).toHaveFocus();
    expect(tab("macOS")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(tab("Windows")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(tab("Linux")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(tab("Linux")).toHaveFocus();
    // Other keys are left alone
    await user.keyboard("{ArrowDown}");
    expect(tab("Linux")).toHaveFocus();
  });

  it("fits the steps to the emulator picked, until one attaches", async () => {
    const user = userEvent.setup();
    await open();
    const picker = screen.getByTestId("setup-device");
    expect(picker).toHaveValue("retroarch");

    await user.selectOptions(picker, "fxpakpro");
    await user.click(toggle("emulator"));
    expect(step("emulator")).toHaveTextContent("firmware 1.11.0");
    expect(step("emulator")).toHaveTextContent("51-fxpak.rules");

    show(STATUSES.attaching);
    expect(picker).toHaveValue("retroarch");
    expect(picker).toBeDisabled();
  });
});

describe("AutotrackDialog's status", () => {
  it("says what is connected, and whether Race Mode is on", async () => {
    await open();

    show(STATUSES.connected);
    expect(screen.getByTestId("autotrack-headline")).toHaveTextContent(
      "Connected",
    );
    expect(
      screen.getByText("SNI 0.0.103 · RetroArch 1.22.2 · ra://127.0.0.1:55355"),
    ).toBeVisible();
    expect(screen.getByTestId("race-mode")).toHaveTextContent(
      "Race Mode is off: this seed is not a race seed.",
    );
    expect(screen.queryByTestId("race-badge")).toBeNull();

    show(
      statusOf("connected", {
        race: {
          active: true,
          flag: "unknown",
          overridden: false,
          raceLegal: true,
          setting: "auto",
        },
      }),
    );
    expect(screen.getByTestId("race-badge")).toBeVisible();
    expect(screen.getByTestId("race-mode")).toHaveTextContent(
      "The race flag could not be read, so the tracker reads only what races permit.",
    );
  });

  it("says what happens next while it waits", async () => {
    await open();

    show(STATUSES.attaching);
    expect(
      screen.getByText("SNI 0.0.103 · ra://127.0.0.1:55355"),
    ).toBeVisible();
    show(STATUSES["no-device"]);
    expect(
      screen.getByText("Trying again on its own: see the step below."),
    ).toBeVisible();
    show(STATUSES["local-network-denied"]);
    expect(
      screen.getByText(
        "Waiting for you: see the step below, then click Retry now.",
      ),
    ).toBeVisible();
    show(STATUSES.connecting);
    expect(screen.queryByTestId("autotrack-retry")).toBeNull();
  });

  it("names a device by its kind, or as the bridge does", async () => {
    await open();

    show(
      statusOf("connected", {
        bridge: { kind: "unknown", url: "ws://localhost:23074", version: null },
        device: {
          device: { id: "Snes9x - 1.63", kind: "unknown" },
          flags: [],
          name: "NWAccess",
          rom: "seed.sfc",
          romReadable: true,
          version: null,
        },
      }),
    );

    expect(
      screen.getByText("The bridge · NWAccess · Snes9x - 1.63"),
    ).toBeVisible();
  });

  it("says when autotracking could not load", async () => {
    await open();

    act(() => useAutotrackStore.setState({ unavailable: true }));

    expect(screen.getByTestId("autotrack-headline")).toHaveTextContent(
      "Autotracking could not be loaded",
    );
    expect(
      screen.getByText("Reload the page to try again; your run is saved."),
    ).toBeVisible();
  });
});

describe("AutotrackDialog's actions", () => {
  it("connects, retries and disconnects", async () => {
    const user = userEvent.setup();
    const clock = new ManualClock();
    setAutotrackOptions({
      clock,
      permission: GRANTED,
      random: () => 0,
      transport: () =>
        new MemoryTransport(seedMemory({ race: false }), {
          open: () =>
            Promise.reject(
              new TransportError("unreachable", "open", "No bridge"),
            ),
        }),
      visibility: new FakeVisibility(),
    });
    await open();
    const connect = screen.getByTestId("autotrack-connect");
    expect(connect).toHaveFocus();

    await user.click(connect);
    await act(() => clock.advance(0));

    expect(screen.getByTestId("autotrack-headline")).toHaveTextContent(
      "SNI isn't running, or the browser is blocking it",
    );
    // The same button, now Disconnect: focus stays on it
    expect(screen.getByTestId("autotrack-disconnect")).toBe(connect);
    await user.click(screen.getByTestId("autotrack-retry"));
    await act(() => clock.advance(0));
    expect(useAutotrackStore.getState().status).toMatchObject({
      attempt: 2,
      code: "bridge-unreachable",
    });

    await user.click(screen.getByTestId("autotrack-disconnect"));
    expect(screen.getByTestId("autotrack-headline")).toHaveTextContent("Off");
    expect(useAutotrackStore.getState().connectOnStart).toBe(false);
  });

  it("syncs the board to the game, and says what it changed", async () => {
    const user = userEvent.setup();
    const clock = new ManualClock();
    setAutotrackOptions({
      clock,
      permission: GRANTED,
      random: () => 0,
      transport: () => new MemoryTransport(seedMemory({ race: false }), {}),
      visibility: new FakeVisibility(),
    });
    await open();
    expect(screen.queryByTestId("autotrack-sync")).toBeNull();
    await user.click(screen.getByTestId("autotrack-connect"));
    await act(() => clock.advance(0));
    expect(useGameStore.getState().items.sword).toBe(2);
    act(() => useGameStore.getState().handleItemClick("sword"));

    const sync = screen.getByRole("button", { name: "Sync from game" });
    expect(sync).toHaveAccessibleDescription(
      "The board follows your game as you play, and the marks you set beyond it stay. Sync from game sets the board to the game, clearing them.",
    );
    await user.click(sync);

    expect(useGameStore.getState().items.sword).toBe(2);
    expect(screen.getByTestId("autotrack-sync-status")).toHaveTextContent(
      "1 mark set to the game's. Undo takes it back.",
    );
    await user.click(sync);
    expect(screen.getByTestId("autotrack-sync-status")).toHaveTextContent(
      "The board already matches the game.",
    );
    act(() => {
      useGameStore.getState().handleItemClick("sword");
      useGameStore.getState().handleItemClick("hookshot");
    });
    await user.click(sync);
    expect(screen.getByTestId("autotrack-sync-status")).toHaveTextContent(
      "2 marks set to the game's. Undo takes them back.",
    );
  });

  it("says when no game in play was read yet, and what Race Mode keeps", async () => {
    const user = userEvent.setup();
    await open();
    show(
      statusOf("connected", {
        race: {
          active: true,
          flag: "race",
          overridden: false,
          raceLegal: true,
          setting: "auto",
        },
      }),
    );

    expect(screen.getByTestId("autotrack-follow")).toHaveTextContent(
      "In Race Mode, what races forbid tracking stays yours to mark: pendants and crystals, chests inside dungeons, bottles.",
    );
    await user.click(screen.getByTestId("autotrack-sync"));
    expect(screen.getByTestId("autotrack-sync-status")).toHaveTextContent(
      "No game in play read yet.",
    );
  });

  it("keeps the wish to connect on start in a checkbox", async () => {
    const user = userEvent.setup();
    await open();
    const box = screen.getByRole("checkbox", {
      name: "Connect when the tracker opens, on this device",
    });
    expect(box).not.toBeChecked();

    await user.click(box);

    expect(box).toBeChecked();
    expect(useAutotrackStore.getState().connectOnStart).toBe(true);
  });

  it("copies the diagnostic report", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(writeText);
    await open();
    show(STATUSES["bridge-unreachable"]);

    await user.click(screen.getByTestId("autotrack-copy-report"));

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("status: bridge-unreachable"),
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("environment: linux x86_64"),
    );
    expect(screen.getByTestId("autotrack-copy-status")).toHaveTextContent(
      "Copied.",
    );
    expect(screen.queryByTestId("autotrack-report")).toBeNull();
  });

  it("shows the report to copy by hand when the clipboard refuses", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );
    await open();

    await user.click(screen.getByTestId("autotrack-copy-report"));

    const report = screen.getByRole<HTMLTextAreaElement>("textbox", {
      name: "Diagnostic report",
    });
    expect(report.value).toMatch(/^ALttP tracker autotracking report\n/);
    // Selected, for Ctrl+C
    await waitFor(() =>
      expect(report.selectionEnd - report.selectionStart).toBe(
        report.value.length,
      ),
    );
    expect(screen.getByTestId("autotrack-copy-status")).toHaveTextContent(
      /^Press (Ctrl|Cmd)\+C to copy\.$/,
    );
  });

  it("closes on Done", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    await open(onClose);

    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("detects the system when nothing has yet", async () => {
    act(() => useAutotrackStore.setState({ environment: null }));

    await open();

    expect(useAutotrackStore.getState().environment).not.toBeNull();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });
});

describe("AutotrackDialog's readout", () => {
  /** A seed's memory read through the pack's ranges, as a snapshot is. */
  const reading = (race: boolean, unread: readonly string[] = []) => {
    const memory = seedMemory({ race });
    memory[SAVE(0x367)] = 0x20; // Eastern Palace's big key ($2000)
    return readMemory(
      {
        bytes: (id) => {
          const { address, size } = MEMORY_RANGE[id as MemoryRangeId];
          return memory.subarray(address, address + size);
        },
        has: (id) => !unread.includes(id),
      },
      race,
      Date.UTC(2026, 9, 16, 20, 15),
    );
  };

  it("lists what was read while connected", async () => {
    await open();
    expect(screen.queryByTestId("readout")).toBeNull();

    act(() =>
      useAutotrackStore.setState({
        active: true,
        reading: reading(false),
        shown: STATUSES.connected,
      }),
    );

    const readout = screen.getByRole("region", { name: "What I read" });
    expect(readout).toHaveTextContent(/^What I readRead at .+\. Compare/);
    const items = within(readout).getByTestId("readout-items");
    expect(
      within(items)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Master Sword", "Bottle ×1", "Hookshot"]);
    expect(
      within(readout).getByTestId("readout-dungeon-items"),
    ).toHaveTextContent("Eastern PalaceBig Key");
    expect(within(readout).getByTestId("readout-checked")).toHaveTextContent(
      "Locations checked (4)Outside dungeonsLink's House",
    );
    expect(within(readout).getByTestId("readout-progress")).toHaveTextContent(
      "✓Game startedyes✓Zelda rescuedyes–Triforce reachedno",
    );
  });

  it("names what it read that the board has no cell for", async () => {
    await open();
    const memory = seedMemory({ race: false });
    memory[SAVE(0x37b)] = 0x02; // Quarter Magic
    act(() =>
      useAutotrackStore.setState({
        active: true,
        reading: readingOf(memory),
        shown: STATUSES.connected,
      }),
    );

    expect(screen.getByTestId("readout-untracked")).toHaveTextContent(
      "Not on the boardQuarter Magic",
    );
    // The board then counts small keys: not with keysanity
    memory[SAVE(0x37c + 6)] = 1;
    act(() => useAutotrackStore.setState({ reading: readingOf(memory) }));
    expect(screen.getByTestId("readout-untracked")).toHaveTextContent(
      "Small keys",
    );
    act(() => useGameStore.getState().applyPreset("keysanity"));
    expect(screen.getByTestId("readout-untracked")).not.toHaveTextContent(
      "Small keys",
    );
  });

  it("says when the reading is from before the connection dropped", async () => {
    await open();

    act(() =>
      useAutotrackStore.setState({
        active: true,
        reading: reading(true, ["game-mode"]),
        shown: STATUSES["bridge-unreachable"],
      }),
    );

    expect(screen.getByTestId("readout")).toHaveTextContent(
      "before the connection dropped",
    );
    expect(screen.getByTestId("readout")).toHaveTextContent(
      "In Race Mode, what races forbid tracking is never read.",
    );
    expect(screen.getByTestId("readout-progress")).toHaveTextContent(
      "Game startednot read yet",
    );
    expect(screen.getByTestId("readout-prizes")).toHaveTextContent(
      "Not read in Race Mode",
    );
    expect(screen.getByTestId("readout-race-mode")).toHaveTextContent(
      "Bottles",
    );
  });
});
