import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { PresetSelector } from "@/components/ui/PresetSelector";
import { useGameStore } from "@/stores/gameStore";

vi.mock("@/stores/gameStore", () => ({ useGameStore: vi.fn() }));

const applyPreset = vi.fn();
const fakeState = {
  applyPreset,
  presetId: "open",
  settings: {
    entranceShuffle: "none" as const,
    goal: "ganon" as const,
    keysanity: false,
    mode: "open" as const,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(applyPreset).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /switch & reset/i }));
    expect(applyPreset).toHaveBeenCalledWith("keysanity");
  });

  it("does not switch when picking the already-active preset", () => {
    render(<PresetSelector />);
    const dialog = openList();
    fireEvent.click(within(dialog).getByRole("button", { name: /^open/i }));
    expect(applyPreset).not.toHaveBeenCalled();
  });
});
