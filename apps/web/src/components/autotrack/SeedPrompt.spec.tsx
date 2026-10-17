import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { readingOf, seedMemory } from "@/autotrack/fixtures";
import { SeedPrompt } from "@/components/autotrack/SeedPrompt";
import { useAutotrackStore } from "@/stores/autotrackStore";
import { useGameStore } from "@/stores/gameStore";
import { writeSeedSettings } from "../../../../../packs/alttpr/test/seed-rom";

/** A keysanity seed read, the board on Open with the flute marked. */
const readKeysanitySeed = () =>
  act(() => {
    useGameStore.getState().handleItemClick("flute");
    useAutotrackStore.setState({
      reading: readingOf(
        writeSeedSettings(seedMemory({ name: "PROMPT", race: false }), {
          dungeonItems: "full",
        }),
      ),
    });
  });

describe("SeedPrompt", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      useAutotrackStore.setState(useAutotrackStore.getInitialState(), true);
    });
  });

  it("stays an empty live region until a seed of another run type is read", () => {
    render(<SeedPrompt />);
    const prompt = screen.getByTestId("seed-prompt");
    expect(prompt).toHaveAttribute("role", "status");
    expect(prompt).toBeEmptyDOMElement();

    readKeysanitySeed();

    expect(prompt).toHaveTextContent(
      "This seed is Keysanity (Open, Ganon, 7/7). The tracker is set to Open. Switch?",
    );
  });

  it("switches to the seed's run type, which one undo takes back", async () => {
    const user = userEvent.setup();
    render(<SeedPrompt />);
    readKeysanitySeed();

    await user.click(screen.getByTestId("seed-switch"));

    expect(useGameStore.getState().presetId).toBe("keysanity");
    expect(screen.getByTestId("seed-prompt")).toBeEmptyDOMElement();
    expect(useAutotrackStore.getState().news?.text).toBe(
      "This seed is Keysanity (Open, Ganon, 7/7): the tracker switched to it.",
    );
    act(() => useGameStore.getState().undo());
    expect(useGameStore.getState()).toMatchObject({ presetId: "open" });
    expect(useGameStore.getState().items.flute).toBe(true);
  });

  it("keeps the player's run type for this seed", async () => {
    const user = userEvent.setup();
    render(<SeedPrompt />);
    readKeysanitySeed();

    await user.click(screen.getByTestId("seed-keep"));

    expect(useGameStore.getState().presetId).toBe("open");
    expect(useAutotrackStore.getState().keptSeed).toBe("PROMPT");
    expect(screen.getByTestId("seed-prompt")).toBeEmptyDOMElement();
  });
});
