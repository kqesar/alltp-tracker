/**
 * Which page the tracker shows, picked by the query string so it works on
 * static hosting: `?view=obs` is the stream view, the item grid alone for an
 * OBS browser source; anything else is the full tracker.
 */
const VIEW_PARAM = "view";
const OBS_VIEW = "obs";

/**
 * `?view=follow&token=…`: a device following the desktop app's run live on
 * the local network, the page and its stream both served by the app.
 */
const FOLLOW_VIEW = "follow";

/**
 * Whether the page was opened to follow a run live (`?view=follow`).
 * @param search - The query string, `window.location.search` by default
 */
export const isFollowView = (
  search: string = window.location.search,
): boolean => new URLSearchParams(search).get(VIEW_PARAM) === FOLLOW_VIEW;

/**
 * The address of the run's stream for the followed view and the relayed
 * stream view: `/follow` on the host that served the page (the desktop app's
 * relay), with the link's token. Only the token is taken from the address, so
 * a link can never point the page at another host.
 * @param page - The address of the current page
 */
export const followSocketUrl = (
  page: string = window.location.href,
): string => {
  const address = new URL(page);
  const url = new URL("/follow", address);
  url.protocol = address.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", address.searchParams.get("token") ?? "");
  return url.href;
};

/** `&token=` names the desktop app's stream the view is served by. */
const TOKEN_PARAM = "token";

/**
 * Whether the page was opened as the stream view the desktop app serves to
 * OBS (`?view=obs&token=…`): the run comes from the app's relay, not from this
 * page's storage. A stream view with no token is the site's, following the
 * tracker through storage. An empty token still counts: the view then says
 * its address is out of date, rather than showing nothing.
 * @param search - The query string, `window.location.search` by default
 */
export const isRelayedObsView = (
  search: string = window.location.search,
): boolean => {
  const params = new URLSearchParams(search);
  return params.get(VIEW_PARAM) === OBS_VIEW && params.has(TOKEN_PARAM);
};

/** `&bg=` paints the stream view a solid colour, for window capture. */
const BACKGROUND_PARAM = "bg";

/** 3, 4, 6 or 8 hex digits (the last ones alpha), "#" optional. Nothing else. */
const HEX_COLOUR = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Whether the page was opened as the stream view (`?view=obs`).
 * @param search - The query string, `window.location.search` by default
 */
export const isObsView = (search: string = window.location.search): boolean =>
  new URLSearchParams(search).get(VIEW_PARAM) === OBS_VIEW;

/**
 * The stream view's solid background from `&bg=`, as a CSS hex colour, or
 * null when it is absent or anything but a hex colour. Only a value that
 * passed this check ever reaches a style.
 * @param search - The query string, `window.location.search` by default
 */
export const obsBackground = (
  search: string = window.location.search,
): string | null => {
  const digits = new URLSearchParams(search)
    .get(BACKGROUND_PARAM)
    ?.match(HEX_COLOUR)?.[1];
  return digits ? `#${digits.toLowerCase()}` : null;
};

/** `&timer=1` draws the run timer under the stream view's grid. */
const TIMER_PARAM = "timer";

/**
 * Whether the stream view draws the run timer under its grid (`&timer=1`).
 * @param search - The query string, `window.location.search` by default
 */
export const obsTimer = (search: string = window.location.search): boolean =>
  new URLSearchParams(search).get(TIMER_PARAM) === "1";

/** `&bridge=` names the port SNI listens on, when it is not the usual one. */
const BRIDGE_PARAM = "bridge";

/**
 * The autotracking bridge's address from `?bridge=<port>`: SNI or QUsb2Snes on
 * this computer at another port than 23074 (a bridge configured otherwise, the
 * browser tests' fake one). Only a port is taken, so a link can never point
 * the tracker at another machine. Undefined when absent or not a port.
 * @param search - The query string, `window.location.search` by default
 */
export const bridgeUrl = (
  search: string = window.location.search,
): string | undefined => {
  const port = new URLSearchParams(search).get(BRIDGE_PARAM) ?? "";
  if (!/^\d{1,5}$/.test(port)) return undefined;
  const number = Number(port);
  return number >= 1 && number <= 65_535
    ? `ws://localhost:${number}`
    : undefined;
};

/**
 * The address of the full tracker for this deployment, with no query string.
 * @param page - The address of the current page
 */
export const trackerUrl = (page: string = window.location.href): string =>
  new URL(import.meta.env.BASE_URL, page).href;

/** The published site: where a link made in the desktop app must point. */
export const SITE_URL = "https://kqesar.github.io/alltp-tracker/";

/**
 * The address a shared link opens: this deployment's, or the published
 * site's from the desktop app, whose own address (tauri://localhost) opens
 * nowhere else.
 */
export const shareBaseUrl = (): string =>
  import.meta.env.MODE === "desktop" ? SITE_URL : trackerUrl();

/**
 * The address of the stream view for this deployment of the tracker, or for
 * the desktop app's own server (`base`, `token`).
 * @param options - Whether it draws the run timer under the grid; and, for
 * the stream the desktop app serves, its address (`http://127.0.0.1:23076/`)
 * and the token that opens it
 * @param page - The address of the current page
 */
export const obsViewUrl = (
  {
    base,
    timer = false,
    token,
  }: { base?: string; timer?: boolean; token?: string } = {},
  page: string = window.location.href,
): string => {
  const url = new URL(base ?? trackerUrl(page));
  url.searchParams.set(VIEW_PARAM, OBS_VIEW);
  if (token !== undefined) url.searchParams.set(TOKEN_PARAM, token);
  if (timer) url.searchParams.set(TIMER_PARAM, "1");
  return url.href;
};

/**
 * Game pixels across a cell. The item icons are 16 px sprites stored at 4×
 * (64 px files): a cell that is a multiple of 16 device pixels draws every
 * game pixel the same whole number of pixels wide.
 */
const SPRITE_PIXELS = 16;

/** How much of the room the crisp size may give up before it is not worth it. */
const MAX_CRISP_LOSS = 1 / 8;

/** Where the stream view draws its grid: cell size and offset, in CSS px. */
export type GridFit = { cell: number; left: number; top: number };

/**
 * Size and centre the item grid in a viewport, aspect preserved. The cell is
 * the largest multiple of the sprite size that fits, so the pixel art scales
 * by a whole factor, unless that gives up more than an eighth of the room;
 * then it is the largest even number of pixels (even, so the half cells end
 * on a whole pixel too). Computed in device pixels, which are the ones that
 * must be whole, and returned in CSS pixels.
 * @param viewport - Its size in CSS px, the grid's columns (a half cell
 *   counting half) and rows, and the device pixel ratio
 */
export const fitObsGrid = ({
  width,
  height,
  columns,
  rows,
  pixelRatio = 1,
}: {
  width: number;
  height: number;
  columns: number;
  rows: number;
  pixelRatio?: number;
}): GridFit => {
  const room =
    Math.min(width / columns, height / Math.max(rows, 1)) * pixelRatio;
  const crisp = Math.floor(room / SPRITE_PIXELS) * SPRITE_PIXELS;
  const even = Math.floor(room / 2) * 2;
  const cell = Math.max(2, crisp >= room * (1 - MAX_CRISP_LOSS) ? crisp : even);
  const offset = (space: number, cells: number) =>
    Math.max(0, Math.floor((space * pixelRatio - cells * cell) / 2)) /
    pixelRatio;

  return {
    cell: cell / pixelRatio,
    left: offset(width, columns),
    top: offset(height, rows),
  };
};
