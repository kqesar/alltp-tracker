import { itemLabels } from "@/data/items";

/**
 * Icons whose meaning is not the item their file is named after. The rest
 * name an item outright (`boots.png` → "Pegasus Boots").
 */
const ICON_LABELS: Record<string, string> = {
  agahnim0: "Agahnim",
  bomb: "Bombs",
  bottle0: "Bottle",
  bow2: "Bow",
  crystal0: "Crystal",
  glove1: "Power Glove",
  glove2: "Titan's Mitt",
  medallion0: "Unknown medallion",
  medallion1: "Bombos",
  medallion2: "Ether",
  medallion3: "Quake",
  pendant0: "Pendant of Courage",
  pendant1: "Pendant of Power",
  pendant2: "Pendant of Wisdom",
  sword2: "Master Sword",
};

/** Matches the inline icons `icon()` (src/data/logic.ts) writes into names. */
const ICON_TAG = /<img\s+src=['"][^'"]*?([a-z]+\d*)\.png['"][^>]*>/gi;

/**
 * The words a screen reader should hear for an icon file stem.
 * @param stem - The asset name without extension, e.g. "glove2"
 */
export const iconLabel = (stem: string): string =>
  ICON_LABELS[stem] ?? itemLabels(stem.replace(/\d+$/, ""));

/**
 * A location caption as plain text: every inline icon replaced by the name
 * of what it stands for.
 * @param caption - A chest or dungeon name, which may hold `<img>` icons
 */
export const captionToText = (caption: string): string =>
  caption
    .replace(ICON_TAG, (_, stem: string) => ` ${iconLabel(stem)} `)
    .replace(/\s+/g, " ")
    .replace(/\s+([),/])/g, "$1")
    .replace(/([(/])\s+/g, "$1")
    .trim();
