import { ALTTPR_AUTOTRACK } from "@alltp/pack-alttpr";
import { SMZ3_AUTOTRACK } from "@alltp/pack-smz3";
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DESKTOP_BRIDGE, sendToRetroArch } from "@/desktop/bridge";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invoked = vi.mocked(invoke);

/** RetroArch answering through the app: its version, then its status. */
const answering = (replies: Record<string, string | null>) =>
  invoked.mockImplementation(async (_, args) => {
    const { command } = args as { command: string };
    return replies[command.split(" ")[0]] ?? null;
  });

beforeEach(() => {
  invoked.mockReset();
});

describe("the desktop app's bridge", () => {
  it("sends RetroArch's commands through the app", async () => {
    answering({ VERSION: "1.22.2\n" });
    expect(await sendToRetroArch("VERSION", 500)).toBe("1.22.2\n");
    expect(invoked).toHaveBeenCalledWith("retroarch", {
      command: "VERSION",
      timeoutMs: 500,
    });
  });

  it("reads RetroArch itself first", async () => {
    answering({ VERSION: "1.22.2\n" });
    const transport = DESKTOP_BRIDGE.transport?.(ALTTPR_AUTOTRACK);
    expect(await transport?.open()).toMatchObject({ kind: "retroarch" });
    transport?.close();
  });

  it("turns each pack's addresses into RetroArch's by its own mapping", async () => {
    answering({
      GET_STATUS: "GET_STATUS PLAYING super_nes,smz3\n",
      READ_CORE_MEMORY: null,
      VERSION: "1.22.2\n",
    });
    const transport = DESKTOP_BRIDGE.transport?.(SMZ3_AUTOTRACK);
    await transport?.open();
    await transport?.attach({ id: "udp://127.0.0.1:55355", kind: "retroarch" });
    const pieces = Uint32Array.of(0x00_ffc0, 0x15);
    await transport
      ?.read({ offset: 0, pieces, size: 0x15 }, new Uint8Array(0x15), 0)
      .catch(() => {});
    // ExHiROM: the header's copy in bank $C0, where bsnes-mercury serves it
    expect(invoked).toHaveBeenLastCalledWith("retroarch", {
      command: "READ_CORE_MEMORY c0ffc0 21",
      timeoutMs: 2000,
    });
  });

  it("names both places it looks", () => {
    expect(DESKTOP_BRIDGE.url).toBe(
      "udp://127.0.0.1:55355, then ws://localhost:23074",
    );
  });
});
