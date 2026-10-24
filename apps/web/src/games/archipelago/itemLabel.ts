// How an item's name reads on screen. AP's SMZ3 world names its items by
// TotalSMZ3's C# enum (`HeartPiece`, `BombUpgrade5`, `ProgressiveSword`):
// identifiers, not words. For such a world the name is shown split into
// words; AP's exact name stays the data everywhere (the run, the overlay's
// ids, the skins' matching) and the element's title. Super Metroid's and A
// Link to the Past's names read as text already (AP 0.6.8's name data,
// itemLabel.spec.ts) and are shown as they are.

/** The worlds whose item names are identifiers, as the room names them. */
const IDENTIFIER_WORLDS: ReadonlySet<string> = new Set(["SMZ3"]);

/**
 * An identifier in words: split where a lowercase letter meets a capital
 * or a digit, where capitals meet a capitalised word ("XRay" → "X Ray"),
 * and where a digit meets a letter. "CardNorfairL1" → "Card Norfair L1".
 */
export const wordsOf = (name: string): string =>
  name
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/([0-9])([A-Za-z])/g, "$1 $2");

/**
 * An item's name as shown: in words for a world that names its items as
 * identifiers, else as AP gives it.
 * @param game - The item's world; unknown, the name as given
 */
export const itemLabel = (game: string | undefined, name: string): string =>
  game !== undefined && IDENTIFIER_WORLDS.has(game) ? wordsOf(name) : name;
