import { commandKey } from "@/utils/platform";

/** What `copyText` did: the text is on the clipboard, or the player copies it. */
export type CopyResult = "copied" | "manual";

/**
 * Put text on the clipboard. Where the Clipboard API is missing or refuses
 * (a page served over plain http, a denied permission), `select` selects the
 * text on screen so the older copy command can take it, or the player's own
 * Ctrl/Cmd+C; without `select`, there is nothing to fall back on.
 * @param select - Selects the text where it is shown; the page then waits for
 * the player's copy if the command refuses
 */
export const copyText = async (
  text: string,
  select?: () => void,
): Promise<CopyResult> => {
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    if (!select) return "manual";
    select();
    return document.execCommand?.("copy") ? "copied" : "manual";
  }
};

/** What to tell the player about a copy. */
export const copyStatus = (result: CopyResult): string =>
  result === "copied" ? "Copied." : `Press ${commandKey()}+C to copy.`;
