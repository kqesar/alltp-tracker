import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import { forgetSeedFiles } from "@/autotrack/seedFile";
import { PresetSelector } from "@/components/ui/PresetSelector";
import { getPreset } from "@/data/presets";
import { useGameStore } from "@/stores/gameStore";
import daily from "../../../../../packs/alttpr/test/seed-files/eM43RgZ4Gj.json";

vi.mock("@/stores/gameStore", () => ({ useGameStore: vi.fn() }));

const applyRun = vi.fn();
const fakeState = {
  applyRun,
  presetId: "open",
  settings: {
    ...getPreset("open").settings,
    crystalsGanon: 6,
    crystalsTower: 5,
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  forgetSeedFiles();
  (useGameStore as unknown as Mock).mockImplementation(
    (selector: (state: typeof fakeState) => unknown) => selector(fakeState),
  );
});

describe("PresetSelector", () => {
  const openList = () => {
    fireEvent.click(screen.getByRole("button", { name: /mode/i }));
    return screen.getByRole("dialog", { name: /choose a run type/i });
  };

  it("shows the current preset name", () => {
    render(<PresetSelector />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("lists presets and the current run settings when opened", () => {
    render(<PresetSelector />);
    const dialog = openList();

    expect(
      within(dialog).getByRole("button", { name: /^keysanity/i }),
    ).toBeInTheDocument();
    // Current-run settings summary is shown
    expect(within(dialog).getByText("Goal")).toBeInTheDocument();
    expect(within(dialog).getByText("Defeat Ganon")).toBeInTheDocument();
    // A seed's own crystal counts, which no preset names
    const row = (label: string) =>
      within(dialog).getByText(label, { selector: "dt" }).nextElementSibling;
    expect(row("Ganon's Tower")).toHaveTextContent("5 crystals");
    expect(row("Ganon")).toHaveTextContent("6 crystals");
  });

  it("asks for confirmation before switching, then applies the preset", () => {
    render(<PresetSelector />);
    const dialog = openList();
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^keysanity/i }),
    );

    expect(
      screen.getByRole("dialog", { name: /switch run type/i }),
    ).toBeInTheDocument();
    expect(applyRun).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /switch & reset/i }));
    expect(applyRun).toHaveBeenCalledWith(
      "keysanity",
      getPreset("keysanity").settings,
    );
  });

  it("starts from a seed's link: its run type, once confirmed, under its settings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(daily))),
    );
    render(<PresetSelector />);
    const dialog = openList();

    fireEvent.change(within(dialog).getByTestId("seed-import-input"), {
      target: { value: "https://alttpr.com/en/h/eM43RgZ4Gj" },
    });
    fireEvent.click(within(dialog).getByTestId("seed-import-load"));

    const confirm = await screen.findByRole("dialog", {
      name: /switch run type/i,
    });
    expect(confirm).toHaveTextContent(
      'Switching to "Inverted (Inverted, Fast Ganon, 4/7, Basic placement, Hard pool, Hard functionality)"',
    );
    expect(applyRun).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /switch & reset/i }));
    expect(applyRun).toHaveBeenCalledWith("inverted", {
      ...fakeState.settings,
      crystalsGanon: 7,
      crystalsTower: 4,
      goal: "fast-ganon",
      itemFunctionality: "hard",
      itemPlacement: "basic",
      itemPool: "hard",
      mode: "inverted",
    });
  });

  it("does not switch when picking the already-active preset", () => {
    render(<PresetSelector />);
    const dialog = openList();
    fireEvent.click(within(dialog).getByRole("button", { name: /^open/i }));
    expect(applyRun).not.toHaveBeenCalled();
  });
});
