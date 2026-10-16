import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker, useUpdateStore } from "@/stores/updateStore";

/**
 * Just enough of the Service Worker API for the page's side of an update:
 * the browser's part (installing, activating) is played by the test.
 */
class FakeWorker extends EventTarget {
  postMessage = vi.fn();

  constructor(public state: ServiceWorkerState = "installing") {
    super();
  }

  moveTo(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;

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
  await registerServiceWorker(
    container as unknown as ServiceWorkerContainer,
    SCRIPT,
    reload,
  );
  return reload;
};

const apply = () => useUpdateStore.getState().apply;

describe("registerServiceWorker", () => {
  beforeEach(() => {
    useUpdateStore.setState(useUpdateStore.getInitialState(), true);
  });

  it("registers the worker script it is given", async () => {
    const container = new FakeContainer(null);

    await register(container);

    expect(container.register).toHaveBeenCalledExactlyOnceWith(SCRIPT);
  });

  it("offers nothing on a first visit, when the worker installs and takes over", async () => {
    const container = new FakeContainer(null);
    const reload = await register(container);
    const worker = new FakeWorker();

    container.registration.find(worker);
    worker.moveTo("installed");
    worker.moveTo("activated");
    container.takeOver(worker);

    expect(apply()).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it("offers a new version installed while the page runs, without reloading", async () => {
    const container = new FakeContainer(new FakeWorker("activated"));
    const reload = await register(container);
    const next = new FakeWorker();

    container.registration.find(next);
    expect(apply()).toBeNull();
    next.moveTo("installed");

    expect(apply()).toBeTypeOf("function");
    expect(next.postMessage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("offers a version already waiting when the page loads", async () => {
    const container = new FakeContainer(new FakeWorker("activated"));
    container.registration.waiting = new FakeWorker("installed");

    await register(container);

    expect(apply()).toBeTypeOf("function");
  });

  it("offers a version the browser was still installing when the page registered", async () => {
    const container = new FakeContainer(new FakeWorker("activated"));
    const next = new FakeWorker();
    container.registration.installing = next;
    await register(container);
    expect(apply()).toBeNull();

    next.moveTo("installed");

    expect(apply()).toBeTypeOf("function");
  });

  it("on Reload, activates the waiting version, then reloads under it", async () => {
    const container = new FakeContainer(new FakeWorker("activated"));
    const reload = await register(container);
    const next = new FakeWorker();
    container.registration.find(next);
    next.moveTo("installed");

    apply()?.();

    expect(next.postMessage).toHaveBeenCalledExactlyOnceWith("skip-waiting");
    expect(reload).not.toHaveBeenCalled();
    container.takeOver(next);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("never reloads on its own when another tab switched to a new version", async () => {
    const container = new FakeContainer(new FakeWorker("activated"));
    const reload = await register(container);

    container.takeOver(new FakeWorker("activated"));

    expect(reload).not.toHaveBeenCalled();
    apply()?.();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("offers a later version to a page the first visit's worker took over", async () => {
    const container = new FakeContainer(null);
    const reload = await register(container);
    const first = new FakeWorker();
    container.registration.find(first);
    first.moveTo("installed");
    container.takeOver(first);

    const next = new FakeWorker();
    container.registration.find(next);
    next.moveTo("installed");

    expect(apply()).toBeTypeOf("function");
    expect(reload).not.toHaveBeenCalled();
  });

  it("forgets the offer once dismissed", async () => {
    const container = new FakeContainer(new FakeWorker("activated"));
    container.registration.waiting = new FakeWorker("installed");
    await register(container);

    useUpdateStore.getState().dismiss();

    expect(apply()).toBeNull();
  });
});
