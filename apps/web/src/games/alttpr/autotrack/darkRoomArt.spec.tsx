// The dark room in the game's graphics, through the real session over an
// in-memory console whose ROM and WRAM are synthetic (`putDarkRoomArt`).
import { bus, parseUserAgent, TransportError } from "@alltp/autotrack";
import { MEMORY_RANGE } from "@alltp/pack-alttpr";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeVisibility, GRANTED, ManualClock } from "@/autotrack/fixtures";
import {
  putDarkRoom,
  putDarkRoomArt,
  seedMemory,
} from "@/games/alttpr/autotrack/fixtures";
import { AutotrackDialog } from "@/games/alttpr/components/autotrack/AutotrackDialog";
import {
  linkSprite,
  scaleFor,
} from "@/games/alttpr/components/map/DarkRoomArt";
import { MapPanel } from "@/games/alttpr/components/map/MapPanel";
import {
  connectAutotrack,
  setAutotrackOptions,
  stopAutotrack,
  useAutotrackStore,
} from "@/games/alttpr/stores/autotrackStore";
import { useDarkRoomStore } from "@/games/alttpr/stores/darkRoomStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { MemoryTransport } from "../../../../../../packages/autotrack/test/memory-transport";
import links from "../../../../../../packs/alttpr/test/dark-room/links-house.json";

/** The ROM's guard, which the picture reads first: never in Race Mode. */
const GUARD_AT = bus(0x00_e7cf);

const harness = ({
  race = false,
  art = true,
}: {
  race?: boolean;
  art?: boolean;
} = {}) => {
  const memory = putDarkRoom(seedMemory({ race }), links);
  if (art) putDarkRoomArt(memory);
  const clock = new ManualClock();
  const transports: MemoryTransport[] = [];
  /** While set, a read of the ROM's guard fails, as a timeout would. */
  const failing = { rom: false };
  setAutotrackOptions({
    clock,
    permission: GRANTED,
    random: () => 0,
    transport: () => {
      const transport = new MemoryTransport(memory, {
        read: (pieces) =>
          failing.rom && pieces.some(([a]) => a === GUARD_AT)
            ? new TransportError("device", "read", "no")
            : undefined,
      });
      transports.push(transport);
      return transport;
    },
    visibility: new FakeVisibility(),
  });
  /** Ticks until the picture's on-demand reads have come back. */
  const settle = async () => {
    for (let i = 0; i < 6; i++) await act(() => clock.advance(250));
  };
  const touched = (address: number, size = 1) =>
    transports
      .flatMap((t) => t.pieces)
      .filter(([a, n]) => a < address + size && address < a + n).length;
  return { clock, failing, memory, settle, touched };
};

const store = () => useDarkRoomStore.getState();

beforeEach(() => {
  localStorage.clear();
  // jsdom draws no canvas: a 2D context that keeps what it was given
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        createImageData: (width: number, height: number) => ({
          data: new Uint8ClampedArray(width * height * 4),
          height,
          width,
        }),
        putImageData: vi.fn(),
      }) as unknown as CanvasRenderingContext2D,
  );
  act(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    useAutotrackStore.setState(useAutotrackStore.getInitialState(), true);
    useAutotrackStore.setState({
      environment: parseUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
      ),
    });
    useDarkRoomStore.getState().show(null);
  });
});

afterEach(() => {
  act(() => stopAutotrack());
  vi.restoreAllMocks();
});

