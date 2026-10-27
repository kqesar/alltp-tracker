import { parseUserAgent } from "@alltp/autotrack";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { settle, statusOf } from "@/autotrack/fixtures";
import { readSm } from "@/games/sm/autotrack/reading";
import {
  stopSmAutotrack,
  useSmAutotrackStore,
} from "@/games/sm/autotrack/store";
import { SmAutotrack, useSmAutotrack } from "@/games/sm/components/SmAutotrack";
import { viewOf, writeMapRando } from "../../../../../../packs/sm/test/sm-rom";

const state = () => useSmAutotrackStore.getState();

/** What the tracker read of a Map Rando seed. */
const readingOf = (name: string, race = false) =>
  readSm(
    viewOf(
      writeMapRando(new Uint8Array(0x100_0000), {
        done: ["ridley", "pitRoom"],
        name,
        objectives: ["ridley", "botwoon", "pitRoom"],
      }),
    ),
    0,
    race,
  );

const openDialog = async () => {
  await userEvent.click(screen.getByTestId("autotrack-button"));
  // Its code arrives as a chunk of its own
  return screen.findByRole("dialog", { name: "Autotracking" });
};

beforeEach(() => {
  localStorage.clear();
  useSmAutotrackStore.setState(useSmAutotrackStore.getInitialState(), true);
});

afterEach(() => act(() => stopSmAutotrack()));

describe("Super Metroid's autotracking control", () => {
  it("names its status, and opens on the setup guide for the player's system", async () => {
    render(<SmAutotrack />);
    const button = screen.getByTestId("autotrack-button");
    expect(button).toHaveAccessibleName("Autotracking, Off");

    const dialog = await openDialog();
    await act(() => settle());

    expect(state().environment).not.toBeNull();
    expect(
      within(dialog).getByRole("button", { name: "Connect" }),
    ).toBeInTheDocument();
    // The steps name the game the player loads
    expect(within(dialog).getByTestId("setup-step-game")).toHaveTextContent(
      /Map Rando/,
    );
  });

  it("says what it read of the seed, its link and objectives", async () => {
    act(() =>
      useSmAutotrackStore.setState({
        active: true,
        environment: parseUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0",
        ),
        reading: readingOf("Zebes42"),
        shown: statusOf("no-device"),
        status: statusOf("no-device"),
      }),
    );
    render(<SmAutotrack />);
    const dialog = await openDialog();

    const readout = within(dialog).getByTestId("sm-readout");
    expect(
      within(readout).getByRole("link", { name: /Zebes42/ }),
    ).toHaveAttribute("href", "https://maprando.com/seed/Zebes42/");
    expect(
      within(readout)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Ridley, done", "Botwoon", "Pit Room, done"]);
    expect(within(dialog).getByTestId("autotrack-headline")).toHaveTextContent(
      "SNI sees no emulator or console",
    );
    // A session waiting to retry offers it now, and Disconnect
    expect(within(dialog).getByTestId("autotrack-retry")).toHaveAccessibleName(
      "Retry now",
    );
    await userEvent.click(within(dialog).getByTestId("autotrack-disconnect"));
    expect(state()).toMatchObject({ active: false, connectOnStart: false });
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names no seed in Race Mode, and leaves the objectives but bosses to the player", async () => {
    act(() =>
      useSmAutotrackStore.setState({ reading: readingOf("Zebes42", true) }),
    );
    render(<SmAutotrack />);
    const dialog = await openDialog();
    const readout = within(dialog).getByTestId("sm-readout");
    expect(readout).toHaveTextContent(
      "A Map Rando seed, in Race Mode: the objectives other than bosses stay yours to mark.",
    );
    expect(readout).not.toHaveTextContent("Zebes42");
    expect(within(readout).queryByRole("link")).toBeNull();
    expect(
      within(readout)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Ridley, done", "Botwoon", "Pit Room, not read in Race Mode"]);
    // racetime.gg's rules say nothing of autotracking: the dialog never
    // claims they allow it
    expect(dialog).not.toHaveTextContent("Races allow autotracking");
    expect(dialog).toHaveTextContent(
      "racetime.gg's Super Metroid Randomizer rules say nothing of autotracking",
    );
  });

  it("says a seed without a name, and nothing before a reading", async () => {
    act(() => useSmAutotrackStore.setState({ reading: readingOf("") }));
    render(<SmAutotrack />);
    const dialog = await openDialog();
    expect(within(dialog).getByTestId("sm-readout")).toHaveTextContent(
      "A Map Rando seed.",
    );
    expect(
      within(dialog).queryByTestId("autotrack-retry"),
    ).not.toBeInTheDocument();

    act(() => useSmAutotrackStore.setState({ reading: null }));
    expect(within(dialog).queryByTestId("sm-readout")).toBeNull();
  });

  it("says when its code could not be loaded", async () => {
    act(() => useSmAutotrackStore.setState({ unavailable: true }));
    render(<SmAutotrack />);
    expect(screen.getByTestId("autotrack-button")).toHaveAccessibleName(
      "Autotracking, Could not load: reload the page",
    );
    const dialog = await openDialog();
    expect(within(dialog).getByTestId("autotrack-headline")).toHaveTextContent(
      "Autotracking could not be loaded",
    );
  });

  it("offers to stop waiting while another tab autotracks", async () => {
    act(() => useSmAutotrackStore.setState({ active: true, elsewhere: true }));
    render(<SmAutotrack />);
    expect(screen.getByTestId("autotrack-live")).toHaveTextContent(
      "Autotracking: Running in another tab",
    );
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByTestId("autotrack-stop-waiting"));
    expect(state()).toMatchObject({ active: false, elsewhere: false });
  });

  it("says the status politely, quiet while merely connecting", () => {
    act(() =>
      useSmAutotrackStore.setState({
        active: true,
        shown: statusOf("connecting"),
      }),
    );
    render(<SmAutotrack />);
    const live = screen.getByTestId("autotrack-live");
    expect(live).toHaveTextContent("");
    act(() => useSmAutotrackStore.setState({ shown: statusOf("connected") }));
    expect(live).toHaveTextContent("Autotracking: Connected");
  });
});

describe("autotracking's lifetime in the Super Metroid tracker", () => {
  const Tracker = () => {
    useSmAutotrack();
    return null;
  };

  it("connects as it opens only once the player has, and stops as it closes", async () => {
    const { unmount } = render(<Tracker />);
    expect(state().active).toBe(false);
    unmount();

    act(() => useSmAutotrackStore.setState({ connectOnStart: true }));
    const again = render(<Tracker />);
    expect(state().active).toBe(true);
    again.unmount();
    expect(state()).toMatchObject({ active: false, connectOnStart: true });
    await act(() => settle());
  });
});
