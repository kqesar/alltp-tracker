import { describe, expect, it } from "vitest";
import { OVERLAY_VERSION, overlayUrl } from "@/overlay/protocol";

describe("overlayUrl", () => {
  it("is the stream's address on the overlay route, as a WebSocket", () => {
    expect(overlayUrl("http://127.0.0.1:23076/", "abc")).toBe(
      "ws://127.0.0.1:23076/overlay?token=abc",
    );
    expect(overlayUrl("http://192.168.1.20:23077/", "abc")).toBe(
      "ws://192.168.1.20:23077/overlay?token=abc",
    );
  });

  it("is a secure socket for an https base", () => {
    expect(overlayUrl("https://example.test/", "t")).toBe(
      "wss://example.test/overlay?token=t",
    );
  });

  it("is protocol version 1", () => {
    expect(OVERLAY_VERSION).toBe(1);
  });
});
