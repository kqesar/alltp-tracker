import { ROOM_PX, type SpriteImage } from "@alltp/pack-alttpr";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { nearestChest } from "@/games/alttpr/autotrack/darkRoom";
import {
  type DarkRoomMap,
  type DarkRoomPicture,
  useDarkRoomStore,
} from "@/games/alttpr/stores/darkRoomStore";

/** Pixels of a tile. */
const TILE = 8;

/** The room's box in pixels, from its box in tiles. */
const boxOf = (map: DarkRoomMap) => ({
  height: (map.bounds.y1 - map.bounds.y0 + 1) * TILE,
  width: (map.bounds.x1 - map.bounds.x0 + 1) * TILE,
  x: map.bounds.x0 * TILE,
  y: map.bounds.y0 * TILE,
});

/**
 * The largest whole factor the picture fits at, so every game pixel is a
 * square of screen pixels; below 1 (a big room on a phone), the fraction that
 * fits, as no whole one does.
 */
export const scaleFor = (
  width: number,
  height: number,
  room: { readonly width: number; readonly height: number },
): number => {
  const fit = Math.min(width / room.width, height / room.height);
  return fit >= 1 ? Math.floor(fit) : fit;
};

/** The space the picture may take: the panel's width, half the window's height. */
const useRoom = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState({ height: 416, width: 576 });
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const measure = () => {
      const width = Math.min(element.clientWidth || 576, 576);
      const height = Math.min(window.innerHeight * 0.5, 416);
      setSpace((before) =>
        before.width === width && before.height === height
          ? before
          : { height, width },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, space };
};

/**
 * The room's pixels inside its box, then Link's sprite laid over them where
 * it draws, into the canvas: one `putImageData` per change, a few hundred
 * thousand pixels at most.
 */
const draw = (
  canvas: HTMLCanvasElement,
  picture: DarkRoomPicture,
  box: ReturnType<typeof boxOf>,
  sprite: SpriteImage | null,
) => {
  const context = canvas.getContext("2d");
  if (context === null) return;
  const image = context.createImageData(box.width, box.height);
  const out = new Uint32Array(image.data.buffer);
  for (let y = 0; y < box.height; y++) {
    const from = (box.y + y) * ROOM_PX + box.x;
    out.set(picture.background.subarray(from, from + box.width), y * box.width);
  }
  if (sprite !== null) {
    for (let y = 0; y < sprite.height; y++) {
      const py = sprite.y + y - box.y;
      if (py < 0 || py >= box.height) continue;
      for (let x = 0; x < sprite.width; x++) {
        const px = sprite.x + x - box.x;
        const value = sprite.pixels[y * sprite.width + x];
        if (px < 0 || px >= box.width || value === 0) continue;
        out[py * box.width + px] = value;
      }
    }
  }
  context.putImageData(image, 0, 0);
};

/** How far, in pixels, Link's sprite may lie from his footprint. */
const SPRITE_SLACK = 24;

/**
 * Link's sprite, if it lies where his footprint says he is: the screen shows
 * him where the camera put him, and the camera can lag his position (a room
 * transition, a position the game was told). Off from it, the marker shows
 * instead of a sprite drawn in the wrong place.
 */
export const linkSprite = (
  sprite: SpriteImage | null,
  link: { readonly x: number; readonly y: number } | null,
): SpriteImage | null => {
  if (sprite === null || link === null) return null;
  const dx = sprite.x + sprite.width / 2 - (link.x + 1) * TILE;
  const dy = sprite.y + sprite.height / 2 - (link.y + 1) * TILE;
  return Math.abs(dx) <= SPRITE_SLACK && Math.abs(dy) <= SPRITE_SLACK
    ? sprite
    : null;
};

/** Unopened chests ringed, the nearest one called out: they must be seen first. */
const Chests = memo(function Chests({
  chests,
  nearest,
}: {
  chests: DarkRoomMap["chests"];
  nearest: number | null;
}) {
  return (
    <>
      {chests.map((chest, index) => {
        const callout = index === nearest;
        const key = `${chest.x0}-${chest.y0}`;
        const box = {
          height: chest.y1 - chest.y0 + 2.2,
          rx: 0.7,
          width: chest.x1 - chest.x0 + 2.2,
          x: chest.x0 - 0.6,
          y: chest.y0 - 0.6,
        };
        return (
          <g
            className={`dark-room__chest${callout ? " dark-room__chest--nearest" : ""}`}
            data-testid={`dark-room-chest-${index}`}
            key={key}
          >
            <rect {...box} className="dark-room__chest-shade" />
            <rect {...box} className="dark-room__chest-ring" />
            {callout && (
              <rect
                {...box}
                className="dark-room__chest-pulse"
                data-testid="dark-room-nearest-chest"
              />
            )}
          </g>
        );
      })}
    </>
  );
});

