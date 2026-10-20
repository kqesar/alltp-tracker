import { describe, expect, it } from "vitest";
import { MemoryTransport, SNI } from "../test/memory-transport";
import { TransportError } from "./errors";
import { FirstAnsweringTransport } from "./first-answering";
import { RETROARCH_LIMITS } from "./retroarch";
import type { BridgeInfo, Transport } from "./transport";

const RETROARCH: BridgeInfo = {
  kind: "retroarch",
  url: "udp://127.0.0.1:55355",
  version: "1.22.2",
};

const unreachable = (message: string, reason?: string) =>
  new TransportError("unreachable", "open", message, { reason });

/** A transport that opens as `open` says, and records what happened to it. */
const candidate = (
  open: () => Promise<BridgeInfo>,
  limits = RETROARCH_LIMITS,
) => {
  const transport = new MemoryTransport(new Uint8Array(16), { open });
  Object.defineProperty(transport, "limits", { value: limits });
  let built = 0;
  return {
    build: (): Transport => {
      built++;
      return transport;
    },
    built: () => built,
    transport,
  };
};

describe("FirstAnsweringTransport", () => {
  it("talks to the first that answers, and builds no other", async () => {
    const direct = candidate(() => Promise.resolve(RETROARCH));
    const sni = candidate(() => Promise.resolve(SNI));
    const transport = new FirstAnsweringTransport([direct.build, sni.build]);

    expect(await transport.open()).toEqual(RETROARCH);
    expect(transport.limits).toBe(RETROARCH_LIMITS);
    expect(sni.built()).toBe(0);
    expect(await transport.listDevices()).toHaveLength(1);
  });

  it("moves on when nothing answered, closing what it tried", async () => {
    const direct = candidate(() =>
      Promise.reject(unreachable("RetroArch did not answer")),
    );
    const sni = candidate(() => Promise.resolve(SNI));
    const transport = new FirstAnsweringTransport([direct.build, sni.build]);

    expect(await transport.open()).toEqual(SNI);
    expect(direct.transport.closed).toBe(true);
    expect(sni.transport.closed).toBe(false);
  });

  it("says what each one missed when none answered", async () => {
    const transport = new FirstAnsweringTransport([
      candidate(() => Promise.reject(unreachable("RetroArch did not answer")))
        .build,
      candidate(() =>
        Promise.reject(unreachable("No bridge answered at ws", "error")),
      ).build,
    ]);
    await expect(transport.open()).rejects.toMatchObject({
      code: "unreachable",
      detail: {
        reason: "RetroArch did not answer; No bridge answered at ws (error)",
      },
      message: "RetroArch did not answer; No bridge answered at ws",
    });
  });

  it("stops at a failure that is not silence", async () => {
    const refused = new TransportError("closed", "open", "closed", {
      closeCode: 1008,
      reason: "Not in trusted origin",
    });
    const sni = candidate(() => Promise.resolve(SNI));
    const transport = new FirstAnsweringTransport([
      candidate(() => Promise.reject(refused)).build,
      sni.build,
    ]);
    await expect(transport.open()).rejects.toBe(refused);
    expect(sni.built()).toBe(0);
  });

  it("closes the one opening, and refuses everything after", async () => {
    const pending = candidate(() => new Promise<BridgeInfo>(() => {}));
    const transport = new FirstAnsweringTransport([pending.build]);
    const opening = transport.open();
    transport.close();
    await expect(opening).rejects.toMatchObject({ code: "closed" });
    expect(pending.transport.closed).toBe(true);
    await expect(transport.listDevices()).rejects.toMatchObject({
      code: "closed",
    });
  });

  it("starts over on a preferred one that answers before the fallback has a device", async () => {
    let up = false;
    const direct = candidate(() =>
      up
        ? Promise.resolve(RETROARCH)
        : Promise.reject(unreachable("RetroArch did not answer")),
    );
    const sni = candidate(() => Promise.resolve(SNI));
    const transport = new FirstAnsweringTransport([direct.build, sni.build]);
    expect(await transport.open()).toEqual(SNI);
    // RetroArch still closed: SNI's devices
    expect(await transport.listDevices()).toHaveLength(1);
    up = true;
    await expect(transport.listDevices()).rejects.toMatchObject({
      code: "superseded",
      operation: "device-list",
    });
  });

  it("tries nothing again once the first one carries the session", async () => {
    const direct = candidate(() => Promise.resolve(RETROARCH));
    const transport = new FirstAnsweringTransport([direct.build]);
    await transport.open();
    await transport.listDevices();
    await transport.listDevices();
    expect(direct.built()).toBe(1);
  });

  it("tells the chosen one's close to the session", async () => {
    const direct = candidate(() => Promise.resolve(RETROARCH));
    const transport = new FirstAnsweringTransport([direct.build]);
    const closes: Error[] = [];
    transport.onClose((error) => closes.push(error));
    await transport.open();
    direct.transport.close();
    expect(closes).toHaveLength(1);
  });
});
