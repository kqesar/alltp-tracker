import { parseUserAgent } from "@alltp/autotrack";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeVisibility, GRANTED, ManualClock } from "@/autotrack/fixtures";
import {
  RomSeedLine,
  RomSeedNotice,
} from "@/components/autotrack/RomSeedNotice";
import { seedMemory } from "@/games/alttpr/autotrack/fixtures";
import { forgetSeedFiles } from "@/games/alttpr/autotrack/seedFile";
import { SeedPrompt } from "@/games/alttpr/components/autotrack/SeedPrompt";
import {
  alttprRomSeed,
  connectAutotrack,
  setAutotrackOptions,
  stopAutotrack,
  useAutotrackStore,
} from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { MemoryTransport } from "../../../../../packages/autotrack/test/memory-transport";
import { writeSeedSettings } from "../../../../../packs/alttpr/test/seed-rom";

const MESSAGE =
  "The game runs seed 0yAObedRMV, not this run's seed 9MQ9gO1wMD: the board does not follow it. Start a new run from this ROM, or follow this ROM on this run.";

const game = () => useGameStore.getState();

/**
 * A run of 9MQ9gO1wMD with the flute marked, and a session connected to a
 * keysanity ROM of 0yAObedRMV (another seed, of another run type too) in
 * play, holding the Hookshot and Link's House checked. alttpr.com cannot be
 * reached, so its run type is the ROM's settings'.
 */
const readOtherSeed = async (race = false) => {
  act(() => {
    game().applyRun("open", game().settings, () => ({ seed: "9MQ9gO1wMD" }));
    game().handleItemClick("flute");
  });
  const memory = writeSeedSettings(seedMemory({ name: "0yAObedRMV", race }), {
    dungeonItems: "full",
  });
  const clock = new ManualClock();
  setAutotrackOptions({
    clock,
    permission: GRANTED,
    random: () => 0,
    transport: () => new MemoryTransport(memory, {}),
    visibility: new FakeVisibility(),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
  await act(() => connectAutotrack());
  await act(() => clock.advance(0));
  if (!race) {
    await vi.waitFor(() =>
      expect(useAutotrackStore.getState().seedFile?.result).toBe("offline"),
    );
  }
};

beforeEach(() => {
  localStorage.clear();
  act(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    useAutotrackStore.setState(useAutotrackStore.getInitialState(), true);
    useAutotrackStore.setState({
      environment: parseUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
      ),
    });
  });
});

afterEach(() => {
  act(() => stopAutotrack());
  setAutotrackOptions({});
  forgetSeedFiles();
  vi.unstubAllGlobals();
});

describe("RomSeedNotice", () => {
  it("stays an empty live region until a ROM of another seed is read", async () => {
    render(<RomSeedNotice romSeed={alttprRomSeed} />);
    const notice = screen.getByTestId("rom-seed-notice");
    expect(notice).toHaveAttribute("role", "status");
    expect(notice).toBeEmptyDOMElement();

    await readOtherSeed();

    expect(notice).toHaveTextContent(MESSAGE);
    // Nothing of it reached the run
    expect(game().items.hookshot).toBe(false);
    expect(screen.getByTestId("rom-seed-new-run")).toHaveAccessibleName(
      "New run",
    );
    expect(screen.getByTestId("rom-seed-follow")).toHaveAccessibleName(
      "Follow this ROM",
    );
  });

  it("says nothing once the session is no longer connected", async () => {
    render(<RomSeedNotice romSeed={alttprRomSeed} />);
    await readOtherSeed();
    act(() => stopAutotrack());

    expect(screen.getByTestId("rom-seed-notice")).toBeEmptyDOMElement();
  });

  it("asks nothing of the other seed's run type", async () => {
    render(<SeedPrompt />);
    await readOtherSeed();

    expect(screen.getByTestId("seed-prompt")).toBeEmptyDOMElement();
  });

  it("starts a new run of the ROM, which one undo takes back whole", async () => {
    const user = userEvent.setup();
    render(<RomSeedNotice romSeed={alttprRomSeed} />);
    await readOtherSeed();

    await user.click(screen.getByTestId("rom-seed-new-run"));

    // The new run follows the ROM: its seed, its run type, its game
    expect(game()).toMatchObject({ presetId: "keysanity", seed: "0yAObedRMV" });
    expect(game().items).toMatchObject({ flute: false, hookshot: true });
    expect(screen.getByTestId("rom-seed-notice")).toBeEmptyDOMElement();

    // One step, and the run replaced comes back with nothing of the ROM
    act(() => game().undo());
    expect(game()).toMatchObject({ presetId: "open", seed: "9MQ9gO1wMD" });
    expect(game().items).toMatchObject({ flute: true, hookshot: false });
    expect(game().checked["links-house"]).toBeUndefined();
    expect(screen.getByTestId("rom-seed-notice")).toHaveTextContent(MESSAGE);
  });

  it("follows this ROM on the run, its marks kept, as a step one undo takes back", async () => {
    const user = userEvent.setup();
    render(
      <>
        <RomSeedNotice romSeed={alttprRomSeed} />
        <SeedPrompt />
      </>,
    );
    await readOtherSeed();

    await user.click(screen.getByTestId("rom-seed-follow"));

    expect(game().seed).toBe("0yAObedRMV");
    expect(game().items).toMatchObject({ flute: true, hookshot: true });
    expect(screen.getByTestId("rom-seed-notice")).toBeEmptyDOMElement();
    // Its run type is now held against the board's, as any seed's
    expect(screen.getByTestId("seed-prompt")).toHaveTextContent(
      /^This seed is Keysanity/,
    );

    // A misclick is one undo away: the run's seed, nothing of the ROM
    act(() => game().undo());
    expect(game().seed).toBe("9MQ9gO1wMD");
    expect(game().items).toMatchObject({ flute: true, hookshot: false });
    expect(game().checked["links-house"]).toBeUndefined();
    expect(screen.getByTestId("rom-seed-notice")).toHaveTextContent(MESSAGE);
  });
});

describe("RomSeedLine", () => {
  it("says the ROM is another seed's, with the two answers", async () => {
    const user = userEvent.setup();
    render(<RomSeedLine romSeed={alttprRomSeed} />);
    await readOtherSeed();

    expect(screen.getByTestId("autotrack-rom-seed")).toHaveTextContent(MESSAGE);
    await user.click(screen.getByTestId("autotrack-rom-seed-follow"));
    expect(useGameStore.getState().seed).toBe("0yAObedRMV");
    expect(screen.queryByTestId("autotrack-rom-seed")).toBeNull();
  });

  it("says Race Mode keeps the check off, with no answer to give", async () => {
    render(<RomSeedLine romSeed={alttprRomSeed} />);
    await readOtherSeed(true);

    expect(screen.getByTestId("autotrack-rom-seed")).toHaveTextContent(
      "Race Mode: the tracker does not check that the game is this run's seed.",
    );
    expect(screen.queryByTestId("autotrack-rom-seed-follow")).toBeNull();
  });

  it("says nothing for a run that knows no seed", async () => {
    render(<RomSeedLine romSeed={alttprRomSeed} />);
    await readOtherSeed();
    act(() => useGameStore.setState({ seed: null }));

    expect(screen.queryByTestId("autotrack-rom-seed")).toBeNull();
  });
});