describe("the dark room in the game's graphics", () => {
  it("draws the room from the console and ROM, Link in it, as one named picture", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.settle();
    expect(store().art).toEqual({ status: "ready" });
    expect(store().picture?.room).toBe(0x104);
    // The synthetic sheets' stripes in the synthetic palette: gold
    // (colour 15: red 31, green 25, blue 0)
    expect((store().picture?.background[0] ?? 0) >>> 0).toBe(0xff_00_ce_ff);
    expect(store().sprite).toMatchObject({
      height: 16,
      width: 16,
      x: 320,
      y: 344,
    });

    render(<MapPanel />);
    const panel = await screen.findByTestId("dark-room");
    const art = within(panel).getByTestId("dark-room-art");
    expect(art).toHaveAttribute("role", "img");
    expect(art).toHaveAccessibleName(/drawn lit in the game's graphics/);
    expect(within(panel).queryByTestId("dark-room-plan")).toBeNull();
    expect(within(panel).getByTestId("dark-room-legend-chest")).toBeVisible();
    expect(within(panel).getByTestId("dark-room-note")).toHaveTextContent(
      /from your own console and ROM/,
    );
    // Drawn at a whole factor: every game pixel a square
    expect(Number(art.dataset.scale)).toBeGreaterThanOrEqual(1);
    // Still one live region: the sentence
    expect(within(panel).getAllByRole("status")).toHaveLength(1);
    // Link drawn as the game draws him: no marker of ours, no arrow
    expect(within(panel).queryByTestId("dark-room-facing")).toBeNull();
  });

  it("rings the unopened chests, the nearest called out", async () => {
    const h = harness();
    // Two chests on the floor, as the game's collision map holds them
    const map = MEMORY_RANGE["dark-room-map"].address;
    for (const [x, y, value] of [
      [44, 46, 0x58],
      [52, 46, 0x59],
    ]) {
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        h.memory[map + (y + dy) * 64 + x + dx] = value;
      }
    }
    await act(() => connectAutotrack());
    await h.settle();
    const { unmount } = render(<MapPanel />);
    const panel = await screen.findByTestId("dark-room");
    expect(within(panel).getByTestId("dark-room-chest-0")).toBeInTheDocument();
    expect(within(panel).getByTestId("dark-room-chest-1")).toBeInTheDocument();
    // The nearest to Link (tiles 40-41 by 44-45): the first
    expect(
      within(within(panel).getByTestId("dark-room-chest-0")).getByTestId(
        "dark-room-nearest-chest",
      ),
    ).toBeInTheDocument();
    expect(
      within(panel).getAllByTestId("dark-room-nearest-chest"),
    ).toHaveLength(1);
    unmount();
  });

  it("shows the plan while a read of the ROM fails, then the picture once it works again", async () => {
    const h = harness();
    h.failing.rom = true;
    await act(() => connectAutotrack());
    await h.settle();
    expect(store().art).toEqual({
      reason: "read-failed",
      status: "unavailable",
    });
    render(<MapPanel />);
    expect(await screen.findByTestId("dark-room-note")).toHaveTextContent(
      /could not be read just now/,
    );
    // Tried again after the pause, Link standing still
    h.failing.rom = false;
    await act(() => h.clock.advance(5000));
    await h.settle();
    expect(store().art).toEqual({ status: "ready" });
    expect(await screen.findByTestId("dark-room-art")).toBeInTheDocument();
  });

  it("reads nothing of the picture, nor the ROM's graphics, in Race Mode", async () => {
    const h = harness({ race: true });
    await act(() => connectAutotrack());
    await h.settle();
    expect(store().picture).toBeNull();
    expect(h.touched(GUARD_AT, 15)).toBe(0);
    const oam = MEMORY_RANGE["dark-room-art-sprites"];
    expect(h.touched(oam.address, oam.size)).toBe(0);
  });

  it("reads none of its memory in the Plan style", async () => {
    useAutotrackStore.setState({ darkRoomStyle: "plan" });
    const h = harness();
    await act(() => connectAutotrack());
    await h.settle();
    expect(store().map).not.toBeNull();
    expect(store().picture).toBeNull();
    expect(h.touched(GUARD_AT, 15)).toBe(0);
    const bg2 = MEMORY_RANGE["dark-room-art-bg2"];
    expect(h.touched(bg2.address, bg2.size)).toBe(0);
    render(<MapPanel />);
    expect(await screen.findByTestId("dark-room-plan")).toBeInTheDocument();
  });

  it("shows the plan, saying why, for a ROM whose code is not the one expected", async () => {
    const h = harness({ art: false });
    await act(() => connectAutotrack());
    await h.settle();
    expect(store().art).toEqual({
      reason: "other-base-patch",
      status: "unavailable",
    });
    render(<MapPanel />);
    const panel = await screen.findByTestId("dark-room");
    expect(within(panel).getByTestId("dark-room-plan")).toBeInTheDocument();
    expect(within(panel).getByTestId("dark-room-note")).toHaveTextContent(
      /Shown as a plan: this ROM's graphics/,
    );
  });

  it("switches to the plan and back from the Autotracking dialog", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.settle();
    render(
      <>
        <AutotrackDialog onClose={() => {}} />
        <MapPanel />
      </>,
    );
    const styles = screen.getByTestId("dark-room-style");
    expect(styles).toHaveAccessibleName("Dark room map style");
    const plan = within(styles).getByRole("radio", { name: "Plan" });
    await userEvent.click(plan);
    expect(useAutotrackStore.getState().darkRoomStyle).toBe("plan");
    expect(store().picture).toBeNull();
    expect(await screen.findByTestId("dark-room-plan")).toBeInTheDocument();
    // Back to the game's art: read and drawn again
    await userEvent.click(
      within(styles).getByRole("radio", { name: "Game art" }),
    );
    await h.settle();
    expect(await screen.findByTestId("dark-room-art")).toBeInTheDocument();
    // Off with the map itself
    await userEvent.click(screen.getByTestId("autotrack-dark-room"));
    expect(styles).toBeDisabled();
  });

  it("never saves the picture, and lets it go with the session", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.settle();
    expect(store().picture).not.toBeNull();
    act(() => stopAutotrack());
    expect(store().picture).toBeNull();
    expect(store().sprite).toBeNull();
    const saved = Object.keys(localStorage)
      .map((key) => localStorage.getItem(key) ?? "")
      .join("");
    expect(saved).not.toMatch(/background|sprite|picture/);
  });
});

