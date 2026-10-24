import {
  type AddressError,
  connectPlan,
  describeStatus,
  diagnosticReport,
  isArchipelagoGg,
  type PageContext,
  parseAddress,
  parseRoomStatus,
  type RoomPlayer,
  roomAddress,
  roomPageUrl,
  roomStatusUrl,
  SETUP_STEPS,
  type ServerAddress,
  type SessionStatus,
  type SetupStepId,
  setupProgress,
} from "@alltp/archipelago";
import { type FormEvent, useId, useState } from "react";
import { StatusDot } from "@/components/autotrack/StatusDot";
import { Modal } from "@/components/ui/Modal";
import {
  connect,
  disconnect,
  pageContext,
  readPassword,
  retry,
  savePassword,
  saveRoom,
  stop,
  useApConnectionStore,
} from "@/games/archipelago/connection";
import { headlineOf, phaseOf, waits } from "@/games/archipelago/status";
import { useStatusLine } from "@/hooks/useStatusLine";
import { copyStatus, copyText } from "@/utils/clipboard";
import { isDesktopApp } from "@/utils/platform";

/** What a Room field the package cannot read means, in a sentence. */
const ADDRESS_ERRORS: Record<AddressError, string> = {
  empty: "Type the room's address, its /connect line or its link.",
  "invalid-host": "That is not a host name or an IP address.",
  "invalid-port": "The port is a number from 1 to 65535.",
  "unexpected-path": "Only a host and a port, such as archipelago.gg:38281.",
  "unsupported-scheme":
    "Use the room's address (archipelago.gg:38281), its /connect line or its archipelago.gg link.",
};

/** The room a room link points at, from archipelago.gg's room status. */
type Resolved = {
  link: string;
  address: string;
  players: readonly RoomPlayer[];
};

/** Reads a room link's port and slots; a sentence when it cannot. */
const resolveRoom = async (
  id: string,
  text: string,
): Promise<Resolved | string> => {
  try {
    const response = await fetch(roomStatusUrl({ id }));
    if (!response.ok) {
      return "archipelago.gg does not know this room. Check the link, or paste the /connect line under it.";
    }
    const status = parseRoomStatus(await response.json());
    if (status === null) {
      return "archipelago.gg answered something else than a room. Paste the /connect line instead.";
    }
    const address = roomAddress(status);
    if (address === null) {
      return "This room has not run yet: open its page on archipelago.gg, then try again.";
    }
    return {
      address: `${address.host}:${address.port}`,
      link: text.trim(),
      players: status.players,
    };
  } catch {
    return "The room's page could not be read. Check your connection, or paste the /connect line instead.";
  }
};

/**
 * The static check made before any socket: why this page cannot reach the
 * address, or null when it may try.
 */
export const blockedWhy = (
  address: ServerAddress,
  page: PageContext = pageContext(),
): string | null => {
  const plan = connectPlan(address, page);
  if (plan.ok) return null;
  const status: SessionStatus =
    plan.code === "blocked-browser" && page.kind === "secure"
      ? {
          addressClass: plan.addressClass,
          browser: page.browser,
          code: "blocked-browser",
        }
      : { addressClass: plan.addressClass, code: "blocked-insecure" };
  return describeStatus(status);
};

const STATE_NAMES = {
  done: "done",
  failing: "needs attention",
  pending: "to do",
} as const;

