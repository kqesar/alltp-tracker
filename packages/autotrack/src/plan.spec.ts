import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { pakRegion } from "./address";
import {
  type ByteRange,
  PAGE_SIZE,
  planPieces,
  planReads,
  type ReadLimits,
  USB2SNES_LIMITS,
} from "./plan";

const limits = USB2SNES_LIMITS;

/** Ranges clustered in WRAM, SRAM and ROM so merges and boundaries happen. */
const range = fc
  .tuple(
    fc.constantFrom(0xf5_0000, 0xe0_0000, 0x00_7f00, 0x18_0000, 0xf6_ff00),
    fc.integer({ max: 0x900, min: 0 }),
    fc.integer({ max: 300, min: 1 }),
  )
  .map(([base, offset, size]): ByteRange => {
    const address = base + offset;
    const end = pakRegion(address)?.end ?? address;
    return { address, size: Math.min(size, end - address + 1) };
  });

const ranges = fc.array(range, { maxLength: 30, minLength: 1 });
const barriers = fc.array(range, { maxLength: 4 });
const gap = fc.integer({ max: 64, min: 0 });
const smallLimits = fc.record<ReadLimits>({
  maxPieceSize: fc.integer({ max: 255, min: 1 }),
  maxPieces: fc.integer({ max: 8, min: 1 }),
  maxSingleSize: fc.integer({ max: 0x4000, min: 1 }),
});

/** The parts of `piece` no range covers, as intervals (no per-byte loops). */
function uncovered(
  piece: ByteRange,
  ranges: readonly ByteRange[],
): ByteRange[] {
  const sorted = ranges
    .filter(
      (r) =>
        r.address < piece.address + piece.size &&
        r.address + r.size > piece.address,
    )
    .sort((a, b) => a.address - b.address);
  const out: ByteRange[] = [];
  let at = piece.address;
  const end = piece.address + piece.size;
  for (const r of sorted) {
    if (r.address > at)
      out.push({ address: at, size: Math.min(r.address, end) - at });
    at = Math.max(at, r.address + r.size);
  }
  if (at < end) out.push({ address: at, size: end - at });
  return out;
}

const overlaps = (a: ByteRange, b: ByteRange) =>
  a.address < b.address + b.size && b.address < a.address + a.size;

/** Checks `planReads` against a sorted sweep that counts the spans it must produce. */
function expectFewestSpans(
  input: readonly ByteRange[],
  gapSize: number,
  bars: readonly ByteRange[],
) {
  const plan = planReads(input, {
    barriers: bars,
    gap: gapSize,
    limits: { ...limits, maxPieceSize: 0x1_0000, maxPieces: 1 },
  });
  // Reference: a sorted sweep counting where a new span must start.
  const sorted = [...input].sort((a, b) => a.address - b.address);
  let spans = 1;
  let end = sorted[0].address + sorted[0].size;
  let start = sorted[0].address;
  for (const r of sorted.slice(1)) {
    const sameRegion = pakRegion(start) === pakRegion(r.address);
    const blocked = bars.some(
      (bar) => bar.address < r.address && bar.address + bar.size > end,
    );
    if (
      sameRegion &&
      (r.address <= end || (r.address - end <= gapSize && !blocked))
    ) {
      end = Math.max(end, r.address + r.size);
    } else {
      spans++;
      start = r.address;
      end = r.address + r.size;
    }
  }
  // With one piece per request and no size cap, requests count pages.
  const pieces = planPieces(plan);
  expect(pieces.length).toBeGreaterThanOrEqual(spans);
  // A span break is a hole between pieces, or a change of region: pieces
  // that touch across a region boundary (WRAM to VRAM) are still two spans.
  let breaks = 1;
  for (let i = 1; i < pieces.length; i++) {
    const previousEnd = pieces[i - 1].address + pieces[i - 1].size;
    if (
      pieces[i].address !== previousEnd ||
      !sameRegionOf(pieces[i - 1].address, pieces[i].address)
    )
      breaks++;
  }
  expect(breaks).toBe(spans);
}

const sameRegionOf = (a: number, b: number) => pakRegion(a) === pakRegion(b);

