import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BigKeyToggle } from "./BigKeyToggle";

const toggle = () => screen.getByTestId("key-cells-toggle");

describe("BigKeyToggle", () => {
  const onToggle = vi.fn();

  beforeEach(() => onToggle.mockClear());

  it("offers to hide the key cells while they are shown", () => {
    render(<BigKeyToggle isVisible onToggle={onToggle} />);

    expect(toggle()).toHaveAccessibleName("Hide big keys");
    expect(toggle()).toHaveClass("bigkey-toggle--active");
    expect(toggle().querySelector(".bigkey-toggle__slash")).toBeNull();
  });

  it("offers to show them while they are hidden, with a slashed key", () => {
    render(<BigKeyToggle isVisible={false} onToggle={onToggle} />);

    expect(toggle()).toHaveAccessibleName("Show big keys");
    expect(toggle()).not.toHaveClass("bigkey-toggle--active");
    expect(toggle().querySelector(".bigkey-toggle__slash")).not.toBeNull();
  });

  it("asks for the opposite state when clicked", async () => {
    const user = userEvent.setup();
    render(<BigKeyToggle isVisible onToggle={onToggle} />);

    await user.click(toggle());

    expect(onToggle).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("keeps its key icon out of the accessibility tree and inside phrasing content", () => {
    render(<BigKeyToggle isVisible={false} onToggle={onToggle} />);
    const icon = toggle().querySelector(".bigkey-toggle__icon");

    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(toggle().querySelectorAll("div")).toHaveLength(0);
    expect(toggle()).toHaveAttribute("type", "button");
  });
});
