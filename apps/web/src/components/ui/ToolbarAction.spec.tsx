import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolbarAction } from "@/components/ui/ToolbarAction";
import { ToolbarMenuItem } from "@/components/ui/ToolbarMenu";

const WHY = "Off for the test.";

describe("ToolbarAction", () => {
  it("runs its command while it works", () => {
    const onClick = vi.fn();
    const onUnavailable = vi.fn();
    render(
      <ToolbarAction
        icon={null}
        label="Export"
        onClick={onClick}
        onUnavailable={onUnavailable}
        testId="action"
        title="Export it"
      />,
    );

    fireEvent.click(screen.getByTestId("action"));

    expect(onClick).toHaveBeenCalledOnce();
    expect(onUnavailable).not.toHaveBeenCalled();
    expect(screen.getByTestId("action")).not.toHaveAttribute("aria-disabled");
  });

  it("never runs its command while off, only says why, and keeps its focus", () => {
    const onClick = vi.fn();
    const onUnavailable = vi.fn();
    render(
      <ToolbarAction
        icon={null}
        label="Export"
        onClick={onClick}
        onUnavailable={onUnavailable}
        testId="action"
        title="Export it"
        unavailable={WHY}
      />,
    );
    const action = screen.getByTestId("action");
    expect(action).toHaveAttribute("aria-disabled", "true");
    expect(action).not.toBeDisabled();
    expect(action).toHaveAccessibleName("Export");
    expect(action).toHaveAccessibleDescription(WHY);

    action.focus();
    fireEvent.click(action);
    fireEvent.click(action);

    expect(onClick).not.toHaveBeenCalled();
    expect(onUnavailable).toHaveBeenCalledTimes(2);
    expect(onUnavailable).toHaveBeenCalledWith(WHY);
    expect(action).toHaveFocus();
  });
});

describe("ToolbarMenuItem", () => {
  it("runs its command while it works, never while off", () => {
    const onSelect = vi.fn();
    const onUnavailable = vi.fn();
    const { rerender } = render(
      <ToolbarMenuItem
        icon={null}
        label="Export"
        onSelect={onSelect}
        onUnavailable={onUnavailable}
        testId="item"
      />,
    );
    fireEvent.click(screen.getByTestId("item"));
    expect(onSelect).toHaveBeenCalledOnce();

    rerender(
      <ToolbarMenuItem
        icon={null}
        label="Export"
        onSelect={onSelect}
        onUnavailable={onUnavailable}
        testId="item"
        unavailable={WHY}
      />,
    );
    const item = screen.getByTestId("item");
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAccessibleDescription(WHY);
    fireEvent.click(item);

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onUnavailable).toHaveBeenCalledWith(WHY);
  });
});