describe("planReads", () => {
  it("reads every byte of every range, each once, in order", () => {
    fc.assert(
      fc.property(
        ranges,
        gap,
        barriers,
        smallLimits,
        (input, gapSize, bars, lim) => {
          const plan = planReads(input, {
            barriers: bars,
            gap: gapSize,
            limits: lim,
          });
          const pieces = planPieces(plan);
          for (const r of input) expect(uncovered(r, pieces)).toEqual([]);
          for (let i = 1; i < pieces.length; i++) {
            // Ascending and disjoint within a span; spans come in address order.
            expect(pieces[i].address).toBeGreaterThanOrEqual(
              pieces[i - 1].address + pieces[i - 1].size,
            );
          }
          expect(plan.size).toBe(pieces.reduce((sum, p) => sum + p.size, 0));
        },
      ),
    );
  });

  it("respects the transport's limits and never crosses a ROM or SRAM page", () => {
    fc.assert(
      fc.property(ranges, gap, smallLimits, (input, gapSize, lim) => {
        const plan = planReads(input, { gap: gapSize, limits: lim });
        for (const request of plan.requests) {
          const count = request.pieces.length / 2;
          if (count > 1) {
            expect(count).toBeLessThanOrEqual(lim.maxPieces);
            for (let i = 1; i < request.pieces.length; i += 2) {
              expect(request.pieces[i]).toBeLessThanOrEqual(lim.maxPieceSize);
            }
          } else {
            expect(request.pieces[1]).toBeLessThanOrEqual(
              Math.max(lim.maxSingleSize, lim.maxPieceSize),
            );
          }
        }
        for (const piece of planPieces(plan)) {
          const region = pakRegion(piece.address);
          expect(region).toBe(pakRegion(piece.address + piece.size - 1));
          if (region?.name === "rom" || region?.name === "sram") {
            const page = Math.floor(piece.address / PAGE_SIZE);
            expect(
              Math.floor((piece.address + piece.size - 1) / PAGE_SIZE),
            ).toBe(page);
          }
        }
      }),
    );
  });

  it("reads no barrier byte that no range covers, and bridges at most `gap` bytes", () => {
    fc.assert(
      fc.property(ranges, gap, barriers, (input, gapSize, bars) => {
        const plan = planReads(input, { barriers: bars, gap: gapSize, limits });
        for (const piece of planPieces(plan)) {
          for (const hole of uncovered(piece, input)) {
            expect(hole.size).toBeLessThanOrEqual(gapSize);
            expect(bars.some((bar) => overlaps(bar, hole))).toBe(false);
          }
        }
      }),
    );
  });

  it("merges into the fewest spans the gap and barriers allow", () => {
    fc.assert(
      fc.property(ranges, gap, barriers, (input, gapSize, bars) => {
        expectFewestSpans(input, gapSize, bars);
      }),
    );
  });

  it("splits ranges contiguous across WRAM and VRAM into two spans", () => {
    // Seed -1517002536 found it: 0xF6FF00 + 256 = 0xF70000, no gap between them,
    // yet the FX Pak Pro regions differ, so merging them would be wrong.
    expectFewestSpans(
      [
        { address: 0xf6_ff00, size: 256 },
        { address: 0xf7_0000, size: 16 },
      ],
      0,
      [],
    );
  });

  it("places each range at its offset in the plan buffer", () => {
    fc.assert(
      fc.property(ranges, gap, smallLimits, (input, gapSize, lim) => {
        const plan = planReads(input, { gap: gapSize, limits: lim });
        // Simulate the transport: fill the buffer from a memory image.
        const image = (address: number) =>
          (address * 7 + (address >> 8)) & 0xff;
        const buffer = new Uint8Array(plan.size);
        for (const request of plan.requests) {
          let at = request.offset;
          for (let i = 0; i < request.pieces.length; i += 2) {
            for (let b = 0; b < request.pieces[i + 1]; b++)
              buffer[at++] = image(request.pieces[i] + b);
          }
        }
        const misplaced = input.filter((r, index) => {
          for (let b = 0; b < r.size; b++) {
            if (buffer[plan.rangeOffsets[index] + b] !== image(r.address + b))
              return true;
          }
          return false;
        });
        expect(misplaced).toEqual([]);
      }),
    );
  });

  it("sends a lone span whole, even past QUsb2Snes's 255-byte piece limit", () => {
    const plan = planReads([{ address: 0xf5_f000, size: 0x501 }], {
      gap: 16,
      limits,
    });
    expect(plan.requests).toHaveLength(1);
    expect(Array.from(plan.requests[0].pieces)).toEqual([0xf5_f000, 0x501]);
  });

  it("cuts several spans into 255-byte pieces of one request", () => {
    const plan = planReads(
      [
        { address: 0xf5_f000, size: 0x300 },
        { address: 0xf5_0010, size: 1 },
      ],
      { gap: 16, limits },
    );
    expect(plan.requests).toHaveLength(1);
    expect(Array.from(plan.requests[0].pieces)).toEqual([
      0xf5_0010, 1, 0xf5_f000, 255, 0xf5_f0ff, 255, 0xf5_f1fe, 255, 0xf5_f2fd,
      3,
    ]);
  });

  it("does not bridge a barrier, and does not merge across regions", () => {
    const plan = planReads(
      [
        { address: 0xf5_f340, size: 0x1c },
        { address: 0xf5_f364, size: 0x10 },
      ],
      { barriers: [{ address: 0xf5_f35c, size: 4 }], gap: 16, limits },
    );
    expect(planPieces(plan)).toEqual([
      { address: 0xf5_f340, size: 0x1c },
      { address: 0xf5_f364, size: 0x10 },
    ]);
    const touching = planReads(
      [
        { address: 0xdf_fff0, size: 0x10 },
        { address: 0xe0_0000, size: 0x10 },
      ],
      { gap: 16, limits },
    );
    expect(planPieces(touching)).toHaveLength(2);
    // WRAM to VRAM: no page cut there, so only the region rule separates them.
    const near = planReads(
      [
        { address: 0xf6_fff0, size: 0x10 },
        { address: 0xf7_0008, size: 0x08 },
      ],
      { gap: 16, limits },
    );
    expect(planPieces(near)).toEqual([
      { address: 0xf6_fff0, size: 0x10 },
      { address: 0xf7_0008, size: 0x08 },
    ]);
  });

  it("returns the empty plan for no ranges", () => {
    expect(planReads([], { gap: 0, limits }).requests).toEqual([]);
  });
});
