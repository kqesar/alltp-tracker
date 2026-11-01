import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STATUSES, statusOf } from "@/autotrack/fixtures";
import { forgetDoorSeeds } from "@/games/alttpr/autotrack/doorSeed";
import { forgetSeedFiles } from "@/games/alttpr/autotrack/seedFile";
import { SeedImport } from "@/games/alttpr/components/ui/SeedImport";
import { getPreset } from "@/games/alttpr/data/presets";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";
import keydrop from "../../../../../../../packs/alttpr/test/dr-seeds/avianart-C2BdrZOiV.json";
import open from "../../../../../../../packs/alttpr/test/seed-files/9MQ9gO1wMD.json";

const OPEN_RUN = { presetId: "open", settings: getPreset("open").settings };

/** The form, the board on `run`, alttpr.com answering with `answer`. */
const setUp = (answer: () => Promise<Response>, run = OPEN_RUN) => {
  const fetch = vi.fn(answer);
  vi.stubGlobal("fetch", fetch);
  const onSwitch = vi.fn();
  const { unmount } = render(<SeedImport onSwitch={onSwitch} run={run} />);
  const load = (text: string) => {
    fireEvent.change(screen.getByTestId("seed-import-input"), {
      target: { value: text },
    });
    fireEvent.click(screen.getByTestId("seed-import-load"));
  };
  return { fetch, load, onSwitch, unmount };
};

const withMeta = (meta: Record<string, unknown>) => async () =>
  new Response(
    JSON.stringify({
      ...open,
      spoiler: { meta: { ...open.spoiler.meta, ...meta } },
    }),
  );

beforeEach(() => {
  forgetSeedFiles();
  forgetDoorSeeds();
  useAutotrackStore.setState(useAutotrackStore.getInitialState(), true);
});
afterEach(() => vi.unstubAllGlobals());

describe("SeedImport", () => {
  it("asks for a link or a hash, and nothing else", () => {
    const { fetch, load } = setUp(withMeta({}));

    load("not a seed");

    expect(screen.getByTestId("seed-import-status")).toHaveTextContent(
      "Paste the seed's link from alttpr.com (or its hash), avianart.games or Hyrule Town Hall.",
    );
    expect(screen.getByRole("status")).toBe(
      screen.getByTestId("seed-import-status"),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("hands on a seed of another run type", async () => {
    const { load, onSwitch } = setUp(withMeta({ dungeon_items: "full" }));

    load("https://alttpr.com/h/9MQ9gO1wMD");

    await vi.waitFor(() => expect(onSwitch).toHaveBeenCalledOnce());
    expect(onSwitch.mock.calls[0]?.[0]).toMatchObject({
      kind: "differs",
      presetId: "keysanity",
      seedText: "Keysanity (Open, Ganon, 7/7)",
    });
    expect(screen.getByTestId("seed-import-status")).toBeEmptyDOMElement();
  });

  it("says a seed matches the board's run type", async () => {
    const { load, onSwitch } = setUp(withMeta({}));

    load("9MQ9gO1wMD");

    expect(
      await screen.findByText(
        "The run type matches this seed: Open (Open, Ganon, 7/7).",
      ),
    ).toBeInTheDocument();
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("hands on a Ganonhunt seed, a run type of its own", async () => {
    const { load, onSwitch } = setUp(withMeta({ goal: "ganonhunt" }));

    load("9MQ9gO1wMD");

    await vi.waitFor(() => expect(onSwitch).toHaveBeenCalledOnce());
    expect(onSwitch.mock.calls[0]?.[0]).toMatchObject({
      kind: "differs",
      presetId: "ganonhunt",
      seedText: "Ganonhunt (Open, Ganonhunt, 7/7)",
    });
  });

  it("says when alttpr.com gives nothing", async () => {
    const { load } = setUp(async () => new Response("", { status: 403 }));

    load("9MQ9gO1wMD");
    expect(await screen.findByText("Asking alttpr.com…")).toBeInTheDocument();
    expect(
      await screen.findByText("alttpr.com has no seed with this hash."),
    ).toBeInTheDocument();
  });

  it("asks alttpr.com for nothing in Race Mode, and says why", () => {
    const fetch = vi.fn(withMeta({}));
    vi.stubGlobal("fetch", fetch);
    act(() => useAutotrackStore.setState({ raceChoice: "on" }));
    render(<SeedImport onSwitch={vi.fn()} run={OPEN_RUN} />);

    expect(screen.queryByTestId("seed-import-input")).toBeNull();
    expect(screen.getByTestId("seed-import-race")).toHaveTextContent(
      "Off in Race Mode: during a race the tracker asks alttpr.com, avianart.games and Hyrule Town Hall for nothing, since a seed's file holds where every item is. Pick the run type below.",
    );

    // On in this tab's session too, set Auto: the race flag said race
    act(() =>
      useAutotrackStore.setState({
        active: true,
        raceChoice: "auto",
        status: statusOf("connected", {
          race: {
            active: true,
            flag: "race",
            overridden: false,
            raceLegal: true,
            setting: "auto",
          },
        }),
      }),
    );
    expect(screen.getByTestId("seed-import-race")).toBeVisible();

    // The race read is remembered: an open flag read after it does not end it
    act(() => useAutotrackStore.setState({ status: STATUSES.connected }));
    expect(screen.getByTestId("seed-import-race")).toBeVisible();

    // Out of it once the player calls the race over, the form is back
    act(() => useAutotrackStore.getState().endRace());
    expect(screen.getByTestId("seed-import-input")).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("drops an answer that comes after the form closed", async () => {
    let answer: (response: Response) => void = () => {};
    const { fetch, load, onSwitch, unmount } = setUp(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    load("9MQ9gO1wMD");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());

    unmount();
    await withMeta({ mode: "inverted" })().then(answer);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("starts a Door Randomizer run from an avianart permalink, its pots and drops named", async () => {
    const { fetch, load, onSwitch } = setUp(
      async () => new Response(JSON.stringify(keydrop)),
    );

    load("https://avianart.games/perm/C2BdrZOiV");

    expect(screen.getByTestId("seed-import-status")).toHaveTextContent(
      "Asking avianart.games…",
    );
    await vi.waitFor(() => expect(onSwitch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "https://avianart.games/api.php?action=permlink&hash=C2BdrZOiV",
    );
    const check = onSwitch.mock.calls[0]?.[0];
    expect(check).toMatchObject({
      kind: "differs",
      presetId: "door-randomizer",
      seed: "C2BdrZOiV",
    });
    // The recorded race seed: Standard, all dungeons, keysanity, keydrop
    expect(check.settings).toMatchObject({
      dropShuffle: "keys",
      dungeonItems: "full",
      goal: "all-dungeons",
      mode: "standard",
      pottery: "keys",
      randomizer: "dr",
    });
  });

  it("says when avianart has no Door Randomizer seed there", async () => {
    const { load } = setUp(
      async () => new Response(JSON.stringify({ response: {} })),
    );

    load("https://avianart.games/perm/Unknown123");

    expect(
      await screen.findByText(
        "avianart.games has no Door Randomizer seed at this link.",
      ),
    ).toBeInTheDocument();
  });

  it("asks Hyrule Town Hall for a seed's patch, and says what it cannot read", async () => {
    const { fetch, load } = setUp(
      async () => new Response(new Uint8Array([1, 2, 3])),
    );
    const url =
      "https://hyruletownhall.com/seed/DR_78388fdd-435c-4961-8fae-0500424d5bf5.bps";

    load(url);

    expect(
      await screen.findByText(
        "This seed on Hyrule Town Hall is not one the tracker reads.",
      ),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(url);
  });
});
