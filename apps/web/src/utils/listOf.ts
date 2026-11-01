/** Words joined as a sentence lists them: "A", "A and B", "A, B and C". */
export const listOf = (items: readonly string[]): string =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
