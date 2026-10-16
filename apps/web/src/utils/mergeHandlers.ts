/** `A | B | C` → `A & B & C`: every prop of every part. */
type Intersect<U> = (U extends unknown ? (part: U) => void : never) extends (
  part: infer I,
) => void
  ? I
  : never;

/**
 * Combines several prop objects for one element. Event handlers (`on*`) that
 * more than one object defines are chained in order instead of the last one
 * silently replacing the others; any other prop is taken from the last object.
 * @param parts - Prop objects, e.g. from useGridFocusable and useTooltip
 */
export const mergeHandlers = <T extends object[]>(
  ...parts: T
): Intersect<T[number]> => {
  const merged: Record<string, unknown> = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      const previous = merged[key];
      merged[key] =
        key.startsWith("on") &&
        typeof previous === "function" &&
        typeof value === "function"
          ? (...args: unknown[]) => {
              previous(...args);
              value(...args);
            }
          : value;
    }
  }
  return merged as Intersect<T[number]>;
};
