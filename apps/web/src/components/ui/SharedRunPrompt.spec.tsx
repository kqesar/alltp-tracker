import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { SharedRunPrompt } from "@/components/ui/SharedRunPrompt";
import { packLink as packAlttpr } from "@/games/alttpr/share";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { loadGame, switchGame } from "@/games/registry";
import { exportSave as exportSm, useSmStore } from "@/games/sm/store";
import { packLink as packSmz3 } from "@/games/smz3/share";
import { exportSave as exportSmz3, useSmz3Store } from "@/games/smz3/store";
import { encodeRun } from "@/share/runLink";

vi.mock("@/games/registry", async (importActual) => ({
  ...(await importActual<typeof import("@/games/registry")>()),
  switchGame: vi.fn(),
}));

/** Open a link: the address as it would be, the payload in its fragment. */
const openLink = (payload: string) =>
  window.history.replaceState(null, "", `/#run=${payload}`);

/** A shared Super Metroid run with the Morph Ball and 5 missiles. */
const sharedSm = async () => {
  useSmStore.setState(useSmStore.getInitialState(), true);
  useSmStore.getState().step("morph", 1);
  for (let n = 0; n < 5; n++) useSmStore.getState().step("missile", 1);
  const save = exportSm(useSmStore.getState());
  useSmStore.setState(useSmStore.getInitialState(), true);
  return encodeRun(save);
};

