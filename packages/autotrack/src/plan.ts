// Read planning: turns the byte ranges due on a tick into the fewest
// usb2snes requests, once, so a poll only walks precomputed typed arrays.
//
// Two passes. Merging joins ranges of one memory region that overlap, touch,
// or sit closer than `gap` bytes, unless the bytes in between cross a barrier
// (Race Mode bars every byte it may not read). Packing then cuts the merged
// spans into the pieces a request carries:
// - QUsb2Snes refuses a piece over 255 bytes in a multi-range GetAddress
//   (core/wsservercommands.cpp, "VGet with a size > 255") but takes one range
//   of any size alone, so a plan with a single span sends it whole;
// - SNI translates each piece's start address to the A-bus for RetroArch, Lua
//   and NWA emulators and reads on from there (raclient.go MultiReadMemory),
//   so a ROM or SRAM piece must not cross a bank page: LoROM pages are 32 KiB,
//   HiROM SRAM windows 8 KiB. Pieces stop at every 8 KiB boundary there.

import { pakRegion } from "./address";

/** ROM and SRAM pieces never cross a multiple of this. */
export const PAGE_SIZE = 0x2000;

/** A byte range to read: `[address, address + size)` in FX Pak Pro space. */
export interface ByteRange {
  readonly address: number;
  readonly size: number;
}

/** What one request may carry. Transports declare theirs. */
export interface ReadLimits {
  /** Largest piece inside a multi-range request. */
  readonly maxPieceSize: number;
  /** Most pieces one request carries. */
  readonly maxPieces: number;
  /** Largest range sent alone, as a single-range request. */
  readonly maxSingleSize: number;
}

/**
 * The usb2snes limits: QUsb2Snes caps multi-range pieces at 255 bytes; SNI
 * splits any size itself (devices/snes/drivers/*). RetroArch serves at most
 * 16384 bytes per READ_CORE_MEMORY (command.c, COMMAND_READ_NBYTES_MAX) and
 * SNI already cuts reads into 2048-byte commands (raclient.go, maxReadSize).
 */
export const USB2SNES_LIMITS: ReadLimits = {
  maxPieceSize: 255,
  maxPieces: 64,
  maxSingleSize: 0x4000,
};

/** One request: its pieces and where their bytes land in the plan buffer. */
export interface PlannedRequest {
  /** `[address0, size0, address1, size1, ...]`, ascending, disjoint. */
  readonly pieces: Uint32Array;
  /** Sum of the piece sizes. */
  readonly size: number;
  /** Offset of this request's first byte in the plan buffer. */
  readonly offset: number;
}

/** A precomputed read: requests, plus where each range sits in the result. */
export interface ReadPlan {
  readonly requests: readonly PlannedRequest[];
  /** Bytes all requests return together; the size of the plan buffer. */
  readonly size: number;
  /**
   * For each input range, in input order, the offset of its first byte in
   * the plan buffer (a range lies inside one span, so it is contiguous).
   */
  readonly rangeOffsets: Uint32Array;
}

export interface PlanOptions {
  readonly limits: ReadLimits;
  /** Unread bytes a merge may bridge between two ranges. */
  readonly gap: number;
  /** Byte ranges a bridged gap must never touch. Need not be sorted. */
  readonly barriers?: readonly ByteRange[];
}

export const EMPTY_PLAN: ReadPlan = {
  rangeOffsets: new Uint32Array(0),
  requests: [],
  size: 0,
};

interface Span {
  start: number;
  end: number; // exclusive
}

function crossesBarrier(
  from: number,
  to: number,
  barriers: readonly ByteRange[],
): boolean {
  for (const barrier of barriers) {
    if (barrier.address < to && barrier.address + barrier.size > from) {
      return true;
    }
  }
  return false;
}

function sameRegion(a: number, b: number): boolean {
  return pakRegion(a) === pakRegion(b);
}

/** Whether pieces at `address` stop at page boundaries (ROM and SRAM). */
function paged(address: number): boolean {
  const name = pakRegion(address)?.name;
  return name === "rom" || name === "sram";
}

function pageEnd(at: number, end: number, isPaged: boolean): number {
  return isPaged
    ? Math.min(end, (Math.floor(at / PAGE_SIZE) + 1) * PAGE_SIZE)
    : end;
}

/**
 * Plans the reads for `ranges`. Every byte of every range is read; no byte
 * of a barrier is read unless a range itself covers it; no two pieces
 * overlap. Ranges may overlap each other and come in any order.
 */
export function planReads(
  ranges: readonly ByteRange[],
  options: PlanOptions,
): ReadPlan {
  if (ranges.length === 0) return EMPTY_PLAN;
  const { gap, limits } = options;
  const barriers = options.barriers ?? [];
  const order = ranges.map((_, index) => index);
  order.sort((a, b) => ranges[a].address - ranges[b].address || a - b);

  // Merge, remembering which span each range went into.
  const spans: Span[] = [];
  const spanOf = new Uint32Array(ranges.length);
  for (const index of order) {
    const { address, size } = ranges[index];
    const end = address + size;
    const last = spans[spans.length - 1];
    if (
      last !== undefined &&
      sameRegion(last.start, address) &&
      (address <= last.end ||
        (address - last.end <= gap &&
          !crossesBarrier(last.end, address, barriers)))
    ) {
      last.end = Math.max(last.end, end);
    } else {
      spans.push({ end, start: address });
    }
    spanOf[index] = spans.length - 1;
  }

  // Pack: one span alone goes whole when it fits a single-range request.
  const pieces: number[] = [];
  const spanOffsets: number[] = [];
  let total = 0;
  const first = spans[0];
  const whole =
    spans.length === 1 &&
    first.end - first.start <= limits.maxSingleSize &&
    pageEnd(first.start, first.end, paged(first.start)) === first.end;
  for (const span of spans) {
    spanOffsets.push(total);
    const isPaged = paged(span.start);
    for (let at = span.start; at < span.end; ) {
      const stop = whole ? span.end : pageEnd(at, span.end, isPaged);
      const size = whole ? stop - at : Math.min(limits.maxPieceSize, stop - at);
      pieces.push(at, size);
      total += size;
      at += size;
    }
  }

  const requests: PlannedRequest[] = [];
  const perRequest = whole ? 1 : limits.maxPieces;
  let offset = 0;
  for (let from = 0; from < pieces.length; from += perRequest * 2) {
    const slice = Uint32Array.from(pieces.slice(from, from + perRequest * 2));
    let size = 0;
    for (let i = 1; i < slice.length; i += 2) size += slice[i];
    requests.push({ offset, pieces: slice, size });
    offset += size;
  }

  const rangeOffsets = new Uint32Array(ranges.length);
  for (let index = 0; index < ranges.length; index++) {
    const span = spans[spanOf[index]];
    rangeOffsets[index] =
      spanOffsets[spanOf[index]] + ranges[index].address - span.start;
  }
  return { rangeOffsets, requests, size: total };
}

/** Every `[address, size]` pair a plan sends, in send order. */
export function planPieces(plan: ReadPlan): ByteRange[] {
  const out: ByteRange[] = [];
  for (const request of plan.requests) {
    for (let i = 0; i < request.pieces.length; i += 2) {
      out.push({ address: request.pieces[i], size: request.pieces[i + 1] });
    }
  }
  return out;
}
