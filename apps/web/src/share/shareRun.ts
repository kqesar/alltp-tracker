// The Share action of every game's toolbar: the run's export becomes an
// address, which goes to the clipboard. The link and what the player is told
// of the copy go to the share dialog, which also shows the link as a QR code.

import { encodeRun, RunLinkError, runLinkUrl } from "@/share/runLink";
import { shareBaseUrl } from "@/utils/view";

/**
 * The most characters of a link every chat app takes whole: Discord cuts a
 * message at 2000, Slack, Telegram and the like allow more. A link above it
 * is still a link (browsers take hundreds of kilobytes), but is warned of.
 */
export const CHAT_LINK_CHARS = 2000;

/** What the Share button says of itself: the one line of help. */
export const SHARE_HELP =
  "Copy a link to this run and show it as a QR code. The run travels in the link's fragment (after the #), which the browser never sends to any server.";

export type Link = { url: string; fallback: boolean };

/**
 * How a share went: the line to tell the player, and the link that was made
 * (`null` when none could be: the line then says why).
 */
export type ShareResult = { link: Link | null; message: string };

const REFUSED =
  "The link could not be copied: this browser refused the clipboard.";

/**
 * The link of a run, from its exports best first (each a save the game's
 * import reads): the first that fits a chat message, else the last, the
 * shortest. `fallback` says it is not the first.
 */
export const makeLink = async (saves: readonly string[]): Promise<Link> => {
  let link: Link = { fallback: false, url: "" };
  for (const [index, save] of saves.entries()) {
    link = {
      fallback: index > 0,
      url: runLinkUrl(shareBaseUrl(), await encodeRun(save)),
    };
    if (link.url.length <= CHAT_LINK_CHARS) break;
  }
  return link;
};

/**
 * Put the link on the clipboard. The text is handed over as a promise, so
 * Safari, which wants the copy inside the click, still has it while the
 * run compresses; a browser without that copies the text once it is there.
 */
const copy = async (link: Promise<Link>) => {
  if (typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": link.then(
            ({ url }) => new Blob([url], { type: "text/plain" }),
          ),
        }),
      ]);
      return;
    } catch {
      // Not allowed this way (an older WebView): the plain copy below tries
    }
  }
  await navigator.clipboard.writeText((await link).url);
};

/** The line that says a link was copied, and what to watch for in it. */
const copiedMessage = ({ fallback, url }: Link): string => {
  const long = url.length > CHAT_LINK_CHARS;
  if (fallback) {
    return long
      ? `Link copied without the timeline, but still long (${url.length} characters): some chat apps will cut it.`
      : "Link copied without the timeline, to keep it short.";
  }
  return long
    ? `Link copied, but long (${url.length} characters): some chat apps will cut it.`
    : "Link copied. The run stays in the link, never sent to a server.";
};

/**
 * Copy a link to a run, and say how it went. Call it inside the click: the
 * copy starts before the first `await`.
 * @param saves - The run's exports, the most complete first; later ones are
 *   what is left out when the first would be too long for a chat message
 * @returns The link made (it is still worth showing when the clipboard
 *   refused) and a line for the share dialog
 */
export const shareRun = async (
  saves: readonly string[],
): Promise<ShareResult> => {
  const made = makeLink(saves);
  const copied = copy(made);
  try {
    await copied;
  } catch (error) {
    return error instanceof RunLinkError
      ? { link: null, message: error.message }
      : { link: await made, message: REFUSED };
  }
  const link = await made;
  return { link, message: copiedMessage(link) };
};

/**
 * Copy a link again, from the click of a button, and say how it went.
 * @returns A line for the share dialog
 */
export const copyLink = async (link: Link): Promise<string> => {
  try {
    await navigator.clipboard.writeText(link.url);
  } catch {
    return REFUSED;
  }
  return copiedMessage(link);
};
