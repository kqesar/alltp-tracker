import { type ArtFailure, TILE, type TileKind } from "@alltp/pack-alttpr";
import {
  memo,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  KIND_NAMES,
  kindsIn,
  pathOf,
  roomWords,
} from "@/games/alttpr/autotrack/darkRoom";
import {
  DarkRoomArt,
  LinkMarker,
} from "@/games/alttpr/components/map/DarkRoomArt";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";
import {
  type DarkRoomMap,
  useDarkRoomStore,
} from "@/games/alttpr/stores/darkRoomStore";
import "@/games/alttpr/components/map/darkRoom.css";

/** A stroke or fill from the tokens (`--dark-room-*` in variables.css). */
const token = (name: string) => `var(--dark-room-${name})`;

const floor = <rect fill={token("floor")} height="1" width="1" />;
const grid = (
  <rect
    fill="none"
    height="1"
    stroke={token("floor-edge")}
    strokeOpacity="0.35"
    strokeWidth="0.06"
    width="1"
  />
);

/** A door's slab, with the mark that tells which door. */
const slab = (mark: ReactNode) => (
  <>
    {floor}
    <rect
      fill={token("door")}
      height="1"
      stroke={token("wall")}
      strokeWidth="0.1"
      width="1"
    />
    {mark}
  </>
);