/** The angle of an arrow pointing the way Link faces, up at 0. */
const ANGLE = { down: 180, left: 270, right: 90, up: 0 } as const;

/**
 * Link's marker over a picture or a plan: a ring around his footprint while
 * the sword charges (dashed) or is charged (whole), and, when no sprite of
 * his is drawn, the plan's ring with an arrow the way he faces.
 */
export const LinkMarker = ({ drawn }: { drawn: boolean }) => {
  const link = useDarkRoomStore((state) => state.link);
  if (link === null) return null;
  const charge = link.charge;
  const facing = link.facing;
  return (
    <g
      className="dark-room__link"
      data-charge={charge}
      data-facing={facing ?? undefined}
      data-testid="dark-room-link"
      style={{ transform: `translate(${link.x}px, ${link.y}px)` }}
    >
      {!drawn && (
        <>
          <rect
            className="dark-room__link-shade"
            height="2.3"
            rx="0.6"
            width="2.3"
            x="-0.15"
            y="-0.15"
          />
          <rect
            className="dark-room__link-ring"
            height="2.3"
            rx="0.6"
            width="2.3"
            x="-0.15"
            y="-0.15"
          />
          <circle className="dark-room__link-dot" cx="1" cy="1" r="0.34" />
          {facing !== null && (
            <path
              className="dark-room__link-arrow"
              d="M1 -1.15L1.7 -0.25H0.3Z"
              data-testid="dark-room-facing"
              transform={`rotate(${ANGLE[facing]} 1 1)`}
            />
          )}
        </>
      )}
      {charge !== "none" && (
        <circle
          className={`dark-room__charge dark-room__charge--${charge}`}
          cx="1"
          cy="1"
          data-testid="dark-room-charge"
          r="2.1"
        />
      )}
    </g>
  );
};

/**
 * The dark room in the game's own graphics, cropped to the part worth
 * showing and scaled by a whole factor, with Link as the game draws him, and
 * over it the unopened chests ringed and his sword's charge. One picture with
 * a name for a screen reader; the sentence under it says what it shows.
 */
export const DarkRoomArt = ({
  map,
  picture,
}: {
  map: DarkRoomMap;
  picture: DarkRoomPicture;
}) => {
  const drawn = useDarkRoomStore((state) => state.sprite);
  const link = useDarkRoomStore((state) => state.link);
  const sprite = linkSprite(drawn, link);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useMemo(() => boxOf(map), [map]);
  const { ref, space } = useRoom();
  const scale = scaleFor(space.width, space.height, box);
  useEffect(() => {
    if (canvas.current !== null) draw(canvas.current, picture, box, sprite);
  }, [picture, box, sprite]);
  const nearest =
    link === null ? null : (nearestChest(map.chests, link)?.index ?? null);
  const { bounds } = map;
  const tilesWide = bounds.x1 - bounds.x0 + 1;
  const tilesHigh = bounds.y1 - bounds.y0 + 1;
  return (
    <div className="dark-room__art" ref={ref}>
      {/* The frame takes the width, never more than the panel's; the canvas
          fills it at its own proportions */}
      <div
        className="dark-room__frame"
        style={{ width: `${box.width * scale}px` }}
      >
        <canvas
          aria-label="The dark room drawn lit in the game's graphics, seen from above, with you in it and its unopened chests ringed"
          className={`dark-room__canvas${scale >= 1 ? " dark-room__canvas--crisp" : ""}`}
          data-scale={scale >= 1 ? scale : undefined}
          data-testid="dark-room-art"
          height={box.height}
          ref={canvas}
          role="img"
          style={{ aspectRatio: `${box.width} / ${box.height}` }}
          width={box.width}
        />
        <svg
          aria-hidden="true"
          className="dark-room__overlay"
          viewBox={`${bounds.x0} ${bounds.y0} ${tilesWide} ${tilesHigh}`}
        >
          <Chests chests={map.chests} nearest={nearest} />
          <LinkMarker drawn={sprite !== null} />
        </svg>
      </div>
    </div>
  );
};
