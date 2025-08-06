import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// Mock component for testing
const SampleComponent = ({
  title,
  count,
}: {
  title: string;
  count: number;
}) => {
  return (
    <div>
      <h1>{title}</h1>
      <p>Count: {count}</p>
      <button onClick={() => {}} type="button">
        Click me
      </button>
    </div>
  );
};

describe("SampleComponent", () => {
  it("renders title correctly", () => {
    render(<SampleComponent count={5} title="Test Title" />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("displays count value", () => {
    render(<SampleComponent count={10} title="Test" />);
    expect(screen.getByText("Count: 10")).toBeInTheDocument();
  });

  it("renders button element", () => {
    render(<SampleComponent count={0} title="Test" />);
    expect(
      screen.getByRole("button", { name: "Click me" }),
    ).toBeInTheDocument();
  });

  it("renders with zero count", () => {
    render(<SampleComponent count={0} title="Zero Test" />);
    expect(screen.getByText("Count: 0")).toBeInTheDocument();
  });
});
