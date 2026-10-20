import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));

const { useAppMenuStore } = await import("@/desktop/appMenu");
const { default: AppMenuItem } = await import("@/desktop/AppMenuItem");

const item = () => screen.getByTestId("toolbar-more-app-menu");
const onStatus = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAppMenuStore.setState(useAppMenuStore.getInitialState(), true);
});

describe("AppMenuItem", () => {
  it("renders nothing where the entry cannot be added", () => {
    const { container } = render(<AppMenuItem onStatus={onStatus} />);
    expect(container).toBeEmptyDOMElement();

    act(() =>
      useAppMenuStore.setState({ state: { added: false, available: false } }),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers to add the entry, as a menu item", () => {
    useAppMenuStore.setState({ state: { added: false, available: true } });
    render(<AppMenuItem onStatus={onStatus} />);

    expect(item()).toHaveRole("menuitem");
    expect(item()).toHaveAccessibleName("Add to application menu");
  });

  it("offers to remove it once it is there", () => {
    useAppMenuStore.setState({ state: { added: true, available: true } });
    render(<AppMenuItem onStatus={onStatus} />);

    expect(item()).toHaveAccessibleName("Remove from application menu");
  });

  it("adds the entry, says so, and then offers to remove it", async () => {
    const user = userEvent.setup();
    tauri.invoke.mockResolvedValue({ added: true, available: true });
    useAppMenuStore.setState({ state: { added: false, available: true } });
    render(<AppMenuItem onStatus={onStatus} />);

    await user.click(item());

    expect(tauri.invoke).toHaveBeenCalledWith("app_menu_set", { added: true });
    expect(onStatus).toHaveBeenCalledWith("Added to the application menu.");
    expect(item()).toHaveAccessibleName("Remove from application menu");
  });

  it("removes the entry and says so", async () => {
    const user = userEvent.setup();
    tauri.invoke.mockResolvedValue({ added: false, available: true });
    useAppMenuStore.setState({ state: { added: true, available: true } });
    render(<AppMenuItem onStatus={onStatus} />);

    await user.click(item());

    expect(tauri.invoke).toHaveBeenCalledWith("app_menu_set", { added: false });
    expect(onStatus).toHaveBeenCalledWith("Removed from the application menu.");
    expect(item()).toHaveAccessibleName("Add to application menu");
  });

  it("says when the change failed, and keeps the item as it was", async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tauri.invoke.mockRejectedValue("denied");
    useAppMenuStore.setState({ state: { added: false, available: true } });
    render(<AppMenuItem onStatus={onStatus} />);

    await user.click(item());

    expect(onStatus).toHaveBeenCalledWith(
      "The application menu could not be changed.",
    );
    expect(item()).toHaveAccessibleName("Add to application menu");
    warn.mockRestore();
  });
});