describe("showArt", () => {
  const outcome = (pixel: number, version = 1) => ({
    art: {
      background: new Uint32Array(4),
      link: {
        height: 1,
        pixels: Uint32Array.of(pixel),
        width: 1,
        x: 3,
        y: 4,
      },
      room: 0x55,
      version,
    },
    status: "ready" as const,
  });

  it("keeps the picture and the sprite while they draw the same", () => {
    act(() => store().showArt(outcome(7)));
    const { picture, sprite } = store();
    act(() => store().showArt(outcome(7)));
    expect(store().picture).toBe(picture);
    expect(store().sprite).toBe(sprite);
    act(() => store().showArt(outcome(8)));
    expect(store().picture).toBe(picture);
    expect(store().sprite).not.toBe(sprite);
    act(() => store().showArt(outcome(8, 2)));
    expect(store().picture).not.toBe(picture);
  });
});

describe("linkSprite", () => {
  const sprite = {
    height: 24,
    pixels: new Uint32Array(16 * 24),
    width: 16,
    x: 376,
    y: 376,
  };

  it("keeps the sprite on Link's footprint, and leaves one the camera lags", () => {
    // Footprint (47, 48): its middle at (384, 392), the sprite's at (384, 388)
    expect(linkSprite(sprite, { x: 47, y: 48 })).toBe(sprite);
    // Link told to stand ten tiles away, the camera left where it was
    expect(linkSprite(sprite, { x: 57, y: 48 })).toBeNull();
    expect(linkSprite(null, { x: 47, y: 48 })).toBeNull();
    expect(linkSprite(sprite, null)).toBeNull();
  });
});

describe("scaleFor", () => {
  it("takes the largest whole factor that fits, a fraction only below 1", () => {
    expect(scaleFor(576, 416, { height: 128, width: 128 })).toBe(3);
    expect(scaleFor(576, 416, { height: 100, width: 300 })).toBe(1);
    expect(scaleFor(300, 416, { height: 200, width: 400 })).toBe(0.75);
  });
});
