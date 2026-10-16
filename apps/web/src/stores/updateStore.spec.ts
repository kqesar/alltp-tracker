import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUILD_REPLY_TIMEOUT_MS,
  checkForUpdates,
  registerServiceWorker,
  UPDATE_CHECK_INTERVAL_MS,
  useUpdateStore,
} from "@/stores/updateStore";

/** The build the page under test runs, and a later one. */
const PAGE_BUILD = "build-1";
const NEXT_BUILD = "build-2";

/** A message channel that delivers at once, so each test runs in order. */
class InstantChannel {
  port1 = {
    close: () => undefined,
    onmessage: null as ((event: { data: unknown }) => void) | null,
  };
  port2 = { postMessage: (data: unknown) => this.port1.onmessage?.({ data }) };
}

/**
 * Just enough of the Service Worker API for the page's side of an update:
 * the browser's part (installing, activating) is played by the test. A
 * worker answers which build it serves, unless it is `silent`.
 */
class FakeWorker extends EventTarget {
  constructor(
    readonly build: string,
    public state: ServiceWorkerState = "installing",
    readonly silent = false,
  ) {
    super();
  }

  postMessage = vi.fn((message: unknown, ports?: InstantChannel["port2"][]) => {
    if (message === "get-build" && !this.silent) {
      ports?.[0]?.postMessage(this.build);
    }
  });

  moveTo(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }

  /** Whether the page asked it to take over. */
  get activated() {
    return this.postMessage.mock.calls.some(
      ([type]) => type === "skip-waiting",
    );
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  update = vi.fn(async () => undefined);

  /** The browser found a new script and starts installing it. */
  find(worker: FakeWorker) {
    this.installing = worker;
    this.dispatchEvent(new Event("updatefound"));
  }
}

class FakeContainer extends EventTarget {
  registration = new FakeRegistration();
  register = vi.fn(async () => this.registration);

  constructor(public controller: FakeWorker | null) {
    super();
  }

