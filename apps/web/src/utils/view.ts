import { ITEMS_PER_ROW } from "@/constants";

/**
 * Which page the tracker shows, picked by the query string so it works on
 * static hosting: `?view=obs` is the stream view, the item grid alone for an
 * OBS browser source; anything else is the full tracker.
 */
const VIEW_PARAM = "view";
const OBS_VIEW = "obs";

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

/**
 * The address of the stream view for this deployment of the tracker.
 * @param options - Whether it draws the run timer under the grid
 * @param page - The address of the current page
 */
export const obsViewUrl = (
  { timer = false }: { timer?: boolean } = {},
  page: string = window.location.href,
): string => {
  const url = new URL(trackerUrl(page));
  url.searchParams.set(VIEW_PARAM, OBS_VIEW);
  if (timer) url.searchParams.set(TIMER_PARAM, "1");
  return url.href;
};

/** Grid columns: seven cells and the two half cells at its sides. */
const GRID_COLUMNS = ITEMS_PER_ROW + 1;

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
 * @param viewport - Its size in CSS px, the grid's row count, and the device pixel ratio
 */
export const fitObsGrid = ({
  width,
  height,
  rows,
  pixelRatio = 1,
}: {
  width: number;
  height: number;
  rows: number;
  pixelRatio?: number;
}): GridFit => {
  const room =
    Math.min(width / GRID_COLUMNS, height / Math.max(rows, 1)) * pixelRatio;
  const crisp = Math.floor(room / SPRITE_PIXELS) * SPRITE_PIXELS;
  const even = Math.floor(room / 2) * 2;
  const cell = Math.max(2, crisp >= room * (1 - MAX_CRISP_LOSS) ? crisp : even);
  const offset = (space: number, cells: number) =>
    Math.max(0, Math.floor((space * pixelRatio - cells * cell) / 2)) /
    pixelRatio;

  return {
    cell: cell / pixelRatio,
    left: offset(width, GRID_COLUMNS),
    top: offset(height, rows),
  };
};
