import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));

const { ASKED_KEY, useAppMenuStore } = await import("@/desktop/appMenu");
const { default: AppMenuPrompt } = await import("@/desktop/AppMenuPrompt");

const prompt = () => screen.getByTestId("app-menu-prompt");
const add = () => screen.getByTestId("app-menu-add");
const later = () => screen.getByTestId("app-menu-later");

const available = { added: false, available: true };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAppMenuStore.setState(
    { ...useAppMenuStore.getInitialState(), asked: false },
    true,
  );
});

describe("AppMenuPrompt", () => {
  it("keeps an empty live region until the app says it can add the entry", () => {
    render(<AppMenuPrompt />);

    expect(prompt()).toHaveRole("status");
    expect(prompt()).toBeEmptyDOMElement();
  });

  it("stays empty where there is nothing to add: a package, or the entry already there", () => {
    render(<AppMenuPrompt />);

    act(() =>
      useAppMenuStore.setState({ state: { added: false, available: false } }),
    );
    expect(prompt()).toBeEmptyDOMElement();

    act(() =>
      useAppMenuStore.setState({ state: { added: true, available: true } }),
    );
    expect(prompt()).toBeEmptyDOMElement();
  });

  it("asks once, announced in its region, with its two buttons", () => {
    render(<AppMenuPrompt />);
    act(() => useAppMenuStore.setState({ state: available }));

    expect(prompt()).toHaveTextContent(
      "Add Rando Atlas to your application menu?",
    );
    expect(add()).toHaveRole("button");
    expect(add()).toHaveAccessibleName("Add");
    expect(later()).toHaveRole("button");
    expect(later()).toHaveAccessibleName("Not now");
    expect(prompt()).toContainElement(add());
    expect(prompt()).toContainElement(later());
  });

  it("adds the entry on Add, and the notice goes", async () => {
    const user = userEvent.setup();
    tauri.invoke.mockResolvedValue({ added: true, available: true });
    useAppMenuStore.setState({ state: available });
    render(<AppMenuPrompt />);

    await user.click(add());

    expect(tauri.invoke).toHaveBeenCalledWith("app_menu_set", { added: true });
    expect(prompt()).toBeEmptyDOMElement();
  });

  it("says why when the entry could not be added, and keeps the offer", async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tauri.invoke.mockRejectedValue("permission denied");
    useAppMenuStore.setState({ state: available });
    render(<AppMenuPrompt />);

    await user.click(add());

    expect(prompt()).toHaveTextContent(
      "It could not be added: permission denied",
    );
    expect(add()).toBeEnabled();
    warn.mockRestore();
  });

  it("remembers Not now: the notice goes, and is not shown at the next launch", async () => {
    const user = userEvent.setup();
    useAppMenuStore.setState({ state: available });
    const { unmount } = render(<AppMenuPrompt />);

    await user.click(later());

    expect(prompt()).toBeEmptyDOMElement();
    expect(tauri.invoke).not.toHaveBeenCalled();
    expect(localStorage.getItem(ASKED_KEY)).toBe("1");
    unmount();

    // A new page: the store starts from what was saved
    vi.resetModules();
    const fresh = await import("@/desktop/appMenu");
    const { default: Prompt } = await import("@/desktop/AppMenuPrompt");
    fresh.useAppMenuStore.setState({ state: available });
    render(<Prompt />);
    expect(prompt()).toBeEmptyDOMElement();
  });

  it("is driven from the keyboard", async () => {
    const user = userEvent.setup();
    useAppMenuStore.setState({ state: available });
    render(<AppMenuPrompt />);

    await user.tab();
    expect(add()).toHaveFocus();
    await user.tab();
    expect(later()).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(prompt()).toBeEmptyDOMElement();
  });
});