/** The guide's steps, ticked from the status: the first to fix opens. */
const Steps = ({ host, status }: { host: string; status: SessionStatus }) => {
  const progress = setupProgress(status, {
    host:
      isArchipelagoGg(host) || host === "" ? "archipelago.gg" : "self-hosted",
    page: isDesktopApp ? "desktop" : "site",
  });
  const baseId = useId();
  const [opened, setOpened] = useState<ReadonlySet<SetupStepId>>(
    new Set(progress.focus ? [progress.focus] : []),
  );
  const [focus, setFocus] = useState(progress.focus);
  if (focus !== progress.focus) {
    setFocus(progress.focus);
    setOpened(new Set(progress.focus ? [progress.focus] : []));
  }
  const done = progress.steps.filter((step) => step.state === "done").length;
  return (
    <section aria-labelledby={`${baseId}-title`} className="setup">
      <div className="setup__header">
        <h3 className="autotrack__heading" id={`${baseId}-title`}>
          Steps
        </h3>
        <p className="setup__count" data-testid="ap-steps-count">
          {done} of {SETUP_STEPS.length} steps done
        </p>
      </div>
      <ol className="setup-steps">
        {progress.steps.map(({ state, step, variants }, index) => {
          const isOpen = opened.has(step.id);
          const panelId = `${baseId}-${step.id}`;
          return (
            <li
              className="setup-step"
              data-state={state}
              data-testid={`ap-step-${step.id}`}
              key={step.id}
            >
              <h4 className="setup-step__heading">
                <button
                  aria-controls={panelId}
                  aria-expanded={isOpen}
                  className="setup-step__toggle"
                  onClick={() =>
                    setOpened((current) => {
                      const next = new Set(current);
                      if (!next.delete(step.id)) next.add(step.id);
                      return next;
                    })
                  }
                  type="button"
                >
                  <span aria-hidden="true" className="setup-step__mark">
                    {state === "done"
                      ? "✓"
                      : state === "failing"
                        ? "!"
                        : index + 1}
                  </span>
                  <span className="setup-step__title">{step.title}</span>
                  <span className="sr-only">, {STATE_NAMES[state]}</span>
                </button>
              </h4>
              <div className="setup-step__body" hidden={!isOpen} id={panelId}>
                {variants.map((variant) => (
                  <div className="setup-variant" key={variant.title}>
                    {variants.length > 1 && (
                      <h5 className="setup-variant__title">{variant.title}</h5>
                    )}
                    <ul className="setup-variant__items">
                      {variant.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    {variant.links.map((link) => (
                      <p className="setup-variant__links" key={link.url}>
                        <a
                          href={link.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {link.label}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

/**
 * Connect to a room: the Room field (an address, a /connect line, or an
 * archipelago.gg room link, which fills the port and turns Slot into a list
 * of the room's slots), the slot, the password and whether this device
 * remembers it; the status in words with what to do, Retry now while the
 * session waits, and the steps ticked live. Nothing opens a socket before the
 * static check says this page may.
 * @param onClose - Called to close the dialog
 */
export const ConnectDialog = ({ onClose }: { onClose: () => void }) => {
  const saved = useApConnectionStore.getState();
  const active = useApConnectionStore((state) => state.active);
  const status = useApConnectionStore((state) => state.status);
  const since = useApConnectionStore((state) => state.since);
  const roomLink = useApConnectionStore((state) => state.roomLink);
  const [room, setRoom] = useState(saved.roomLink ?? saved.address);
  const [slot, setSlot] = useState(saved.slot);
  const [password, setPassword] = useState(readPassword);
  const [remember, setRemember] = useState(saved.rememberPassword);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useStatusLine();
  const id = useId();
  const phase = phaseOf(status);

  const parsedHost = (() => {
    const parsed = parseAddress(resolved?.address ?? room);
    return parsed.ok && parsed.kind === "server" ? parsed.address.host : "";
  })();

  /** The room link's port and slots, once. */
  const lookUp = async (text: string): Promise<Resolved | null> => {
    const parsed = parseAddress(text);
    if (!parsed.ok || parsed.kind !== "room-link") return null;
    if (resolved?.link === text.trim()) return resolved;
    setBusy(true);
    const found = await resolveRoom(parsed.room.id, text);
    setBusy(false);
    if (typeof found === "string") {
      setRoomError(found);
      return null;
    }
    setResolved(found);
    setRoomError(null);
    if (!found.players.some((player) => player.name === slot)) {
      setSlot(found.players[0]?.name ?? "");
    }
    return found;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseAddress(room);
    let address = room.trim();
    let link: string | null = null;
    if (!parsed.ok) {
      setRoomError(ADDRESS_ERRORS[parsed.error]);
      return;
    }
    if (parsed.kind === "room-link") {
      const found = await lookUp(room);
      if (found === null) return;
      address = found.address;
      link = found.link;
    }
    const server = parseAddress(address);
    if (!server.ok || server.kind !== "server") return;
    const blocked = blockedWhy(server.address);
    if (blocked !== null) {
      setRoomError(blocked);
      return;
    }
    setRoomError(null);
    if (slot.trim() === "") {
      setSlotError("Type your slot name, exactly as the room lists it.");
      return;
    }
    setSlotError(null);
    saveRoom({ address, roomLink: link, slot });
    savePassword(password, remember);
    stop();
    void connect();
  };

  const copyReport = async () => {
    const parsed = parseAddress(useApConnectionStore.getState().address);
    const report = diagnosticReport({
      address: parsed.ok && parsed.kind === "server" ? parsed.address : null,
      now: Date.now(),
      page: pageContext(),
      snapshot: null,
      status,
      statusSince: since,
    });
    setCopied(copyStatus(await copyText(report)));
  };

  const paused =
    roomLink !== null &&
    ((status.code === "unreachable" && status.hint === "room-paused") ||
      (status.code === "timeout" && status.retryInMs !== null));
  const roomPage = (() => {
    const parsed = roomLink === null ? null : parseAddress(roomLink);
    return parsed?.ok && parsed.kind === "room-link"
      ? roomPageUrl(parsed.room)
      : null;
  })();

  return (
    <Modal
      footer={
        <button
          className="modal-btn modal-btn--ghost"
          onClick={onClose}
          type="button"
        >
          Done
        </button>
      }
      isOpen
      onClose={onClose}
      title="Archipelago room"
      wide
    >
      <div className="autotrack ap-connect" data-testid="ap-connect-dialog">
        <div className="autotrack-status" data-phase={phase}>
          <StatusDot large phase={phase} />
          <div className="autotrack-status__text">
            <p
              className="autotrack-status__headline"
              data-testid="ap-connect-headline"
            >
              {headlineOf(status)}
            </p>
            <p
              className="autotrack-status__detail"
              data-testid="ap-connect-detail"
            >
              {describeStatus(status)}
            </p>
            {paused && roomPage !== null && (
              <p className="autotrack-status__detail">
                <a href={roomPage} rel="noopener noreferrer" target="_blank">
                  Open the room's page to wake it
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            )}
          </div>
        </div>

        <form className="ap-connect__form" noValidate onSubmit={submit}>
          <div className="ap-field">
            <label className="ap-field__label" htmlFor={`${id}-room`}>
              Room
            </label>
            <input
              aria-describedby={`${id}-room-hint${roomError ? ` ${id}-room-error` : ""}`}
              aria-invalid={roomError !== null}
              autoComplete="off"
              className="ap-field__input"
              data-autofocus={saved.address === "" ? true : undefined}
              data-testid="ap-room-input"
              id={`${id}-room`}
              onBlur={() => void lookUp(room)}
              onChange={(event) => {
                setRoom(event.target.value);
                setRoomError(null);
              }}
              spellCheck={false}
              type="text"
              value={room}
            />
            <p className="ap-field__hint" id={`${id}-room-hint`}>
              The room's address (archipelago.gg:38281), the /connect line its
              page shows, or the page's link.
            </p>
            {roomError !== null && (
              <p
                className="ap-field__error"
                data-testid="ap-room-error"
                id={`${id}-room-error`}
              >
                {roomError}
              </p>
            )}
          </div>

          <div className="ap-field">
            <label className="ap-field__label" htmlFor={`${id}-slot`}>
              Slot
            </label>
            {resolved !== null && resolved.link === room.trim() ? (
              <select
                aria-describedby={`${id}-slot-hint`}
                className="ap-field__input"
                data-testid="ap-slot-select"
                id={`${id}-slot`}
                onChange={(event) => setSlot(event.target.value)}
                value={slot}
              >
                {resolved.players.map((player) => (
                  <option key={player.name} value={player.name}>
                    {player.name} · {player.game}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-describedby={`${id}-slot-hint${slotError ? ` ${id}-slot-error` : ""}`}
                aria-invalid={slotError !== null}
                autoCapitalize="off"
                autoComplete="off"
                className="ap-field__input"
                data-testid="ap-slot-input"
                id={`${id}-slot`}
                onChange={(event) => {
                  setSlot(event.target.value);
                  setSlotError(null);
                }}
                spellCheck={false}
                type="text"
                value={slot}
              />
            )}
            <p className="ap-field__hint" id={`${id}-slot-hint`}>
              Your slot's name, exactly as the room lists it: case matters. The
              room sees the tracker join, as a tracker.
            </p>
            {slotError !== null && (
              <p className="ap-field__error" id={`${id}-slot-error`}>
                {slotError}
              </p>
            )}
          </div>

          <div className="ap-field">
            <label className="ap-field__label" htmlFor={`${id}-password`}>
              Password
            </label>
            <input
              aria-describedby={`${id}-password-hint`}
              autoComplete="off"
              className="ap-field__input"
              data-testid="ap-password-input"
              id={`${id}-password`}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
            <p className="ap-field__hint" id={`${id}-password-hint`}>
              Only if the room has one. It stays on this device: never shared,
              exported or put in a report.
            </p>
            <label className="mode-check">
              <input
                checked={remember}
                data-testid="ap-remember"
                onChange={(event) => setRemember(event.target.checked)}
                type="checkbox"
              />
              Remember on this device
            </label>
          </div>

          <div className="autotrack-actions">
            <button
              className="modal-btn modal-btn--primary"
              data-testid="ap-connect"
              disabled={busy}
              type="submit"
            >
              {active ? "Connect again" : "Connect"}
            </button>
            {active && (
              <button
                className="modal-btn modal-btn--ghost"
                data-testid="ap-disconnect"
                onClick={disconnect}
                type="button"
              >
                Disconnect
              </button>
            )}
            {active && waits(status) && (
              <button
                className="modal-btn modal-btn--ghost"
                data-testid="ap-retry"
                onClick={retry}
                type="button"
              >
                Retry now
              </button>
            )}
          </div>
        </form>

        <p className="autotrack-follow__text">
          The board joins the room as a tracker on your slot: it reads what the
          server says you received and checked, and can send nothing.
        </p>

        <Steps host={parsedHost} status={status} />

        <div className="autotrack-actions">
          <button
            className="modal-btn modal-btn--ghost"
            data-testid="ap-copy-report"
            onClick={() => void copyReport()}
            type="button"
          >
            Copy a report
          </button>
          <p aria-live="polite" className="autotrack-actions__status">
            {copied}
          </p>
        </div>
      </div>
    </Modal>
  );
};