/** What one tile of each kind is drawn as: a shape each, never a colour alone. */
const PICTURES: Readonly<Record<TileKind, ReactNode>> = {
  [TILE.block]: (
    <>
      {floor}
      <rect
        fill={token("object")}
        height="0.76"
        stroke={token("wall")}
        strokeWidth="0.08"
        width="0.76"
        x="0.12"
        y="0.12"
      />
      <rect
        fill="none"
        height="0.36"
        stroke={token("wall")}
        strokeWidth="0.07"
        width="0.36"
        x="0.32"
        y="0.32"
      />
    </>
  ),
  [TILE.bigKeyLock]: (
    <>
      {floor}
      <rect
        fill={token("chest")}
        height="0.76"
        stroke={token("wall")}
        strokeWidth="0.08"
        width="0.76"
        x="0.12"
        y="0.12"
      />
      <circle cx="0.5" cy="0.5" fill={token("wall")} r="0.16" />
    </>
  ),
  [TILE.chest]: (
    <>
      {floor}
      <rect
        fill={token("chest")}
        height="0.76"
        stroke={token("wall")}
        strokeWidth="0.08"
        width="0.88"
        x="0.06"
        y="0.12"
      />
      <path d="M0.06 0.4h0.88" stroke={token("wall")} strokeWidth="0.08" />
    </>
  ),
  [TILE.chestOpen]: (
    <>
      {floor}
      <rect
        fill="none"
        height="0.76"
        stroke={token("chest")}
        strokeDasharray="0.2 0.1"
        strokeWidth="0.12"
        width="0.88"
        x="0.06"
        y="0.12"
      />
    </>
  ),
  [TILE.conveyor]: (
    <>
      {floor}
      <path
        d="M0.2 0.7L0.5 0.3L0.8 0.7"
        fill="none"
        stroke={token("object")}
        strokeWidth="0.12"
      />
    </>
  ),
  [TILE.door]: slab(null),
  [TILE.doorBomb]: slab(
    <path
      d="M0.2 0.1L0.6 0.4L0.3 0.6L0.8 0.9"
      fill="none"
      stroke={token("wall")}
      strokeWidth="0.1"
    />,
  ),
  [TILE.doorKey]: slab(
    <>
      <circle cx="0.5" cy="0.4" fill={token("wall")} r="0.18" />
      <path d="M0.5 0.4V0.85" stroke={token("wall")} strokeWidth="0.12" />
    </>,
  ),
  [TILE.doorShutter]: slab(
    <path
      d="M0 0.25H1M0 0.5H1M0 0.75H1"
      stroke={token("wall")}
      strokeWidth="0.09"
    />,
  ),
  [TILE.doorway]: (
    <>
      {floor}
      <rect
        fill="none"
        height="0.6"
        stroke={token("floor-edge")}
        strokeWidth="0.08"
        width="0.6"
        x="0.2"
        y="0.2"
      />
    </>
  ),
  [TILE.exit]: (
    <>
      <rect fill={token("exit")} height="1" width="1" />
      <path
        d="M0.2 0.35L0.5 0.7L0.8 0.35"
        fill="none"
        stroke={token("wall")}
        strokeWidth="0.14"
      />
    </>
  ),
  [TILE.floor]: (
    <>
      {floor}
      {grid}
    </>
  ),
  [TILE.hazard]: (
    <>
      {floor}
      <path
        d="M0.1 0.9L0.3 0.2L0.5 0.9L0.7 0.2L0.9 0.9Z"
        fill={token("hazard")}
      />
    </>
  ),
  [TILE.ice]: (
    <>
      <rect fill={token("ice")} height="1" width="1" />
      <path
        d="M0 0.6L0.6 0M0.4 1L1 0.4"
        stroke={token("floor")}
        strokeWidth="0.1"
      />
    </>
  ),
  [TILE.ledge]: (
    <>
      {floor}
      <path d="M0 0.88H1" stroke={token("floor-edge")} strokeWidth="0.24" />
    </>
  ),
  [TILE.object]: (
    <>
      {floor}
      <path
        d="M0.5 0.1L0.9 0.5L0.5 0.9L0.1 0.5Z"
        fill={token("object")}
        stroke={token("wall")}
        strokeWidth="0.07"
      />
    </>
  ),
  [TILE.peg]: (
    <>
      {floor}
      <circle
        cx="0.5"
        cy="0.5"
        fill={token("object")}
        r="0.2"
        stroke={token("wall")}
        strokeWidth="0.07"
      />
    </>
  ),
  [TILE.pit]: (
    <>
      <rect fill={token("pit")} height="1" width="1" />
      <path
        d="M0.25 0.25L0.75 0.75M0.75 0.25L0.25 0.75"
        stroke={token("floor-edge")}
        strokeWidth="0.08"
      />
    </>
  ),
  [TILE.pot]: (
    <>
      {floor}
      <circle
        cx="0.5"
        cy="0.5"
        fill={token("object")}
        r="0.34"
        stroke={token("wall")}
        strokeWidth="0.07"
      />
    </>
  ),
  [TILE.slope]: (
    <>
      <rect fill={token("wall")} height="1" width="1" />
      <path d="M0 1L1 0" stroke={token("floor-edge")} strokeWidth="0.14" />
    </>
  ),
  [TILE.stairs]: (
    <>
      {floor}
      <path
        d="M0 0.2H1M0 0.5H1M0 0.8H1"
        stroke={token("stairs")}
        strokeWidth="0.14"
      />
    </>
  ),
  [TILE.torchLit]: (
    <>
      {floor}
      <path
        d="M0.5 0.08C0.85 0.4 0.8 0.92 0.5 0.92C0.2 0.92 0.15 0.4 0.5 0.08Z"
        fill={token("torch")}
        stroke={token("wall")}
        strokeWidth="0.06"
      />
    </>
  ),
  [TILE.torchUnlit]: (
    <>
      {floor}
      <path
        d="M0.5 0.08C0.85 0.4 0.8 0.92 0.5 0.92C0.2 0.92 0.15 0.4 0.5 0.08Z"
        fill="none"
        stroke={token("torch")}
        strokeDasharray="0.2 0.1"
        strokeWidth="0.14"
      />
    </>
  ),
  [TILE.unknown]: (
    <>
      {floor}
      <circle
        cx="0.5"
        cy="0.5"
        fill="none"
        r="0.3"
        stroke={token("floor-edge")}
        strokeDasharray="0.12 0.1"
        strokeWidth="0.09"
      />
    </>
  ),
  [TILE.wall]: <rect fill={token("wall")} height="1" width="1" />,
  [TILE.water]: (
    <>
      <rect fill={token("water")} height="1" width="1" />
      <path
        d="M0 0.4Q0.25 0.15 0.5 0.4T1 0.4M0 0.8Q0.25 0.55 0.5 0.8T1 0.8"
        fill="none"
        stroke={token("ice")}
        strokeWidth="0.09"
      />
    </>
  ),
};

