import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { STATUSES } from "@/autotrack/fixtures";
import {
  RomSeedLine,
  RomSeedNotice,
} from "@/components/autotrack/RomSeedNotice";
import { readingOf, seedMemory } from "@/games/alttpr/autotrack/fixtures";
import { SeedPrompt } from "@/games/alttpr/components/autotrack/SeedPrompt";
import {
  alttprRomSeed,
  useAutotrackStore,
} from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { writeSeedSettings } from "../../../../../packs/alttpr/test/seed-rom";

const MESSAGE =
  "The game runs seed 0yAObedRMV, not this run's seed 9MQ9gO1wMD: the board does not follow it. Start a new run from this ROM, or ignore this to follow it on this run.";

/**
 * A run of 9MQ9gO1wMD with the flute marked, and a connected session reading
 * a keysanity ROM of 0yAObedRMV: another seed, of another run type too.
 */
const readOtherSeed = (race = false) =>
  act(() => {
    useGameStore
      .getState()
      .applyRun("open", useGameStore.getState().settings, () => ({
        seed: "9MQ9gO1wMD",
      }));
    useGameStore.getState().handleItemClick("flute");
    useAutotrackStore.setState({
      reading: readingOf(
        writeSeedSettings(seedMemory({ name: "0yAObedRMV", race }), {
          dungeonItems: "full",
        }),
        { race },
      ),
      // alttpr.com was asked for the seed's file, and gave none
      seedFile: { hash: "0yAObedRMV", result: "not-found" },
      status: STATUSES.connected,
    });
  });

describe("RomSeedNotice", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      useAutotrackStore.setState(useAutotrackStore.getInitialState(), true);
    });
  });

  it("stays an empty live region until a ROM of another seed is read", () => {
    render(<RomSeedNotice romSeed={alttprRomSeed} />);
    const notice = screen.getByTestId("rom-seed-notice");
    expect(notice).toHaveAttribute("role", "status");
    expect(notice).toBeEmptyDOMElement();

    readOtherSeed();

    expect(notice).toHaveTextContent(MESSAGE);
    expect(screen.getByTestId("rom-seed-new-run")).toHaveAccessibleName(
      "New run",
    );
    expect(screen.getByTestId("rom-seed-ignore")).toHaveAccessibleName(
      "Ignore",
    );
  });

  it("says nothing once the session is no longer connected", () => {
    render(<RomSeedNotice romSeed={alttprRomSeed} />);
    readOtherSeed();
    act(() => useAutotrackStore.setState({ status: STATUSES.connecting }));

    expect(screen.getByTestId("rom-seed-notice")).toBeEmptyDOMElement();
  });

  it("asks nothing of the other seed's run type", () => {
    render(<SeedPrompt />);
    readOtherSeed();

    expect(screen.getByTestId("seed-prompt")).toBeEmptyDOMElement();
  });

  it("starts a new run, which takes the ROM's run type and one undo takes back", async () => {
    const user = userEvent.setup();
    render(<RomSeedNotice romSeed={alttprRomSeed} />);
    readOtherSeed();

    await user.click(screen.getByTestId("rom-seed-new-run"));

    // A fresh board knows no seed, so it switched to the ROM's run type
    expect(useGameStore.getState()).toMatchObject({
      presetId: "keysanity",
      seed: null,
    });
    expect(useGameStore.getState().items.flute).toBe(false);
    expect(screen.getByTestId("rom-seed-notice")).toBeEmptyDOMElement();
    act(() => useGameStore.getState().undo());
    act(() => useGameStore.getState().undo());
    expect(useGameStore.getState()).toMatchObject({
      presetId: "open",
      seed: "9MQ9gO1wMD",
    });
    expect(useGameStore.getState().items.flute).toBe(true);
  });

  it("ignores it: the run takes the ROM's seed, its marks kept", async () => {
    const user = userEvent.setup();
    render(
      <>
        <RomSeedNotice romSeed={alttprRomSeed} />
        <SeedPrompt />
      </>,
    );
    readOtherSeed();

    await user.click(screen.getByTestId("rom-seed-ignore"));

    expect(useGameStore.getState().seed).toBe("0yAObedRMV");
    expect(useGameStore.getState().items.flute).toBe(true);
    expect(screen.getByTestId("rom-seed-notice")).toBeEmptyDOMElement();
    // Its run type is now held against the board's, as any seed's
    expect(screen.getByTestId("seed-prompt")).toHaveTextContent(
      /^This seed is Keysanity/,
    );
  });
});

describe("RomSeedLine", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      useAutotrackStore.setState(useAutotrackStore.getInitialState(), true);
    });
  });

  it("says the ROM is another seed's, with the two answers", async () => {
    const user = userEvent.setup();
    render(<RomSeedLine romSeed={alttprRomSeed} />);
    readOtherSeed();

    expect(screen.getByTestId("autotrack-rom-seed")).toHaveTextContent(MESSAGE);
    await user.click(screen.getByTestId("autotrack-rom-seed-ignore"));
    expect(useGameStore.getState().seed).toBe("0yAObedRMV");
    expect(screen.queryByTestId("autotrack-rom-seed")).toBeNull();
  });

  it("says Race Mode keeps the check off, with no answer to give", () => {
    render(<RomSeedLine romSeed={alttprRomSeed} />);
    readOtherSeed(true);

    expect(screen.getByTestId("autotrack-rom-seed")).toHaveTextContent(
      "Race Mode: the tracker does not check that the game is this run's seed.",
    );
    expect(screen.queryByTestId("autotrack-rom-seed-ignore")).toBeNull();
  });

  it("says nothing for a run that knows no seed", () => {
    render(<RomSeedLine romSeed={alttprRomSeed} />);
    act(() =>
      useAutotrackStore.setState({
        reading: readingOf(seedMemory({ name: "0yAObedRMV", race: false })),
        status: STATUSES.connected,
      }),
    );

    expect(screen.queryByTestId("autotrack-rom-seed")).toBeNull();
  });
});
