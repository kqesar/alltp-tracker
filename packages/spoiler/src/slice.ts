import { MAX_SLICE_DEPTH } from "./limits";
import { accept, refuse, type SpoilerResult } from "./result";

const QUOTE = 34;
const BACKSLASH = 92;
const OPEN_BRACE = 123;
const CLOSE_BRACE = 125;
const OPEN_BRACKET = 91;
const CLOSE_BRACKET = 93;
const COMMA = 44;
const COLON = 58;

/** `skipValue` and `stringEnd` answer a failure with one of these instead of an index. */
const TRUNCATED = -1;
const TOO_DEEP = -2;

/** Index just past the string whose opening quote sits at `open`, or TRUNCATED. */
function stringEnd(text: string, open: number): number {
  let quote = text.indexOf('"', open + 1);
  while (quote !== -1) {
    // A quote closes the string unless an odd run of backslashes escapes it.
    let slashes = 0;
    while (text.charCodeAt(quote - 1 - slashes) === BACKSLASH) slashes++;
    if (slashes % 2 === 0) return quote + 1;
    quote = text.indexOf('"', quote + 1);
  }
  return TRUNCATED;
}

function isSpace(code: number): boolean {
  return code === 32 || code === 10 || code === 13 || code === 9;
}

function skipSpaces(text: string, from: number): number {
  let i = from;
  while (isSpace(text.charCodeAt(i))) i++;
  return i;
}

/**
 * Index just past the value that starts at `start`, or a failure. Strings
 * are skipped whole, so a bracket inside one counts for nothing; brackets
 * are counted by depth, not matched by kind: the slicer finds where a value
 * ends in a document that is valid JSON, it does not validate what it skips.
 */
function skipValue(text: string, start: number): number {
  const first = text.charCodeAt(start);
  if (first === QUOTE) return stringEnd(text, start);
  if (first !== OPEN_BRACE && first !== OPEN_BRACKET) {
    // A number, true, false or null: up to the next delimiter.
    let i = start;
    for (; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (
        c === COMMA ||
        c === CLOSE_BRACE ||
        c === CLOSE_BRACKET ||
        isSpace(c)
      ) {
        break;
      }
    }
    return i === start ? TRUNCATED : i;
  }
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === QUOTE) {
      const end = stringEnd(text, i);
      if (end === TRUNCATED) return TRUNCATED;
      i = end - 1;
    } else if (c === OPEN_BRACE || c === OPEN_BRACKET) {
      if (++depth > MAX_SLICE_DEPTH) return TOO_DEEP;
    } else if (c === CLOSE_BRACE || c === CLOSE_BRACKET) {
      if (--depth === 0) return i + 1;
    }
  }
  return TRUNCATED;
}

function malformed(detail: string) {
  return refuse("not-a-spoiler", detail);
}

function parseOrNull(json: string): { value: unknown } | null {
  try {
    return { value: JSON.parse(json) };
  } catch {
    return null;
  }
}

/**
 * Reads only the wanted top-level keys of a JSON object, skipping every
 * other value without building it. Map Rando's spoiler is 21 MB of which the
 * tracker needs 40 KB: a full `JSON.parse` of it costs about twice the time
 * and 34 MB of heap, the slice a third of the time and the 40 KB.
 *
 * Bounded: nothing recurses, nesting past `MAX_SLICE_DEPTH` is refused, and
 * every failure (not an object, truncated, unterminated string, a kept value
 * that is not JSON) is a `not-a-spoiler` refusal, never a throw. A key that
 * appears twice keeps its last value, as `JSON.parse` does; a wanted key that
 * is absent is absent from the result.
 */
export function sliceTopLevel<K extends string>(
  text: string,
  keys: readonly K[],
): SpoilerResult<Partial<Record<K, unknown>>> {
  const wanted = new Set<string>(keys);
  // No prototype: a wanted key named `__proto__` is data, not a setter.
  const out: Partial<Record<K, unknown>> = Object.create(null);
  let i = skipSpaces(text, 0);
  if (text.charCodeAt(i) !== OPEN_BRACE) {
    return malformed("not a JSON object");
  }
  i = skipSpaces(text, i + 1);
  if (text.charCodeAt(i) === CLOSE_BRACE) {
    return skipSpaces(text, i + 1) === text.length
      ? accept(out)
      : malformed("text after the object");
  }
  for (;;) {
    if (text.charCodeAt(i) !== QUOTE) return malformed("expected a key");
    const keyEnd = stringEnd(text, i);
    if (keyEnd === TRUNCATED) return malformed("unterminated string");
    let key = text.slice(i + 1, keyEnd - 1);
    if (key.includes("\\")) {
      const decoded = parseOrNull(text.slice(i, keyEnd));
      if (decoded === null) return malformed("bad key");
      key = decoded.value as string;
    }
    i = skipSpaces(text, keyEnd);
    if (text.charCodeAt(i) !== COLON) return malformed("expected a colon");
    i = skipSpaces(text, i + 1);
    const end = skipValue(text, i);
    if (end === TOO_DEEP) return malformed("nested too deep");
    if (end === TRUNCATED) return malformed("truncated");
    if (wanted.has(key)) {
      const parsed = parseOrNull(text.slice(i, end));
      if (parsed === null) return malformed(`${key} is not JSON`);
      out[key as K] = parsed.value;
    }
    i = skipSpaces(text, end);
    const next = text.charCodeAt(i);
    if (next === CLOSE_BRACE) {
      return skipSpaces(text, i + 1) === text.length
        ? accept(out)
        : malformed("text after the object");
    }
    if (next !== COMMA) return malformed("truncated");
    i = skipSpaces(text, i + 1);
  }
}
