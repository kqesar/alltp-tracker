import {
  type BridgeInfo,
  type DeviceInfo,
  parseUserAgent,
  RETROARCH_DEVICE,
  RETROARCH_URL,
  type SessionStatus,
} from "@alltp/autotrack";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STATUSES } from "@/autotrack/fixtures";
import { fixFor } from "@/autotrack/guide";
import { detailOf, headlineOf } from "@/autotrack/status";
import { SetupGuide } from "@/components/autotrack/SetupGuide";

// The desktop app's build
vi.mock("@/utils/platform", async (actual) => ({
  ...(await actual<typeof import("@/utils/platform")>()),
  isDesktopApp: true,
}));

/** RetroArch read directly, as the desktop app reaches it. */
const DIRECT: BridgeInfo = {
  kind: "retroarch",
  url: RETROARCH_URL,
  version: "1.22.2",
};
const DIRECT_INFO: DeviceInfo = {
  device: RETROARCH_DEVICE,
  flags: [],
  name: "RetroArch",
  rom: "alttpr - seed",
  romReadable: true,
  version: "1.22.2",
};

const LINUX = parseUserAgent(
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
);

describe("the desktop app's autotracking words", () => {
  it("names both ways it reaches the game", () => {
    expect(headlineOf(STATUSES["bridge-unreachable"], true)).toBe(
      "Neither RetroArch nor SNI is answering",
    );
    expect(detailOf(STATUSES.idle, false, false)).toBe(
      "Reads your game from RetroArch itself, or through SNI for other emulators and consoles, as you play. Set it up below, then connect.",
    );
  });

  it("names RetroArch once when it reads it directly", () => {
    const connected: SessionStatus = {
      ...STATUSES.connected,
      bridge: DIRECT,
      device: DIRECT_INFO,
    };
    expect(detailOf(connected, true, false)).toBe(
      "RetroArch 1.22.2 · udp://127.0.0.1:55355",
    );
    expect(
      detailOf(
        { ...STATUSES.attaching, bridge: DIRECT, device: RETROARCH_DEVICE },
        true,
        false,
      ),
    ).toBe("udp://127.0.0.1:55355");
  });

  it("looks for RetroArch too while SNI sees nothing", () => {
    expect(headlineOf(STATUSES["no-device"], true)).toBe(
      "Neither RetroArch nor SNI sees a game",
    );
    expect(fixFor(STATUSES["no-device"], [])?.lines[0]).toBe(
      "Start RetroArch with its network commands on, as below, and load your seed.",
    );
  });

  it("says to start RetroArch or SNI, with no browser to allow", () => {
    const fix = fixFor(STATUSES["bridge-unreachable"], []);
    expect(fix?.lines).toEqual([
      "Start RetroArch with its network commands on, as below, and load your seed.",
      "An FX Pak Pro, BizHawk or an NWA emulator goes through SNI: start SNI and leave it running.",
      "The tracker tries again on its own.",
    ]);
    expect(fix?.allow).toEqual([]);
  });

  it("blames neither SNI nor its log when RetroArch is read directly", () => {
    const failed: SessionStatus = {
      ...STATUSES["memory-unreadable"],
      bridge: DIRECT,
      cause: "read-failed",
      detail: "RetroArch did not answer read in 2000 ms",
      device: DIRECT_INFO,
      remedy: { action: "check-bridge-log" },
    };
    expect(fixFor(failed, [])?.lines).toEqual([
      "It said: “RetroArch did not answer read in 2000 ms”.",
      "Restart RetroArch if this goes on.",
      "The tracker tries again on its own.",
    ]);
  });
});

describe("the desktop app's setup guide", () => {
  it("has a RetroArch player set up the emulator and load the game", () => {
    render(
      <SetupGuide
        environment={LINUX}
        status={STATUSES["bridge-unreachable"]}
      />,
    );
    expect(screen.getByTestId("setup-count")).toHaveTextContent(
      "0 of 2 steps done",
    );
    expect(screen.queryByTestId("setup-step-permission")).toBeNull();
    expect(screen.queryByTestId("setup-step-get-bridge")).toBeNull();
    const emulator = screen.getByTestId("setup-step-emulator");
    expect(emulator).toHaveAttribute("data-state", "failing");
    expect(within(emulator).getByTestId("setup-fix")).toHaveTextContent(
      "Neither RetroArch nor SNI is answering",
    );
    expect(emulator).toHaveTextContent(
      "The app reads RetroArch itself, through its network commands: SNI is not needed.",
    );
  });

  it("keeps SNI's steps for a console, still without the browser's", () => {
    render(
      <SetupGuide
        environment={LINUX}
        status={{
          ...STATUSES["attach-failed"],
          device: { id: "fxpakpro://./dev/ttyACM0", kind: "fxpakpro" },
        }}
      />,
    );
    expect(screen.getByTestId("setup-count")).toHaveTextContent(
      "2 of 4 steps done",
    );
    expect(screen.getByTestId("setup-step-get-bridge")).toBeInTheDocument();
    expect(screen.queryByTestId("setup-step-permission")).toBeNull();
  });
});
