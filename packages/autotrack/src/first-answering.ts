// Several ways to reach the game, tried in order on every connection: the
// first that answers carries the whole session. The desktop app tries
// RetroArch itself, then SNI for every other device (an FX Pak Pro,
// BizHawk, an NWA emulator). Only "nothing answered" moves on to the next;
// any other failure means something answered, and is the session's to
// diagnose.
//
// A fallback is kept only once it has a device to attach. Until then, each
// time it is asked for its devices the ways before it are tried again, and
// one that answers ends the connection ("superseded"): a tracker opened
// before RetroArch, with SNI running, would otherwise wait on SNI and reach
// RetroArch through it once SNI found it.

import { TransportError, type TransportOperation } from "./errors";
import type { PlannedRequest, ReadLimits } from "./plan";
import type {
  BridgeInfo,
  DeviceDescriptor,
  DeviceInfo,
  Transport,
} from "./transport";

export class FirstAnsweringTransport implements Transport {
  private readonly candidates: readonly (() => Transport)[];
  private chosen: Transport | null = null;
  /** Where the chosen one stands among the candidates. */
  private chosenAt = -1;
  private opening: Transport | null = null;
  private closed = false;
  private closeListener: ((error: Error) => void) | null = null;

  /** @param candidates - Each builds a transport, in the order to try them */
  constructor(candidates: readonly (() => Transport)[]) {
    this.candidates = candidates;
  }

  /** The chosen transport's: read once attached, after open(). */
  get limits(): ReadLimits {
    return this.connected("read").limits;
  }

  async open(): Promise<BridgeInfo> {
    const missed: TransportError[] = [];
    for (const [at, create] of this.candidates.entries()) {
      if (this.closed) break;
      const transport = create();
      this.opening = transport;
      try {
        const bridge = await transport.open();
        if (this.closed) break;
        this.chosen = transport;
        this.chosenAt = at;
        if (this.closeListener !== null) transport.onClose(this.closeListener);
        return bridge;
      } catch (error) {
        transport.close();
        if (!(error instanceof TransportError) || error.code !== "unreachable")
          throw error;
        missed.push(error);
      } finally {
        this.opening = null;
      }
    }
    if (this.closed) throw closedError("open");
    throw new TransportError(
      "unreachable",
      "open",
      missed.map((error) => error.message).join("; ") || "Nothing to open",
      {
        closeCode: missed.at(-1)?.detail.closeCode,
        reason: missed
          .map(({ detail, message }) =>
            detail.reason ? `${message} (${detail.reason})` : message,
          )
          .join("; "),
      },
    );
  }

  async listDevices(): Promise<readonly DeviceDescriptor[]> {
    const chosen = this.connected("device-list");
    for (const create of this.candidates.slice(0, this.chosenAt)) {
      const preferred = create();
      const answered = await preferred.open().then(
        () => true,
        () => false,
      );
      preferred.close();
      if (this.closed) throw closedError("device-list");
      if (answered) {
        throw new TransportError(
          "superseded",
          "device-list",
          "A preferred way to the game answered: starting over on it",
        );
      }
    }
    return chosen.listDevices();
  }

  async attach(device: DeviceDescriptor): Promise<DeviceInfo> {
    return this.connected("attach").attach(device);
  }

  async read(
    request: PlannedRequest,
    into: Uint8Array,
    offset: number,
  ): Promise<void> {
    return this.connected("read").read(request, into, offset);
  }

  onClose(listener: (error: Error) => void): void {
    this.closeListener = listener;
    this.chosen?.onClose(listener);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.opening?.close();
    this.chosen?.close();
  }

  private connected(operation: TransportOperation): Transport {
    if (this.chosen === null || this.closed) throw closedError(operation);
    return this.chosen;
  }
}

const closedError = (operation: TransportOperation) =>
  new TransportError("closed", operation, "The transport is closed");
