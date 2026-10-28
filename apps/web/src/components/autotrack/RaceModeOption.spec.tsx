import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RaceModeOption } from "@/components/autotrack/RaceModeOption";

describe("RaceModeOption", () => {
  it("says nothing of a remembered race unless one holds Race Mode", () => {
    render(<RaceModeOption onChange={vi.fn()} value="auto" />);

    expect(screen.queryByTestId("race-remembered")).toBeNull();
    expect(screen.queryByTestId("race-end")).toBeNull();
  });

  it("says why Race Mode is on when only the memory holds it, and ends it on the player's word", () => {
    const onEnd = vi.fn();
    render(
      <RaceModeOption
        onChange={vi.fn()}
        onEnd={onEnd}
        remembered
        value="auto"
      />,
    );

    expect(screen.getByTestId("race-remembered")).toHaveTextContent(
      /read as a race's, so Race Mode stays on after you disconnect/,
    );
    const end = screen.getByTestId("race-end");
    expect(end).toHaveAccessibleName("The race is over");
    expect(end).toHaveAccessibleDescription(/read as a race's/);
    expect(onEnd).not.toHaveBeenCalled();

    fireEvent.click(end);

    expect(onEnd).toHaveBeenCalledOnce();
  });
});