describe("the shared run notice", () => {
  // Each game's module, imported once before any test: the notice imports
  // the link's game (`loadGame`) before it offers it, and a cold import of
  // ALttPR's (its logic and pack, 250 ms alone, 400 to 500 ms in a full run,
  // more on a busy machine) would eat the 1 s a `findBy` waits for the offer
  beforeAll(async () => {
    await Promise.all(
      (["alttpr", "sm", "smz3"] as const).map((game) => loadGame(game)),
    );
  });

  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState(useGameStore.getInitialState(), true);
    useSmStore.setState(useSmStore.getInitialState(), true);
    useSmz3Store.setState(useSmz3Store.getInitialState(), true);
    vi.mocked(switchGame).mockClear();
  });
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("stays empty while the address holds no run", () => {
    render(<SharedRunPrompt game="sm" />);

    expect(screen.getByTestId("shared-run-prompt")).toBeEmptyDOMElement();
  });

  it("asks before replacing anything, and touches nothing meanwhile", async () => {
    const payload = await sharedSm();
    useSmStore.getState().step("bombs", 1);
    openLink(payload);

    render(<SharedRunPrompt game="sm" />);

    expect(
      await screen.findByText(
        "Open this shared run? It replaces the run on this device.",
      ),
    ).toBeInTheDocument();
    expect(useSmStore.getState().items.bombs).toBe(1);
    expect(useSmStore.getState().items.morph).toBe(0);
    expect(window.location.hash).toMatch(/^#run=/);
  });

  it("keeps the player's run on Keep mine, and clears the address", async () => {
    const payload = await sharedSm();
    useSmStore.getState().step("bombs", 1);
    openLink(payload);
    render(<SharedRunPrompt game="sm" />);

    await userEvent.click(await screen.findByTestId("shared-run-keep"));

    expect(useSmStore.getState().items.bombs).toBe(1);
    expect(useSmStore.getState().items.morph).toBe(0);
    expect(window.location.hash).toBe("");
    expect(screen.queryByTestId("shared-run-open")).not.toBeInTheDocument();
  });

  it("opens the run as an import does: one undo step, the address cleared", async () => {
    const payload = await sharedSm();
    useSmStore.getState().step("bombs", 1);
    openLink(payload);
    render(<SharedRunPrompt game="sm" />);

    await userEvent.click(await screen.findByTestId("shared-run-open"));

    expect(useSmStore.getState().items.morph).toBe(1);
    expect(useSmStore.getState().items.missile).toBe(5);
    expect(useSmStore.getState().items.bombs).toBe(0);
    expect(window.location.hash).toBe("");
    expect(screen.getByText(/Shared run opened/)).toBeInTheDocument();
    expect(switchGame).not.toHaveBeenCalled();

    act(() => useSmStore.getState().undo());
    expect(useSmStore.getState().items.bombs).toBe(1);
  });

  it("opens another game's run in its own store, then switches to it", async () => {
    useSmz3Store.getState().step("flute", 1);
    const save = exportSmz3(useSmz3Store.getState());
    useSmz3Store.setState(useSmz3Store.getInitialState(), true);
    openLink(await encodeRun(save));
    render(<SharedRunPrompt game="alttpr" />);

    expect(
      await screen.findByText(/It switches to SMZ3\./),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("shared-run-open"));

    expect(useSmz3Store.getState().items.flute).toBe(1);
    expect(switchGame).toHaveBeenCalledWith("smz3");
    expect(window.location.hash).toBe("");
    // Saved before the page loads again
    expect(localStorage.getItem("alltp-tracker-smz3")).toContain('"flute":1');
  });

  it("opens an ALttPR run with the game's own validation and migrations", async () => {
    useGameStore.getState().handleItemClick("hookshot");
    const save = useGameStore.getState().exportState();
    useGameStore.setState(useGameStore.getInitialState(), true);
    openLink(await encodeRun(save));
    render(<SharedRunPrompt game="alttpr" />);

    await userEvent.click(await screen.findByTestId("shared-run-open"));

    expect(useGameStore.getState().items.hookshot).toBe(true);
    expect(useGameStore.getState().past).toHaveLength(1);
  });

  it.each([
    ["not base64", "not base64!"],
    ["not deflate", "AAAAAAAAAAAAAAAA"],
    ["deflated text that is not a save", "S0nMSQYA"],
  ])(
    "says so and changes nothing for a link that is %s",
    async (_name, payload) => {
      useSmStore.getState().step("bombs", 1);
      openLink(payload);
      render(<SharedRunPrompt game="sm" />);

      const refusal = await screen.findByTestId("shared-run-refused");

      expect(refusal).toHaveTextContent(/Nothing was changed\.$/);
      expect(screen.queryByTestId("shared-run-open")).not.toBeInTheDocument();
      expect(useSmStore.getState().items.bombs).toBe(1);

      await userEvent.click(screen.getByTestId("shared-run-dismiss"));
      expect(window.location.hash).toBe("");
    },
  );

  it("refuses a run the game's own import refuses, with its reason", async () => {
    // 99 missiles: beyond the pool, which a hand-edited link could claim
    const save = JSON.stringify({
      format: "alltp-tracker-save",
      game: "sm",
      progress: {
        done: [],
        items: { missile: 99 },
        objectives: [],
        splitSpeed: false,
        wallJump: false,
      },
      version: 1,
    });
    openLink(await encodeRun(save));
    render(<SharedRunPrompt game="sm" />);

    expect(await screen.findByTestId("shared-run-refused")).toHaveTextContent(
      "This save's run is not one the tracker can read.",
    );
    expect(useSmStore.getState().items.missile).toBe(0);
  });

  it("refuses a hostile ALttPR run through validateProgress", async () => {
    const save = JSON.stringify({
      format: "alltp-tracker-save",
      game: "alttpr",
      progress: { checked: { "<img src=x onerror=alert(1)>": true }, items: 5 },
      version: 11,
    });
    openLink(await encodeRun(save));
    render(<SharedRunPrompt game="alttpr" />);

    expect(await screen.findByTestId("shared-run-refused")).toBeInTheDocument();
    expect(useGameStore.getState().checked).toEqual({});
    expect(document.querySelector("img")).toBeNull();
  });

  it("opens a packed ALttPR link, its timeline and checks included", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_760_000_000_000);
    const store = useGameStore.getState();
    store.startTimer(Date.now());
    vi.setSystemTime(Date.now() + 61_000);
    store.handleItemClick("hookshot");
    vi.setSystemTime(Date.now() + 42_500);
    store.toggleChecks(["kings-tomb"]);
    const save = useGameStore.getState().exportState();
    vi.useRealTimers();
    const link = packAlttpr(save);
    expect(JSON.parse(link).format).toBe("alltp-tracker-link");
    useGameStore.setState(useGameStore.getInitialState(), true);
    openLink(await encodeRun(link));
    render(<SharedRunPrompt game="alttpr" />);

    await userEvent.click(await screen.findByTestId("shared-run-open"));

    const run = useGameStore.getState();
    expect(run.items.hookshot).toBe(true);
    expect(run.checked).toEqual({ "kings-tomb": true });
    expect(run.timeline["item:hookshot"]).toEqual({
      at: 1_760_000_061_000,
      ms: 61_000,
    });
    expect(run.timeline["check:kings-tomb"]?.ms).toBe(103_500);
  });

  it("opens a packed SMZ3 link in its own store, then switches to it", async () => {
    useSmz3Store.getState().step("flute", 1);
    useSmz3Store.getState().toggleChecks(["castle-tower/foyer"]);
    const link = packSmz3(exportSmz3(useSmz3Store.getState()));
    useSmz3Store.setState(useSmz3Store.getInitialState(), true);
    openLink(await encodeRun(link));
    render(<SharedRunPrompt game="alttpr" />);

    await userEvent.click(await screen.findByTestId("shared-run-open"));

    expect(useSmz3Store.getState().items.flute).toBe(1);
    expect(useSmz3Store.getState().checked).toEqual(["castle-tower/foyer"]);
    expect(switchGame).toHaveBeenCalledWith("smz3");
  });

  it("says a link comes from another version, and changes nothing", async () => {
    useGameStore.getState().handleItemClick("hookshot");
    const link = JSON.parse(packAlttpr(useGameStore.getState().exportState()));
    useGameStore.setState(useGameStore.getInitialState(), true);
    useGameStore.getState().handleItemClick("lantern");
    link.table = "AAAAAA";
    openLink(await encodeRun(JSON.stringify(link)));
    render(<SharedRunPrompt game="alttpr" />);

    expect(await screen.findByTestId("shared-run-refused")).toHaveTextContent(
      "This link comes from another version of the tracker. Nothing was changed.",
    );
    expect(screen.queryByTestId("shared-run-open")).not.toBeInTheDocument();
    expect(useGameStore.getState().items.lantern).toBe(true);
  });

  it("asks again when a link is opened in a tab already on the tracker", async () => {
    render(<SharedRunPrompt game="sm" />);
    expect(screen.getByTestId("shared-run-prompt")).toBeEmptyDOMElement();

    openLink(await sharedSm());
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    await waitFor(() =>
      expect(screen.getByTestId("shared-run-open")).toBeInTheDocument(),
    );
  });
});
