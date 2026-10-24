import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { useNow } from "@/hooks/useNow";
import { formatTime, TIMER_WORDS, timerMs, timerState } from "@/utils/runTimer";

/**
 * The chest counters' 3×5 font, by character: "#" is one font pixel. What
 * `formatTime` writes uses nothing else.
 */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  ":": [".", "#", ".", "#", "."],
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###", "..#", "###", "#..", "###"],
  "3": ["###", "..#", ".##", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "###", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", "..#", "..#", "..#"],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "###"],
};

/**
 * Sizes in game pixels, the units of the drawing. A cell is a 16 px sprite;
 * the counters draw each font pixel as 2 game pixels, from the 4th row down,
 * inside a dark edge, a gold line and a dark margin.
 */
const CELL = 16;
const FONT_PIXEL = 2;
const TOP = 3;
const FRAME = 3;

/** Each font pixel of `text` as one path, and the drawing's width. */
export const pixelText = (text: string): { d: string; width: number } => {
  const squares: string[] = [];
  let x = FRAME;
  for (const char of text) {
    const glyph = GLYPHS[char];
    if (glyph === undefined) continue;
    glyph.forEach((line, row) => {
      [...line].forEach((pixel, col) => {
        if (pixel !== "#") return;
        const left = x + col * FONT_PIXEL;
        const top = TOP + row * FONT_PIXEL;
        squares.push(
          `M${left} ${top}h${FONT_PIXEL}v${FONT_PIXEL}h-${FONT_PIXEL}z`,
        );
      });
    });
    x += (glyph[0].length + 1) * FONT_PIXEL;
  }
  return { d: squares.join(""), width: x - FONT_PIXEL + FRAME };
};

/**
 * The stream view's run timer (`&timer=1`), drawn as the chest counters
 * are: their pixel font on their dark, gold-lined frame, so it sits with the
 * grid on stream. Its height is one cell, which keeps every pixel whole
 * wherever the grid's are; white while it runs, grey while paused, gold once
 * the goal stopped it. It follows the tracker through storage, and redraws
 * once a second while running.
 */
export const StreamTimer = () => {
  const timer = useGameStore((state) => state.timer);
  const state = timerState(timer);
  const now = useNow(state === "running");
  const time = formatTime(timerMs(timer, now));
  const { d, width } = pixelText(time);

  return (
    <svg
      aria-label={`Run timer: ${time}, ${TIMER_WORDS[state]}`}
      className={`stream-timer stream-timer--${state}`}
      data-testid="stream-timer"
      role="img"
      shapeRendering="crispEdges"
      viewBox={`0 0 ${width} ${CELL}`}
    >
      <rect className="stream-timer__edge" height={CELL} width={width} />
      <rect
        className="stream-timer__line"
        height={CELL - 2}
        width={width - 2}
        x={1}
        y={1}
      />
      <rect
        className="stream-timer__edge"
        height={CELL - 4}
        width={width - 4}
        x={2}
        y={2}
      />
      <path className="stream-timer__digits" d={d} />
    </svg>
  );
};
