import type {
  BrowserFamily,
  PageContext,
  PermissionFactory,
  PermissionStateName,
} from "@alltp/archipelago";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectDialog } from "@/games/archipelago/components/ConnectDialog";
import {
  AP_PASSWORD_KEY,
  setRuntimeOptions,
  stop,
  useApConnectionStore,
} from "@/games/archipelago/connection";
import { ROOM_ADDRESS, startRoom } from "@/games/archipelago/fixtures";

const state = () => useApConnectionStore.getState();

const open = () => render(<ConnectDialog onClose={() => {}} />);

const type = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } });

const submit = () => fireEvent.click(screen.getByTestId("ap-connect"));

/** archipelago.gg's room status, as `fetch` answers it. */
const roomStatus = (body: unknown, ok = true) =>
  vi.fn(async () => ({ json: async () => body, ok }) as Response);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useApConnectionStore.setState(useApConnectionStore.getInitialState(), true);
});

afterEach(() => {
  stop();
  setRuntimeOptions({});
  vi.unstubAllGlobals();
});

describe("the connect dialog", () => {
  it("connects with the room, slot and password typed", async () => {
    startRoom();
    open();
    expect(screen.getByTestId("ap-room-input")).toHaveAccessibleName("Room");
    expect(screen.getByTestId("ap-room-input")).toHaveAccessibleDescription(
      /archipelago\.gg:38281/,
    );
    expect(screen.getByTestId("ap-password-input")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByTestId("ap-password-input")).toHaveAttribute(
      "autocomplete",
      "off",
    );
    type("ap-room-input", `/connect ${ROOM_ADDRESS}`);
    type("ap-slot-input", "Link");
    type("ap-password-input", "secret");
    submit();
    await vi.waitFor(() =>
      expect(screen.getByTestId("ap-connect-headline")).toHaveTextContent(
        "Connected",
      ),
    );
    expect(state()).toMatchObject({
      address: `/connect ${ROOM_ADDRESS}`,
      roomLink: null,
      slot: "Link",
    });
    expect(sessionStorage.getItem(AP_PASSWORD_KEY)).toBe("secret");
    expect(localStorage.getItem(AP_PASSWORD_KEY)).toBeNull();
    expect(screen.getByTestId("ap-step-slot")).toHaveAttribute(
      "data-state",
      "done",
    );
    expect(screen.getByTestId("ap-steps-count")).toHaveTextContent(
      "4 of 4 steps done",
    );
    expect(screen.getByTestId("ap-connect")).toHaveTextContent("Connect again");
    fireEvent.click(screen.getByTestId("ap-disconnect"));
    expect(state().connectOnStart).toBe(false);
    expect(screen.getByTestId("ap-connect-headline")).toHaveTextContent(
      "Not connected",
    );
  });

  it("says what is wrong with the fields before any socket", () => {
    open();
    submit();
    const room = screen.getByTestId("ap-room-input");
    expect(room).toHaveAttribute("aria-invalid", "true");
    expect(room).toHaveAccessibleDescription(/Type the room's address/);
    for (const [text, error] of [
      ["ftp://host", /archipelago\.gg link/],
      ["bad_host", /host name or an IP address/],
      ["host:99999", /1 to 65535/],
      ["host:1/path", /Only a host and a port/],
    ] as const) {
      type("ap-room-input", text);
      expect(room).toHaveAttribute("aria-invalid", "false");
      submit();
      expect(screen.getByTestId("ap-room-error")).toHaveTextContent(error);
    }
    type("ap-room-input", ROOM_ADDRESS);
    submit();
    const slot = screen.getByTestId("ap-slot-input");
    expect(slot).toHaveAttribute("aria-invalid", "true");
    expect(slot).toHaveAccessibleDescription(/Type your slot name/);
    expect(state().active).toBe(false);
  });

  it("turns a room link into its port and a list of its slots", async () => {
    startRoom();
    const fetch = roomStatus({
      last_port: 38281,
      players: [
        ["Link", "A Link to the Past"],
        ["Samus", "Super Metroid"],
      ],
    });
    vi.stubGlobal("fetch", fetch);
    open();
    type("ap-room-input", "https://archipelago.gg/room/AbC");
    fireEvent.blur(screen.getByTestId("ap-room-input"));
    const select = await screen.findByTestId("ap-slot-select");
    expect(fetch).toHaveBeenCalledWith(
      "https://archipelago.gg/api/room_status/AbC",
    );
    expect(select).toHaveDisplayValue("Link · A Link to the Past");
    fireEvent.change(select, { target: { value: "Samus" } });
    submit();
    await vi.waitFor(() => expect(state().active).toBe(true));
    expect(state()).toMatchObject({
      address: "archipelago.gg:38281",
      roomLink: "https://archipelago.gg/room/AbC",
      slot: "Samus",
    });
    // Asked once per link
    fireEvent.blur(screen.getByTestId("ap-room-input"));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("says why a room link gives no address", async () => {
    open();
    const cases: [ReturnType<typeof vi.fn>, RegExp][] = [
      [roomStatus({}, false), /does not know this room/],
      [roomStatus({ players: "?" }), /answered something else/],
      [roomStatus({ last_port: 0, players: [] }), /has not run yet/],
      [
        vi.fn(async () => {
          throw new TypeError("offline");
        }),
        /could not be read/,
      ],
    ];
    for (const [index, [fetch, error]] of cases.entries()) {
      vi.stubGlobal("fetch", fetch);
      type("ap-room-input", `https://archipelago.gg/room/r${index}`);
      submit();
      expect(await screen.findByTestId("ap-room-error")).toHaveTextContent(
        error,
      );
    }
    expect(state().active).toBe(false);
  });

  it("offers Retry now while the session waits, and the room's page when it sleeps", async () => {
    open();
    act(() =>
      useApConnectionStore.setState({
        active: true,
        roomLink: "https://archipelago.gg/room/AbC",
        status: {
          attempt: 3,
          code: "unreachable",
          hint: "room-paused",
          retryInMs: 60_000,
          url: "wss://archipelago.gg:38281",
        },
      }),
    );
    expect(screen.getByTestId("ap-connect-detail")).toHaveTextContent(
      /may be paused/,
    );
    expect(
      screen.getByRole("link", { name: /Open the room's page to wake it/ }),
    ).toHaveAttribute("href", "https://archipelago.gg/room/AbC");
    expect(screen.getByTestId("ap-retry")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ap-retry"));
    expect(screen.getByTestId("ap-step-reach")).toHaveAttribute(
      "data-state",
      "failing",
    );
    // The failing step opens; another opens on a click
    const toggle = screen.getByRole("button", { name: /Your slot name/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("copies a report that never holds the port", async () => {
    const writeText = vi.fn(async (_text: string) => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    useApConnectionStore.setState({ address: ROOM_ADDRESS });
    open();
    fireEvent.click(screen.getByTestId("ap-copy-report"));
    await vi.waitFor(() =>
      expect(screen.getByText("Copied.")).toBeInTheDocument(),
    );
    const report = writeText.mock.calls[0]?.[0] ?? "";
    expect(report).toContain("127.0.0.1:•••••");
    expect(report).not.toContain("38281");
  });

  it("remembers the password on this device on request", async () => {
    startRoom();
    open();
    type("ap-room-input", ROOM_ADDRESS);
    type("ap-slot-input", "Link");
    type("ap-password-input", "secret");
    fireEvent.click(screen.getByTestId("ap-remember"));
    submit();
    await vi.waitFor(() => expect(state().active).toBe(true));
    expect(localStorage.getItem(AP_PASSWORD_KEY)).toBe("secret");
  });
});

/** The browser's local network permission, its state set by the spec. */
const fakePermission = (initial: PermissionStateName) => {
  let state = initial;
  const listeners = new Set<() => void>();
  const asked: string[] = [];
  const factory: PermissionFactory = (name) => {
    asked.push(name);
    return {
      query: async () => ({ name, state }),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };
  const set = (next: PermissionStateName) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return { asked, factory, set };
};

const site = (browser: BrowserFamily): PageContext => ({
  browser,
  kind: "secure",
});

describe("the pre-check, before any socket", () => {
  const reach = () => screen.getByTestId("ap-room-reach");

  it("says the browser will ask, then follows its answer", async () => {
    const permission = fakePermission("prompt");
    setRuntimeOptions({
      page: site("chromium"),
      permission: permission.factory,
    });
    open();
    type("ap-room-input", "ws://127.0.0.1:38281");
    await vi.waitFor(() =>
      expect(reach()).toHaveTextContent(
        "The browser will ask to let this site reach this device: choose Allow.",
      ),
    );
    expect(reach()).toHaveAttribute("data-kind", "ask");
    expect(screen.getByTestId("ap-room-input")).toHaveAccessibleDescription(
      /will ask to let this site reach this device/,
    );
    expect(permission.asked).toEqual(["loopback-network"]);
    // Refused in the site's settings meanwhile: the note says so at once,
    // and how to undo it in Chrome's words
    act(() => permission.set("denied"));
    await vi.waitFor(() =>
      expect(reach()).toHaveTextContent(
        'The browser blocks this site from reaching this device. To undo it, click the icon left of the address and set "Apps on device" to Allow, then Connect.',
      ),
    );
    expect(reach()).toHaveAttribute("data-kind", "denied");
    expect(reach()).toHaveAttribute("data-tone", "warning");
    // Allowed: nothing stands in the way, nothing is said
    act(() => permission.set("granted"));
    await vi.waitFor(() =>
      expect(screen.queryByTestId("ap-room-reach")).toBeNull(),
    );
    // A server on the LAN is the other permission
    type("ap-room-input", "192.168.1.20:38281");
    await vi.waitFor(() =>
      expect(permission.asked).toEqual(["loopback-network", "local-network"]),
    );
  });

  it("follows the session when the browser said no without a denial", async () => {
    // A dismissed (or headless) prompt: the permission still reads "prompt"
    // while the session reports the browser refused
    setRuntimeOptions({
      page: site("chromium"),
      permission: fakePermission("prompt").factory,
    });
    useApConnectionStore.setState({
      status: {
        code: "local-network-denied",
        permission: "local-network",
        retryInMs: null,
        state: "prompt",
        url: "ws://192.168.1.20:38281",
      },
    });
    open();
    type("ap-room-input", "ws://192.168.1.20:38281");
    await vi.waitFor(() =>
      expect(reach()).toHaveTextContent(
        'The browser did not let this site reach your local network. Retry, and choose Allow when it asks; if it no longer asks, click the icon left of the address and set "Local network" to Allow.',
      ),
    );
    expect(reach()).toHaveAttribute("data-tone", "warning");
    // Another address is not the one refused: the browser will ask for it
    type("ap-room-input", "ws://192.168.1.21:38281");
    await vi.waitFor(() => expect(reach()).toHaveAttribute("data-kind", "ask"));
  });

  it("refuses what the browser would refuse, with the way out", () => {
    setRuntimeOptions({
      page: site("chromium"),
      permission: fakePermission("prompt").factory,
    });
    open();
    type("ap-room-input", "ws://example.com:38281");
    expect(reach()).toHaveTextContent(
      "Ask the room's host for a wss:// address, or use the desktop app.",
    );
    type("ap-slot-input", "Link");
    submit();
    expect(screen.getByTestId("ap-room-error")).toHaveTextContent(
      /cannot open an unencrypted ws:\/\/ connection/,
    );
    // The error replaces the note: one sentence, said once
    expect(screen.queryByTestId("ap-room-reach")).toBeNull();
    expect(state().active).toBe(false);
  });

  it("sends Firefox to Chrome, Edge or the desktop app for the LAN", () => {
    setRuntimeOptions({ page: site("firefox") });
    open();
    type("ap-room-input", "ws://192.168.1.20:38281");
    expect(reach()).toHaveTextContent(
      "Firefox does not let a secure site reach a ws:// server on your local network. Use Chrome or Edge, which ask first, or the desktop app.",
    );
    expect(reach()).toHaveAttribute("data-kind", "blocked-browser");
  });

  it("asks the browser's permission step only where it applies", () => {
    setRuntimeOptions({
      page: site("chromium"),
      permission: fakePermission("prompt").factory,
    });
    const { unmount } = open();
    type("ap-room-input", "localhost:38281");
    expect(screen.getByTestId("ap-step-permission")).toHaveTextContent(
      "Allow the connection in the browser",
    );
    type("ap-room-input", "archipelago.gg:38281");
    expect(screen.queryByTestId("ap-step-permission")).toBeNull();
    unmount();
    // This page is http: no browser stands in the way
    setRuntimeOptions({});
    open();
    type("ap-room-input", "ws://example.com:38281");
    expect(screen.queryByTestId("ap-step-permission")).toBeNull();
    expect(screen.queryByTestId("ap-room-reach")).toBeNull();
    type("ap-slot-input", "Link");
    submit();
    expect(screen.queryByTestId("ap-room-error")).toBeNull();
  });
});

describe("join links", () => {
  it("fills the dialog in from a join link, and connects only on Connect", () => {
    startRoom();
    useApConnectionStore.setState({
      address: "archipelago.gg:50000",
      connectOnStart: true,
      prefill: { room: ROOM_ADDRESS, slot: "Link" },
      slot: "Samus",
    });
    open();
    expect(screen.getByTestId("ap-prefill-note")).toHaveTextContent(
      "Filled in from a join link",
    );
    expect(screen.getByTestId("ap-room-input")).toHaveValue(ROOM_ADDRESS);
    expect(screen.getByTestId("ap-slot-input")).toHaveValue("Link");
    expect(screen.getByTestId("ap-password-input")).toHaveValue("");
    // Taken: opening the dialog again shows the saved room
    expect(state().prefill).toBeNull();
    expect(state().active).toBe(false);
  });

  it("copies a link with the room and the slot, never the password", async () => {
    const writeText = vi.fn(async (_text: string) => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    open();
    type("ap-room-input", "/connect archipelago.gg:60030");
    type("ap-slot-input", "Hybrid Hero");
    type("ap-password-input", "secret");
    expect(screen.getByTestId("ap-copy-join")).toHaveAccessibleDescription(
      /never holds the password/,
    );
    fireEvent.click(screen.getByTestId("ap-copy-join"));
    await vi.waitFor(() =>
      expect(screen.getByText("Copied.")).toBeInTheDocument(),
    );
    const url = new URL(writeText.mock.calls[0]?.[0] ?? "");
    expect([...url.searchParams]).toEqual([
      ["game", "archipelago"],
      ["room", "/connect archipelago.gg:60030"],
      ["slot", "Hybrid Hero"],
    ]);
    expect(url.href).not.toContain("secret");
  });

  it("copies nothing for a room it cannot read", () => {
    const writeText = vi.fn(async (_text: string) => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    open();
    type("ap-room-input", "ftp://example.com");
    fireEvent.click(screen.getByTestId("ap-copy-join"));
    expect(screen.getByTestId("ap-room-error")).toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
  });
});