/** The tiles, drawn once per change of the room, not as Link walks. */
const Tiles = memo(function Tiles({
  ids,
  map,
}: {
  ids: string;
  map: DarkRoomMap;
}) {
  const { bounds, kinds } = map;
  const present = useMemo(() => kindsIn(kinds, bounds), [kinds, bounds]);
  const paths = useMemo(
    () =>
      present
        .filter((kind) => kind !== TILE.wall)
        .map((kind) => [kind, pathOf(kinds, bounds, kind)] as const),
    [present, kinds, bounds],
  );
  return (
    <>
      <defs>
        {present.map((kind) => (
          <pattern
            height="1"
            id={`${ids}-${kind}`}
            key={kind}
            patternUnits="userSpaceOnUse"
            width="1"
          >
            {PICTURES[kind]}
          </pattern>
        ))}
      </defs>
      <rect
        fill={token("wall")}
        height={bounds.y1 - bounds.y0 + 1}
        width={bounds.x1 - bounds.x0 + 1}
        x={bounds.x0}
        y={bounds.y0}
      />
      {paths.map(([kind, d]) => (
        <path
          d={d}
          data-kind={kind}
          fill={`url(#${ids}-${kind})`}
          key={kind}
          shapeRendering="crispEdges"
        />
      ))}
    </>
  );
});

/** How long the sentence keeps still while Link walks, for the one who hears it. */
const SETTLE_MS = 1500;

/**
 * `value`, at most once every `SETTLE_MS`: the first at once, a run of changes
 * as one, the last after the wait.
 */
const useSettled = (value: string): string => {
  const [settled, setSettled] = useState(value);
  const last = useRef(0);
  useEffect(() => {
    if (value === settled) return;
    const wait = Math.max(0, last.current + SETTLE_MS - Date.now());
    const timer = setTimeout(() => {
      last.current = Date.now();
      setSettled(value);
    }, wait);
    return () => clearTimeout(timer);
  }, [value, settled]);
  return settled;
};

/**
 * The sentence under the plan: the one polite live region of the panel, which
 * a screen reader hears when it has settled, not at every step Link takes.
 */
const Words = () => {
  const map = useDarkRoomStore((state) => state.map);
  const link = useDarkRoomStore((state) => state.link);
  const words = useSettled(map && link ? roomWords(map, link) : "");
  return (
    <p className="dark-room__words" data-testid="dark-room-words" role="status">
      {words}
    </p>
  );
};

/** What the art's marks mean: shapes, not colours alone. */
const ArtLegend = () => (
  <ul aria-label="Legend" className="dark-room__legend">
    <li data-testid="dark-room-legend-chest">
      <svg aria-hidden="true" className="dark-room__swatch" viewBox="0 0 4 4">
        <rect
          className="dark-room__chest-ring"
          height="3"
          rx="0.7"
          width="3"
          x="0.5"
          y="0.5"
        />
      </svg>
      Unopened chest
    </li>
    <li data-testid="dark-room-legend-nearest">
      <svg aria-hidden="true" className="dark-room__swatch" viewBox="0 0 4 4">
        <rect
          className="dark-room__chest-ring"
          height="3"
          rx="0.7"
          width="3"
          x="0.5"
          y="0.5"
        />
        <rect
          className="dark-room__chest-pulse dark-room__chest-pulse--still"
          height="3"
          rx="0.7"
          width="3"
          x="0.5"
          y="0.5"
        />
      </svg>
      Nearest one
    </li>
    <li data-testid="dark-room-legend-charge">
      <svg
        aria-hidden="true"
        className="dark-room__swatch"
        viewBox="-2.4 -2.4 4.8 4.8"
      >
        <circle
          className="dark-room__charge dark-room__charge--charged"
          r="1.8"
        />
      </svg>
      Sword charged (dashed: charging)
    </li>
  </ul>
);

