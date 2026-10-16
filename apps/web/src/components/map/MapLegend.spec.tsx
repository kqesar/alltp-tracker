import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MapLegend } from "@/components/map/MapLegend";

describe("MapLegend", () => {
  it("renders the four availability states", () => {
    render(<MapLegend />);

    expect(screen.getByText(/available now/i)).toBeInTheDocument();
    expect(screen.getByText(/maybe/i)).toBeInTheDocument();
    expect(screen.getByText(/out of logic/i)).toBeInTheDocument();
    expect(screen.getByText(/opened/i)).toBeInTheDocument();
  });

  it("exposes an accessible label", () => {
    render(<MapLegend />);
    expect(
      screen.getByRole("region", { name: /map availability legend/i }),
    ).toBeInTheDocument();
  });
});
