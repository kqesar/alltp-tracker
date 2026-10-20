// Where a game's session finds the game. The site reaches the usb2snes
// bridge (SNI or QUsb2Snes), on another port with `?bridge=<port>` (the
// browser tests' fake one). The desktop app reads RetroArch itself, then SNI
// for every other device: that code is a chunk of the app alone
// (desktop/bridge.ts), which the site's build leaves out.

import type { SessionOptions } from "@alltp/autotrack";
import { bridgeUrl } from "@/utils/view";

/** What a session is told of its bridge. */
export type BridgeOptions = Pick<SessionOptions, "transport" | "url">;

/** The bridge options for this build: the site's, or the desktop app's. */
export const bridgeOptions = async (): Promise<BridgeOptions> => {
  // Inline, so the site's build drops the desktop chunk
  if (import.meta.env.MODE === "desktop") {
    return (await import("@/desktop/bridge")).DESKTOP_BRIDGE;
  }
  const url = bridgeUrl();
  return url === undefined ? {} : { url };
};
