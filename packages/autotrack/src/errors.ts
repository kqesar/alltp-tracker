/**
 * A pack, profile or range list that does not hold together: an unknown
 * category, overlapping ids, a range outside its memory region, a race-safe
 * range outside the addresses the race profile permits. Thrown when a pack is
 * loaded, never while polling.
 */
export class DefinitionError extends Error {
  override readonly name = "DefinitionError";
}

/**
 * A read the race guard refused: it would have sent bytes the active race
 * profile forbids. The scheduler builds its plans so this never fires; the
 * guard is the second line of defence, checked before anything is sent.
 */
export class RaceViolationError extends Error {
  override readonly name = "RaceViolationError";
}

/** What went wrong between the tracker and the bridge. */
export type TransportErrorCode =
  /** The socket never opened: nothing listening, or the browser blocked it. */
  | "unreachable"
  /** The bridge closed an open connection (usb2snes signals errors so). */
  | "closed"
  /** No reply in time. Replies are untagged, so the socket is dropped. */
  | "timeout"
  /** A reply that does not fit the request: wrong type or too many bytes. */
  | "protocol"
  /** The device answered with an error text (a RetroArch `-1` reply). */
  | "device"
  /**
   * A way to the game the transport prefers answered after it settled for
   * another: the session starts over at once, to take it.
   */
  | "superseded";

/** The operation that was in flight when a transport error happened. */
export type TransportOperation =
  | "open"
  | "app-version"
  | "device-list"
  | "attach"
  | "info"
  | "read";

export class TransportError extends Error {
  override readonly name = "TransportError";

  constructor(
    readonly code: TransportErrorCode,
    readonly operation: TransportOperation,
    message: string,
    /**
     * What the other side said, verbatim: a WebSocket close code and reason,
     * or a RetroArch error text such as `no memory map defined`.
     */
    readonly detail: {
      readonly closeCode?: number;
      readonly reason?: string;
    } = {},
  ) {
    super(message);
  }
}
