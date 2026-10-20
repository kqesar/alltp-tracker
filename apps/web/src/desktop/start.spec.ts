import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppMenuStore } from "@/desktop/appMenu";
import { useUpdateStore } from "@/stores/updateStore";

const tauri = vi.hoisted(() => ({
  check: vi.fn(),
  invoke: vi.fn().mockResolvedValue({ added: false, available: false }),
  openUrl: vi.fn().mockResolvedValue(undefined),
  relaunch: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: tauri.openUrl }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: tauri.relaunch }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: tauri.check }));

const { offerUpdate, openLinksOutside, startDesktop } = await import(
  "@/desktop/start"
);

beforeEach(() => {
  useUpdateStore.setState(useUpdateStore.getInitialState(), true);
  vi.clearAllMocks();
});

afterEach(() => {
  document.body.innerHTML = "";
  document.removeEventListener("click", openLinksOutside);
});

describe("the desktop app's updates", () => {
  it("offer a new release as a restart, installed only when the player asks", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    tauri.check.mockResolvedValue({ downloadAndInstall });
    await offerUpdate();
    const { apply, label } = useUpdateStore.getState();
    expect(label).toBe("Restart");
    expect(downloadAndInstall).not.toHaveBeenCalled();
    apply?.();
    await vi.waitFor(() => expect(tauri.relaunch).toHaveBeenCalledOnce());
    expect(downloadAndInstall).toHaveBeenCalledOnce();
  });

  it("offer nothing when the app is up to date, or the check fails", async () => {
    tauri.check.mockResolvedValue(null);
    await offerUpdate();
    expect(useUpdateStore.getState().apply).toBeNull();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tauri.check.mockRejectedValue(new Error("offline"));
    await offerUpdate();
    expect(useUpdateStore.getState().apply).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("the desktop app's application menu entry", () => {
  it("asks the app, at start, whether an AppImage can add itself", async () => {
    tauri.invoke.mockResolvedValueOnce({ added: false, available: true });
    startDesktop();
    document.removeEventListener("click", openLinksOutside);
    await vi.waitFor(() =>
      expect(useAppMenuStore.getState().state).toEqual({
        added: false,
        available: true,
      }),
    );
    expect(tauri.invoke).toHaveBeenCalledWith("app_menu_state");
  });
});

describe("the desktop app's links", () => {
  it("open a link out of the tracker in the system browser, never in its window", () => {
    startDesktop();
    document.body.innerHTML =
      '<a href="https://samus.link/"><span>samus.link</span></a><a href="/?view=obs">here</a>';
    const [outside, inside] = document.querySelectorAll("a");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    outside?.querySelector("span")?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(tauri.openUrl).toHaveBeenCalledWith("https://samus.link/");
    inside?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(tauri.openUrl).toHaveBeenCalledOnce();
    // The dev server is no release: no update check there
    expect(tauri.check).not.toHaveBeenCalled();
  });

  it("say when the app refuses to open a link", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tauri.openUrl.mockRejectedValueOnce(new Error("not allowed"));
    document.body.innerHTML = '<a href="https://alttpr.com/">alttpr.com</a>';
    document.querySelector("a")?.addEventListener("click", openLinksOutside);
    document.querySelector("a")?.click();
    await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce());
    warn.mockRestore();
  });
});
