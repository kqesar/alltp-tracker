// The byte-level pieces of a packed link: base64url, and the unsigned and
// signed varints that fields are written with. Pure, no DOM but `btoa`.

/** The base64url alphabet, which needs no escaping in a fragment. */
export const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** Bytes as base64url, no padding. */
export const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x2000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x2000));
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

/** The bytes of a base64url text; throws on text that is not one. */
export const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

/** The largest magnitude a field writes: 2^50, far above any epoch in ms. */
export const MAX_FIELD_NUMBER = 2 ** 50;

/** The most bytes one varint may take: 8 hold 56 bits, above 2^53. */
const MAX_VARINT_BYTES = 8;

/** Whether a value is a whole number a varint holds, zero or more. */
export const isCount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= MAX_FIELD_NUMBER;

/** Whether a value is a whole number a signed varint holds. */
export const isSigned = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  Math.abs(value) <= MAX_FIELD_NUMBER;

/** Signed to unsigned, small magnitudes small: 0, -1, 1, -2 become 0, 1, 2, 3. */
export const zigzag = (value: number): number =>
  value >= 0 ? value * 2 : -value * 2 - 1;

/** The signed number a zigzag stands for. */
export const unzigzag = (value: number): number =>
  value % 2 === 0 ? value / 2 : -(value + 1) / 2;

/** Bytes gathered a varint at a time (7 bits each, low first). */
export class ByteWriter {
  private readonly bytes: number[] = [];

  /** Append an unsigned whole number (checked by `isCount`). */
  uint(value: number): void {
    let rest = value;
    while (rest >= 128) {
      this.bytes.push((rest % 128) | 128);
      rest = Math.floor(rest / 128);
    }
    this.bytes.push(rest);
  }

  /** Append a signed whole number (checked by `isSigned`). */
  int(value: number): void {
    this.uint(zigzag(value));
  }

  done(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/**
 * Bytes read back a varint at a time. Each read returns null where the bytes
 * cannot be what a writer wrote: they run out, a varint is too long or too
 * big, so a hostile field costs a check and never a loop without end.
 */
export class ByteReader {
  private at = 0;

  constructor(private readonly bytes: Uint8Array) {}

  /** The next unsigned number, or null. */
  uint(): number | null {
    let value = 0;
    for (let i = 0; i < MAX_VARINT_BYTES; i++) {
      if (this.at >= this.bytes.length) return null;
      const byte = this.bytes[this.at++];
      value += (byte % 128) * 2 ** (7 * i);
      if (byte < 128) return value <= MAX_FIELD_NUMBER * 2 ? value : null;
    }
    return null;
  }

  /** The next signed number, or null. */
  int(): number | null {
    const value = this.uint();
    return value === null ? null : unzigzag(value);
  }

  /** Whether every byte has been read. */
  get done(): boolean {
    return this.at === this.bytes.length;
  }

  /** Every byte not read yet, which are then taken as read. */
  rest(): Uint8Array {
    const rest = this.bytes.subarray(this.at);
    this.at = this.bytes.length;
    return rest;
  }
}

/** Bits gathered most significant first, the last byte padded with zeros. */
export class BitWriter {
  private readonly bytes: number[] = [];
  private used = 8;

  private bit(on: boolean): void {
    if (this.used === 8) {
      this.bytes.push(0);
      this.used = 0;
    }
    if (on) this.bytes[this.bytes.length - 1] |= 0x80 >> this.used;
    this.used++;
  }

  /** Append a whole number in `width` bits (it must fit them). */
  bits(value: number, width: number): void {
    for (let at = width - 1; at >= 0; at--) {
      this.bit(Math.floor(value / 2 ** at) % 2 === 1);
    }
  }

  /** Append a whole number as a Rice code: its top in unary, its `k` low bits as they are. */
  rice(value: number, k: number): void {
    const top = Math.floor(value / 2 ** k);
    for (let i = 0; i < top; i++) this.bit(true);
    this.bit(false);
    this.bits(value - top * 2 ** k, k);
  }

  done(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/** The bits of a `BitWriter`, read back; null where they run out. */
export class BitReader {
  private at = 0;

  constructor(private readonly bytes: Uint8Array) {}

  private bit(): boolean | null {
    const byte = this.bytes[this.at >> 3];
    if (byte === undefined) return null;
    return (byte & (0x80 >> (this.at++ & 7))) !== 0;
  }

  /** The next `width` bits as a number, or null. */
  bits(width: number): number | null {
    let value = 0;
    for (let i = 0; i < width; i++) {
      const on = this.bit();
      if (on === null) return null;
      value = value * 2 + (on ? 1 : 0);
    }
    return value;
  }

  /** The next Rice code of parameter `k`, or null (it runs out, or is above `max`). */
  rice(k: number, max: number): number | null {
    let top = 0;
    for (;;) {
      const on = this.bit();
      if (on === null) return null;
      if (!on) break;
      top++;
      if (top * 2 ** k > max) return null;
    }
    const low = this.bits(k);
    if (low === null) return null;
    const value = top * 2 ** k + low;
    return value <= max ? value : null;
  }

  /** Whether the bits left are the zeros that pad the last byte, no more. */
  get padded(): boolean {
    const left = this.bytes.length * 8 - this.at;
    if (left >= 8) return false;
    while (this.at < this.bytes.length * 8) if (this.bit()) return false;
    return true;
  }
}
