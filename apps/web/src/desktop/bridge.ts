// How the desktop app reaches the game, tried in this order on every
// connection: RetroArch itself, its network commands sent by the app's Rust
// side (apps/desktop/src-tauri/src/retroarch.rs), then SNI for every other
// device (an FX Pak Pro, BizHawk, an NWA emulator). The session reads in the
// pack's terms; RetroArch's transport turns them into bus addresses under
// the pack's mapping.

import {
  DEFAULT_USB2SNES_URL,
  FirstAnsweringTransport,
  RETROARCH_URL,
  type RetroArchSend,
  RetroArchTransport,
  Usb2SnesTransport,
} from "@alltp/autotrack";
import { invoke } from "@tauri-apps/api/core";
import type { BridgeOptions } from "@/autotrack/bridge";

/** One network command to RetroArch, through the app. */
export const sendToRetroArch: RetroArchSend = (command, timeoutMs) =>
  invoke<string | null>("retroarch", { command, timeoutMs });

export const DESKTOP_BRIDGE: BridgeOptions = {
  transport: (pack) =>
    new FirstAnsweringTransport([
      () =>
        new RetroArchTransport({
          mapping: pack.profile.mapping,
          send: sendToRetroArch,
        }),
      () => new Usb2SnesTransport(),
    ]),
  url: `${RETROARCH_URL}, then ${DEFAULT_USB2SNES_URL}`,
};
