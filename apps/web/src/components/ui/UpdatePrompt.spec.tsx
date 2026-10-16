import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdatePrompt } from "@/components/ui/UpdatePrompt";
import { useUpdateStore } from "@/stores/updateStore";

const prompt = () => screen.getByTestId("update-prompt");
const reload = () => screen.getByTestId("update-reload");
const dismiss = () => screen.getByTestId("update-dismiss");

describe("UpdatePrompt", () => {
  const apply = vi.fn();

  beforeEach(() => {
    apply.mockClear();
    useUpdateStore.setState(useUpdateStore.getInitialState(), true);
  });

  it("keeps an empty live region while no update is waiting", () => {
    render(<UpdatePrompt />);

    expect(prompt()).toHaveRole("status");
    expect(prompt()).toBeEmptyDOMElement();
  });

  it("announces a waiting update in that region, with its two buttons", () => {
    render(<UpdatePrompt />);
    act(() => useUpdateStore.setState({ apply }));

    expect(prompt()).toHaveRole("status");
    expect(prompt()).toHaveTextContent("A new version is available");
    expect(reload()).toHaveRole("button");
    expect(reload()).toHaveAccessibleName("Reload");
    expect(dismiss()).toHaveRole("button");
    expect(dismiss()).toHaveAccessibleName("Dismiss");
    expect(prompt()).toContainElement(reload());
    expect(prompt()).toContainElement(dismiss());
  });

  it("switches to the new version on Reload", async () => {
    const user = userEvent.setup();
    useUpdateStore.setState({ apply });
    render(<UpdatePrompt />);

    await user.click(reload());

    expect(apply).toHaveBeenCalledOnce();
  });

  it("hides on Dismiss, leaving the new version waiting", async () => {
    const user = userEvent.setup();
    useUpdateStore.setState({ apply });
    render(<UpdatePrompt />);

    await user.click(dismiss());

    expect(prompt()).toBeEmptyDOMElement();
    expect(apply).not.toHaveBeenCalled();
  });

  it("is driven from the keyboard", async () => {
    const user = userEvent.setup();
    useUpdateStore.setState({ apply });
    render(<UpdatePrompt />);

    await user.tab();
    expect(reload()).toHaveFocus();
    await user.tab();
    expect(dismiss()).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(prompt()).toBeEmptyDOMElement();
    expect(apply).not.toHaveBeenCalled();
  });
});
