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

/**
 * A run's link. `full` is the first, most complete one when `url` is a
 * shorter form of it (ALttPR's leaves out the timeline to fit a chat
 * message), null when `url` is that first one: the player may still copy it.
 */
export type Link = { url: string; full: string | null };

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
 * shortest, with the first kept as `full`.
 */
export const makeLink = async (saves: readonly string[]): Promise<Link> => {
  let first: string | null = null;
  let url = "";
  for (const save of saves) {
    url = runLinkUrl(shareBaseUrl(), await encodeRun(save));
    first ??= url;
    if (url.length <= CHAT_LINK_CHARS) break;
  }
  return { full: url === first ? null : first, url };
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
const copiedMessage = ({ full, url }: Link): string => {
  const long = url.length > CHAT_LINK_CHARS;
  if (full !== null) {
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
 * A link to the run, made with no copy: for a dialog that was open when Race
 * Mode went off, where no click is at hand to copy inside. The player copies
 * it with the dialog's button.
 * @param saves - As for `shareRun`
 */
export const snapshotRun = async (
  saves: readonly string[],
): Promise<ShareResult> => {
  try {
    const link = await makeLink(saves);
    return {
      link,
      message: `The link is ready: copy it with the button below. ${
        link.full !== null
          ? "It leaves out the timeline, to keep it short."
          : "The run stays in the link, never sent to a server."
      }`,
    };
  } catch (error) {
    if (error instanceof RunLinkError) {
      return { link: null, message: error.message };
    }
    throw error;
  }
};

/** Copy `url` from the click of a button: `line` once it is copied. */
const copyFromClick = async (url: string, line: string): Promise<string> => {
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    return REFUSED;
  }
  return line;
};

/**
 * Copy a link again, from the click of a button, and say how it went.
 * @returns A line for the share dialog
 */
export const copyLink = (link: Link): Promise<string> =>
  copyFromClick(link.url, copiedMessage(link));

/**
 * Copy a shortened link's full form (`Link.full`), the one with the timeline
 * that a review of the run reads, and say how it went. It is the one too long
 * for a chat message.
 * @returns A line for the share dialog
 */
export const copyFullLink = (full: string): Promise<string> =>
  copyFromClick(
    full,
    `Full link copied, with the timeline (${full.length} characters): some chat apps will cut it.`,
  );
