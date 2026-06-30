import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { PresetSelector } from "@/components/ui/PresetSelector";
import { useGameStore } from "@/stores/gameStore";

vi.mock("@/stores/gameStore", () => ({ useGameStore: vi.fn() }));

const applyPreset = vi.fn();
const fakeState = { applyPreset, presetId: "open" };

beforeEach(() => {
  vi.clearAllMocks();
  (useGameStore as unknown as Mock).mockImplementation(
    (selector: (state: typeof fakeState) => unknown) => selector(fakeState),
  );
});

describe("PresetSelector", () => {
  it("shows the current preset name", () => {
    render(<PresetSelector />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("opens the preset list when clicked", () => {
    render(<PresetSelector />);
    fireEvent.click(screen.getByRole("button", { name: /mode/i }));
    expect(
      screen.getByRole("dialog", { name: /choose a run type/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Keysanity")).toBeInTheDocument();
  });

  it("asks for confirmation before switching, then applies the preset", () => {
    render(<PresetSelector />);
    fireEvent.click(screen.getByRole("button", { name: /mode/i }));
    fireEvent.click(screen.getByText("Keysanity"));

    // Confirmation dialog appears; preset not applied yet
    expect(
      screen.getByRole("dialog", { name: /switch run type/i }),
    ).toBeInTheDocument();
    expect(applyPreset).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /switch & reset/i }));
    expect(applyPreset).toHaveBeenCalledWith("keysanity");
  });

  it("does not switch when picking the already-active preset", () => {
    render(<PresetSelector />);
    fireEvent.click(screen.getByRole("button", { name: /mode/i }));
    const dialog = screen.getByRole("dialog", { name: /choose a run type/i });
    fireEvent.click(within(dialog).getByText("Open"));
    expect(applyPreset).not.toHaveBeenCalled();
  });
});
