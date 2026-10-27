import { parseUserAgent } from "@alltp/autotrack";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { STATUSES } from "@/autotrack/fixtures";
import { readSmz3 } from "@/games/smz3/autotrack/reading";
import { smz3Autotrack } from "@/games/smz3/autotrack/store";
import { Smz3Autotrack } from "@/games/smz3/components/Smz3Autotrack";
import {
  type Smz3Game,
  viewOf,
  writeSmz3,
} from "../../../../../../packs/smz3/test/smz3-rom";

/** What the session would have read of a game. */
const reading = (game: Smz3Game, race = false) =>
  readSmz3(
    viewOf(writeSmz3(new Uint8Array(0x100_0000), game), game.mode ?? "zelda"),
    race,
    0,
  );

beforeEach(() => {
  smz3Autotrack.useStore.setState(
    smz3Autotrack.useStore.getInitialState(),
    true,
  );
  smz3Autotrack.useStore.setState({
    environment: parseUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
    ),
  });
});

/** The dialog, opened from the toolbar's button. */
const openDialog = async () => {
  const user = userEvent.setup();
  render(<Smz3Autotrack />);
  await user.click(screen.getByTestId("autotrack-button"));
  return screen.findByTestId("autotrack-dialog");
};

describe("SMZ3's autotracking dialog", () => {
  it("says what it read of the seed, its requirements outside races", async () => {
    act(() =>
      smz3Autotrack.useStore.setState({
        reading: reading({
          keysanity: true,
          mode: "sm",
          smLogic: "hard",
          tourianBosses: 3,
          turtleRock: "bombos",
        }),
      }),
    );
    const dialog = await openDialog();
    expect(within(dialog).getByTestId("smz3-readout")).toHaveTextContent(
      "The SMZ3 seed ZSM11.3.2CH1234ABCD, in Super Metroid. Compare it with your game.",
    );
    expect(
      within(dialog).getByTestId("smz3-readout-settings"),
    ).toHaveTextContent("Super Metroid logicHardKeysanityOn");
    expect(
      within(dialog).getByTestId("smz3-readout-requirements"),
    ).toHaveTextContent("Tourian3 bosses");
    expect(
      within(dialog).getByTestId("smz3-readout-requirements"),
    ).toHaveTextContent("Turtle RockBombos");
  });

  it("keeps a race seed's requirements its own", async () => {
    act(() =>
      smz3Autotrack.useStore.setState({
        reading: reading({ race: true }, true),
      }),
    );
    const dialog = await openDialog();
    const readout = within(dialog).getByTestId("smz3-readout");
    expect(readout).toHaveTextContent(
      "An SMZ3 race seed, in A Link to the Past. In Race Mode, its requirements, medallions and crystals stay yours to set.",
    );
    // v2.0 lets a tracker present only what it lists: no seed's name
    expect(readout).not.toHaveTextContent("ZSM");
    expect(
      within(dialog).queryByTestId("smz3-readout-requirements"),
    ).toBeNull();
    expect(within(dialog).getByTestId("autotrack-connect")).toBeVisible();
  });

  it("sets Race Mode always on, and says so while connected", async () => {
    const dialog = await openDialog();
    const user = userEvent.setup();
    const group = within(dialog).getByRole("group", { name: "Race Mode" });
    expect(screen.queryByTestId("race-badge")).toBeNull();

    await user.click(within(group).getByRole("radio", { name: "Always on" }));
    expect(smz3Autotrack.useStore.getState().raceChoice).toBe("on");

    act(() =>
      smz3Autotrack.useStore.setState({
        active: true,
        shown: {
          ...STATUSES.connected,
          race: {
            active: true,
            flag: "open",
            overridden: false,
            raceLegal: true,
            setting: "on",
          },
        },
      }),
    );
    expect(within(dialog).getByTestId("race-badge")).toHaveTextContent(
      "Race-legal Always on",
    );
    expect(within(dialog).getByTestId("race-mode")).toHaveTextContent(
      "Race Mode is always on, as you set it",
    );
  });

  it("says when the emulator does not serve the requirements", async () => {
    const memory = writeSmz3(new Uint8Array(0x100_0000));
    // Another part of the ROM in place of Zelda's config (bsnes-mercury)
    memory[0x40_003e] = 0xdf;
    act(() =>
      smz3Autotrack.useStore.setState({
        reading: readSmz3(viewOf(memory, "zelda"), false, 0),
      }),
    );
    const dialog = await openDialog();
    expect(within(dialog).getByTestId("smz3-readout")).toHaveTextContent(
      "Your emulator does not serve the part of the ROM that holds its requirements and medallions: set them yourself.",
    );
  });

  it("names SMZ3 when another game runs", async () => {
    act(() =>
      smz3Autotrack.useStore.setState({
        active: true,
        shown: STATUSES["game-mismatch"],
      }),
    );
    const dialog = await openDialog();
    expect(screen.getByTestId("autotrack-button")).toHaveAccessibleName(
      "Autotracking, This is not an SMZ3 seed",
    );
    expect(within(dialog).getByTestId("autotrack-headline")).toHaveTextContent(
      "This is not an SMZ3 seed",
    );
  });

  it("reads nothing before a session does", async () => {
    const dialog = await openDialog();
    expect(within(dialog).queryByTestId("smz3-readout")).toBeNull();
  });
});
