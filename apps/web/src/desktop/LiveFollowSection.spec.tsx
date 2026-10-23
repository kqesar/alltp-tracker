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

  beforeEach(() => {
    vi.clearAllMocks();
    writeText.mockReset().mockResolvedValue();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    tauri.invoke.mockImplementation(async (command: string) =>
      command === "follow_start" ? SESSION : undefined,
    );
  });
  afterEach(() => {
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

  it("says why it could not start", () => {
    useLiveFollowStore.setState({ error: "Address in use" });
    render(<LiveFollowSection />);

    expect(screen.getByTestId("live-follow-error")).toHaveTextContent(
      "Live follow could not start: Address in use",
    );
  });
});
