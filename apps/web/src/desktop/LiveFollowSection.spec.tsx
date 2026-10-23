import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tauri = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: tauri.listen }));

const { useLiveFollowStore } = await import("@/desktop/liveFollow");
const { default: LiveFollowSection, viewersText } = await import(
  "@/desktop/LiveFollowSection"
);

const SESSION = {
  lanFound: true,
  port: 23075,
  url: "http://192.168.1.20:23075/?view=follow&token=abcdefghijklmnopqrstuv",
  viewers: 0,
};

describe("viewersText", () => {
  it("counts the devices that follow", () => {
    expect(viewersText(0)).toBe("No device follows yet.");
    expect(viewersText(1)).toBe("1 device follows.");
    expect(viewersText(3)).toBe("3 devices follow.");
  });
});

describe("LiveFollowSection", () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();
  // jsdom lays nothing out, so it has no scrollIntoView
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = scrollIntoView;
    writeText.mockReset().mockResolvedValue();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    tauri.invoke.mockImplementation(async (command: string) =>
      command === "follow_start" ? SESSION : undefined,
    );
  });
  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
    vi.unstubAllGlobals();
    useLiveFollowStore.setState(useLiveFollowStore.getInitialState(), true);
  });

  it("is off at first, with what it does", () => {
    render(<LiveFollowSection />);

    expect(
      screen.getByRole("region", { name: "Follow live on this network" }),
    ).toBeInTheDocument();
    const toggle = screen.getByTestId("live-follow-switch");
    expect(toggle).toHaveAttribute("role", "switch");
    expect(toggle).toHaveAccessibleName("Share the run live");
    expect(toggle).not.toBeChecked();
    expect(screen.getByText(/same Wi-Fi/)).toBeInTheDocument();
    expect(screen.queryByTestId("live-follow-url")).not.toBeInTheDocument();
  });

  it("turned on, shows the live link, its QR code and who follows", async () => {
    render(<LiveFollowSection />);

    fireEvent.click(screen.getByTestId("live-follow-switch"));

    expect(await screen.findByTestId("share-qr")).toHaveAccessibleName(
      "QR code of the live link",
    );
    expect(screen.getByTestId("live-follow-switch")).toBeChecked();
    expect(screen.getByTestId("live-follow-url")).toHaveTextContent(
      SESSION.url,
    );
    expect(screen.getByTestId("live-follow-viewers")).toHaveTextContent(
      "No device follows yet.",
    );
    expect(screen.getByText(/firewall/)).toHaveTextContent("port 23075");
    expect(screen.queryByTestId("live-follow-no-lan")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("live-follow-copy"));
    expect(await screen.findByText("Copied.")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(SESSION.url);

    fireEvent.click(screen.getByTestId("live-follow-switch"));
    await vi.waitFor(() =>
      expect(screen.queryByTestId("live-follow-url")).not.toBeInTheDocument(),
    );
    expect(tauri.invoke).toHaveBeenCalledWith("follow_stop");
  });

  it("says when the computer is on no network", () => {
    useLiveFollowStore.setState({
      session: { ...SESSION, lanFound: false, url: "http://127.0.0.1:23075/" },
    });
    render(<LiveFollowSection />);

    expect(screen.getByTestId("live-follow-no-lan")).toHaveTextContent(
      "only it can open the link",
    );
  });

  it("says why it could not start, as an alert", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tauri.invoke.mockRejectedValueOnce("Address in use");
    render(<LiveFollowSection />);
    // Mounted empty first: a live region announces what enters it
    const alert = screen.getByRole("alert");
    expect(alert).toBeEmptyDOMElement();

    fireEvent.click(screen.getByTestId("live-follow-switch"));

    await vi.waitFor(() =>
      expect(alert).toHaveTextContent(
        "Live follow could not start: Address in use",
      ),
    );
    expect(screen.getByTestId("live-follow-error")).toBe(alert);
    expect(screen.getByTestId("live-follow-switch")).not.toBeChecked();
    warn.mockRestore();
  });

  it("keeps the switch focusable while it works, and ignores a second press", async () => {
    let started: (session: typeof SESSION) => void = () => {};
    tauri.invoke.mockImplementation(
      (command: string) =>
        new Promise((resolve) => {
          if (command === "follow_start") started = resolve;
        }),
    );
    render(<LiveFollowSection />);
    const toggle = screen.getByTestId("live-follow-switch");
    toggle.focus();

    fireEvent.click(toggle);

    // Busy, not disabled: a disabled button would drop the focus to the page
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(toggle).toBeEnabled();
    expect(toggle).toHaveFocus();
    fireEvent.click(toggle);
    expect(tauri.invoke).toHaveBeenCalledTimes(1);

    started(SESSION);
    await vi.waitFor(() => expect(toggle).toBeChecked());
    expect(toggle).toHaveAttribute("aria-disabled", "false");
    expect(toggle).toHaveFocus();
  });

  it("scrolls the live link into view when the player turns it on, not when it was on", async () => {
    useLiveFollowStore.setState({ session: SESSION });
    const { unmount } = render(<LiveFollowSection />);
    expect(scrollIntoView).not.toHaveBeenCalled();
    unmount();
    useLiveFollowStore.setState({ session: null });

    render(<LiveFollowSection />);
    fireEvent.click(screen.getByTestId("live-follow-switch"));
    await screen.findByTestId("live-follow-url");

    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    const link = scrollIntoView.mock.contexts[0] as Element;
    expect(link).toContainElement(screen.getByTestId("live-follow-url"));
    expect(link).toContainElement(screen.getByTestId("live-follow-copy"));
  });
});
