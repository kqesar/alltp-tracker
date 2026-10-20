import { beforeEach, describe, expect, it, vi } from "vitest";

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));

const { ASKED_KEY, useAppMenuStore } = await import("@/desktop/appMenu");

const reset = () => {
  localStorage.clear();
  useAppMenuStore.setState(
    { ...useAppMenuStore.getInitialState(), asked: false },
    true,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  reset();
});

describe("the application menu entry's state", () => {
  it("asks the app how the entry stands", async () => {
    tauri.invoke.mockResolvedValue({ added: false, available: true });

    await useAppMenuStore.getState().load();

    expect(tauri.invoke).toHaveBeenCalledWith("app_menu_state");
    expect(useAppMenuStore.getState().state).toEqual({
      added: false,
      available: true,
    });
  });

  it("stays unknown when the app cannot say", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tauri.invoke.mockRejectedValue(new Error("no such command"));

    await useAppMenuStore.getState().load();

    expect(useAppMenuStore.getState().state).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("adds the entry, takes its new state from the app and counts as an answer", async () => {
    tauri.invoke.mockResolvedValue({ added: true, available: true });

    const worked = await useAppMenuStore.getState().change(true);

    expect(worked).toBe(true);
    expect(tauri.invoke).toHaveBeenCalledWith("app_menu_set", { added: true });
    expect(useAppMenuStore.getState().state?.added).toBe(true);
    expect(useAppMenuStore.getState().asked).toBe(true);
    expect(localStorage.getItem(ASKED_KEY)).toBe("1");
  });

  it("keeps the reason when the change fails, and does not count it as an answer", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tauri.invoke.mockRejectedValue("the app is not running as an AppImage");

    const worked = await useAppMenuStore.getState().change(true);

    expect(worked).toBe(false);
    expect(useAppMenuStore.getState().error).toBe(
      "the app is not running as an AppImage",
    );
    expect(useAppMenuStore.getState().asked).toBe(false);
    expect(localStorage.getItem(ASKED_KEY)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("remembers an answer on this device", () => {
    useAppMenuStore.getState().answer();

    expect(localStorage.getItem(ASKED_KEY)).toBe("1");
  });

  it("works without storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => useAppMenuStore.getState().answer()).not.toThrow();
    expect(useAppMenuStore.getState().asked).toBe(true);
  });
});