/** Why the plan shows though the style is the game's graphics. */
const FALLBACK: Readonly<Record<ArtFailure, string>> = {
  "other-base-patch":
    "Shown as a plan: this ROM's graphics are not laid out as the tracker reads them.",
  "read-failed":
    "Shown as a plan: your ROM's graphics could not be read just now; trying again.",
  "unknown-graphics":
    "Shown as a plan: this room's graphics could not be rebuilt from your ROM.",
  unreadable:
    "Shown as a plan: your console's graphics could not be read; the plan stays for this ROM.",
};

/**
 * A dark room, with Link's place in it: shown by the map panel while the game
 * is in a room that is dark and he has no Lamp (autotracking, outside Race
 * Mode, with the "Dark room map" option on). In the "Game art" style, the room
 * as the game would draw it lit, Link as the game draws him and the unopened
 * chests ringed; as a plan otherwise, while the graphics load, or when they
 * cannot be rebuilt. A picture with a name, a sentence for the nearest chest,
 * and a legend. Nothing here is saved, shared or followed (`darkRoomStore.ts`).
 */
export const DarkRoomPanel = () => {
  const map = useDarkRoomStore((state) => state.map);
  const picture = useDarkRoomStore((state) => state.picture);
  const art = useDarkRoomStore((state) => state.art);
  const style = useAutotrackStore((state) => state.darkRoomStyle);
  const ids = useId().replaceAll(":", "");
  const legend = useMemo(
    () => (map === null ? [] : kindsIn(map.kinds, map.bounds)),
    [map],
  );
  const titleId = `${ids}-title`;
  const headingId = `${ids}-heading`;
  if (map === null) return null;
  const drawn =
    style === "art" && picture !== null && picture.room === map.room
      ? picture
      : null;
  const { bounds } = map;
  const width = bounds.x1 - bounds.x0 + 1;
  const height = bounds.y1 - bounds.y0 + 1;
  return (
    <section
      aria-labelledby={headingId}
      className="dark-room"
      data-testid="dark-room"
    >
      <div className="dark-room__head">
        <h2 className="dark-room__title" id={headingId}>
          Dark room
        </h2>
        <p className="dark-room__room" data-testid="dark-room-id">
          Room {map.room.toString(16).toUpperCase().padStart(3, "0")}
          {map.layer === 1 ? ", lower level" : ""}
        </p>
      </div>
      {drawn !== null ? (
        <DarkRoomArt map={map} picture={drawn} />
      ) : (
        <svg
          aria-labelledby={titleId}
          className="dark-room__plan"
          data-testid="dark-room-plan"
          role="img"
          style={{ aspectRatio: `${width} / ${height}` }}
          viewBox={`${bounds.x0} ${bounds.y0} ${width} ${height}`}
        >
          <title id={titleId}>
            Plan of the dark room, seen from above, with your position as a ring
            and an arrow the way you face
          </title>
          <Tiles ids={ids} map={map} />
          <LinkMarker drawn={false} />
        </svg>
      )}
      <Words />
      {drawn !== null ? (
        <ArtLegend />
      ) : (
        <ul aria-label="Legend" className="dark-room__legend">
          {legend.map((kind) => (
            <li data-testid={`dark-room-legend-${kind}`} key={kind}>
              <svg
                aria-hidden="true"
                className="dark-room__swatch"
                viewBox="0 0 1 1"
              >
                <rect fill={`url(#${ids}-${kind})`} height="1" width="1" />
                <rect
                  fill="none"
                  height="0.96"
                  stroke={token("floor-edge")}
                  strokeWidth="0.04"
                  width="0.96"
                  x="0.02"
                  y="0.02"
                />
              </svg>
              {KIND_NAMES[kind]}
            </li>
          ))}
        </ul>
      )}
      <p className="dark-room__note" data-testid="dark-room-note">
        {drawn !== null
          ? "Drawn lit from your own console and ROM while this room is dark and you have no Lamp; kept on this page only. Never in Race Mode."
          : style === "art" && art.status === "unavailable"
            ? `${FALLBACK[art.reason]} Never in Race Mode.`
            : "Drawn from the game's own collision map while this room is dark and you have no Lamp. Never in Race Mode."}
      </p>
    </section>
  );
};

export default DarkRoomPanel;
