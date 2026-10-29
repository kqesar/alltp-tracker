import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  MissingGroups,
  MissingLines,
} from "@/games/alttpr/components/ui/Missing";
import type { Missing } from "@/games/alttpr/logic/missing";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** A check only maybe, whose ways to yes ask for the hookshot. */
const MAYBE: Missing = {
  doubts: [{ kind: "placement" }],
  inLogic: {
    sets: [[{ icon: "hookshot.png", key: "hookshot", label: "Hookshot" }]],
    truncated: false,
  },
  tri: "maybe",
};

describe("Missing", () => {
  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  it("says what puts a check in logic in a run with a logic", () => {
    render(<MissingLines missing={MAYBE} />);
    expect(screen.getByTestId("missing-in-logic")).toHaveTextContent(
      "In logic with: Hookshot",
    );
  });

  it("says what makes a check reachable in a No Logic run, never in logic", () => {
    act(() => useGameStore.getState().updateSettings({ glitches: "no_logic" }));
    render(
      <>
        <MissingLines missing={MAYBE} />
        <MissingGroups
          groups={[
            {
              key: "maybe",
              missing: MAYBE,
              spots: [{ count: 1, name: "Big Chest" }],
            },
          ]}
        />
      </>,
    );
    expect(screen.getByTestId("missing-in-logic")).toHaveTextContent(
      "Reachable with: Hookshot",
    );
    expect(screen.getByTestId("missing-group")).toHaveTextContent(
      /^Reachable with Hookshot; Maybe, depends on where an item was placed: Big Chest$/,
    );
    expect(document.body).not.toHaveTextContent(/in logic/i);
  });
});