  /** A worker took control of the page. */
  takeOver(worker: FakeWorker) {
    this.controller = worker;
    this.dispatchEvent(new Event("controllerchange"));
  }
}

const SCRIPT = "/alltp-tracker/sw.js";

const register = async (container: FakeContainer, reload = vi.fn()) => {
  await registerServiceWorker(container as unknown as ServiceWorkerContainer, {
    build: PAGE_BUILD,
    reload,
    url: SCRIPT,
  });
  return reload;
};

/** Let the page's questions to the workers get their answers. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const apply = () => useUpdateStore.getState().apply;

/** A page some worker of this build already controls. */
const controlledPage = () =>
  new FakeContainer(new FakeWorker(PAGE_BUILD, "activated"));

describe("registerServiceWorker", () => {
  beforeEach(() => {
    vi.stubGlobal("MessageChannel", InstantChannel);
    useUpdateStore.setState(useUpdateStore.getInitialState(), true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("registers the worker script it is given", async () => {
    const container = new FakeContainer(null);

    await register(container);

    expect(container.register).toHaveBeenCalledExactlyOnceWith(SCRIPT);
  });

  it("offers nothing on a first visit, when the worker installs and takes over", async () => {
    const container = new FakeContainer(null);
    const reload = await register(container);
    const worker = new FakeWorker(PAGE_BUILD);

    container.registration.find(worker);
    worker.moveTo("installed");
    worker.moveTo("activated");
    container.takeOver(worker);
    await settle();

    expect(apply()).toBeNull();
    expect(worker.activated).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("offers a newer version installed while the page runs, and waits", async () => {
    const container = controlledPage();
    const reload = await register(container);
    const next = new FakeWorker(NEXT_BUILD);

    container.registration.find(next);
    await settle();
    expect(apply()).toBeNull();
    next.moveTo("installed");
    await settle();

    expect(apply()).toBeTypeOf("function");
    expect(next.activated).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("offers a newer version already waiting when the page loads", async () => {
    const container = controlledPage();
    container.registration.waiting = new FakeWorker(NEXT_BUILD, "installed");

    await register(container);
    await settle();

    expect(apply()).toBeTypeOf("function");
  });

  it("offers a version the browser was still installing when the page registered", async () => {
    const container = controlledPage();
    const next = new FakeWorker(NEXT_BUILD);
    container.registration.installing = next;
    await register(container);
    await settle();
    expect(apply()).toBeNull();

    next.moveTo("installed");
    await settle();

    expect(apply()).toBeTypeOf("function");
  });

  it("switches in silence to a waiting worker of the build the page runs", async () => {
    // The page came from the network, the worker controlling it is older
    const container = new FakeContainer(new FakeWorker("build-0", "activated"));
    const reload = await register(container);
    const current = new FakeWorker(PAGE_BUILD);
    container.registration.find(current);
    current.moveTo("installed");
    await settle();

    expect(current.activated).toBe(true);
    container.takeOver(current);
    await settle();
    expect(apply()).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it("on Reload, activates the waiting version, then reloads under it", async () => {
    const container = controlledPage();
    const reload = await register(container);
    const next = new FakeWorker(NEXT_BUILD);
    container.registration.find(next);
    next.moveTo("installed");
    await settle();

    apply()?.();

    expect(next.activated).toBe(true);
    expect(reload).not.toHaveBeenCalled();
    container.takeOver(next);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("never reloads on its own when another tab switched to a newer version", async () => {
    const container = controlledPage();
    const reload = await register(container);

    container.takeOver(new FakeWorker(NEXT_BUILD, "activated"));
    await settle();

    expect(reload).not.toHaveBeenCalled();
    apply()?.();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("offers nothing when another tab switched to the build this page runs", async () => {
    const container = new FakeContainer(new FakeWorker("build-0", "activated"));
    const reload = await register(container);

    container.takeOver(new FakeWorker(PAGE_BUILD, "activated"));
    await settle();

    expect(apply()).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it("offers a waiting worker that never says its build, once it had time to", async () => {
    vi.useFakeTimers();
    const container = controlledPage();
    container.registration.waiting = new FakeWorker(
      PAGE_BUILD,
      "installed",
      true,
    );
    await register(container);
    await vi.advanceTimersByTimeAsync(BUILD_REPLY_TIMEOUT_MS - 1);
    expect(apply()).toBeNull();

    await vi.advanceTimersByTimeAsync(1);

    expect(apply()).toBeTypeOf("function");
  });

  it("offers a later version to a page the first visit's worker took over", async () => {
    const container = new FakeContainer(null);
    const reload = await register(container);
    const first = new FakeWorker(PAGE_BUILD);
    container.registration.find(first);
    first.moveTo("installed");
    container.takeOver(first);

    const next = new FakeWorker(NEXT_BUILD);
    container.registration.find(next);
    next.moveTo("installed");
    await settle();

    expect(apply()).toBeTypeOf("function");
    expect(reload).not.toHaveBeenCalled();
  });

  it("forgets the offer once dismissed", async () => {
    const container = controlledPage();
    container.registration.waiting = new FakeWorker(NEXT_BUILD, "installed");
    await register(container);
    await settle();

    useUpdateStore.getState().dismiss();

    expect(apply()).toBeNull();
  });
});

describe("checkForUpdates", () => {
  let registration: FakeRegistration;
  let stop: () => void;

  /** Make the page visible or hidden, as switching tabs does. */
  const showPage = (visible: boolean) => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue(
      visible ? "visible" : "hidden",
    );
    document.dispatchEvent(new Event("visibilitychange"));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    registration = new FakeRegistration();
    stop = checkForUpdates(
      registration as unknown as ServiceWorkerRegistration,
    );
  });

  afterEach(() => {
    stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("checks every hour", () => {
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS - 1);
    expect(registration.update).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(registration.update).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(registration.update).toHaveBeenCalledTimes(2);
  });

  it("checks when the tab comes back into view, not when it leaves", () => {
    showPage(false);
    expect(registration.update).not.toHaveBeenCalled();

    showPage(true);
    expect(registration.update).toHaveBeenCalledOnce();
  });

  it("checks when the network returns", () => {
    window.dispatchEvent(new Event("online"));

    expect(registration.update).toHaveBeenCalledOnce();
  });

  it("lets a check fail offline, quietly", async () => {
    registration.update.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);

    expect(registration.update).toHaveBeenCalledOnce();
  });

  it("stops checking once stopped", () => {
    stop();

    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    window.dispatchEvent(new Event("online"));
    showPage(true);

    expect(registration.update).not.toHaveBeenCalled();
  });
});
