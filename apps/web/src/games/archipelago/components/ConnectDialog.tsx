import {
  type AddressError,
  addressClass,
  connectPlan,
  describeReach,
  describeStatus,
  diagnosticReport,
  isArchipelagoGg,
  type LocalNetworkPermissionName,
  type PageContext,
  type PermissionStateName,
  parseAddress,
  parseRoomStatus,
  type Reach,
  type RoomPlayer,
  reachOf,
  roomAddress,
  roomPageUrl,
  roomStatusUrl,
  type ServerAddress,
  type SessionStatus,
  type SetupStepId,
  setupProgress,
} from "@alltp/archipelago";
import { type FormEvent, useEffect, useId, useState } from "react";
import { StatusDot } from "@/components/autotrack/StatusDot";
import { Modal } from "@/components/ui/Modal";
import {
  connect,
  currentPage,
  currentPermission,
  disconnect,
  readPassword,
  retry,
  savePassword,
  saveRoom,
  stop,
  useApConnectionStore,
} from "@/games/archipelago/connection";
import { joinLinkUrl } from "@/games/archipelago/joinLink";
import { headlineOf, phaseOf, waits } from "@/games/archipelago/status";
import { useStatusLine } from "@/hooks/useStatusLine";
import { copyStatus, copyText } from "@/utils/clipboard";
import { isDesktopApp } from "@/utils/platform";
import { shareBaseUrl } from "@/utils/view";

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
 * The pre-check of the address typed, made before any socket: what this
 * page will meet reaching it (`reachOf`), the browser's local network
 * permission read and followed while the address needs it, and what the
 * session met there: a refusal it reports for this address says so too,
 * though the permission may still read "prompt" (a dismissed prompt).
 */
const useReach = (
  address: ServerAddress | null,
  page: PageContext,
  status: SessionStatus,
): Reach => {
  const plan = address === null ? null : connectPlan(address, page);
  const name = plan?.ok ? plan.permission : null;
  const [read, setRead] = useState<{
    name: LocalNetworkPermissionName;
    state: PermissionStateName;
  } | null>(null);
  useEffect(() => {
    if (name === null) return;
    const permission = currentPermission(name);
    let live = true;
    const update = () =>
      void permission.query().then(({ state }) => {
        if (live) setRead({ name, state });
      });
    update();
    const unsubscribe = permission.subscribe(update);
    return () => {
      live = false;
      unsubscribe();
    };
  }, [name]);
  if (address === null) return { kind: "open" };
  const refused =
    status.code === "local-network-denied" &&
    plan?.ok === true &&
    plan.urls.includes(status.url)
      ? status.state
      : null;
  return reachOf(
    address,
    page,
    read?.name === name ? read.state : null,
    refused,
  );
};

/** The way the Room field's note looks: a warning for a refusal. */
const REACH_TONE: Record<Reach["kind"], "note" | "warning"> = {
  ask: "note",
  "blocked-browser": "warning",
  "blocked-insecure": "warning",
  denied: "warning",
  open: "note",
};

const STATE_NAMES = {
  done: "done",
  failing: "needs attention",
  pending: "to do",
} as const;

/** The guide's steps, ticked from the status: the first to fix opens. */
const Steps = ({
  host,
  page,
  status,
}: {
  host: string;
  page: PageContext;
  status: SessionStatus;
}) => {
  const progress = setupProgress(status, {
    browser: page.kind === "secure" ? page.browser : null,
    host:
      isArchipelagoGg(host) || host === "" ? "archipelago.gg" : "self-hosted",
    page: isDesktopApp ? "desktop" : "site",
    where: host === "" ? null : addressClass(host),
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
          {done} of {progress.steps.length} steps done
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
 * session waits, and the steps ticked live. Under the Room field, the
 * pre-check says what this browser will do with the address (ask for its
 * local network permission, or refuse) and the way out, before any socket
 * opens. A join link fills Room and Slot in, never connecting on its own;
 * "Copy a join link" makes one of the fields (never the password).
 * @param onClose - Called to close the dialog
 */
export const ConnectDialog = ({ onClose }: { onClose: () => void }) => {
  const saved = useApConnectionStore.getState();
  const active = useApConnectionStore((state) => state.active);
  const status = useApConnectionStore((state) => state.status);
  const since = useApConnectionStore((state) => state.since);
  const roomLink = useApConnectionStore((state) => state.roomLink);
  const [prefilled] = useState(saved.prefill !== null);
  // Where typing starts: the Room field of a first visit; after a join link,
  // the slot it left empty, else the password (Enter then connects)
  const [focusOn] = useState(() =>
    saved.prefill !== null
      ? saved.prefill.slot === ""
        ? "slot"
        : "password"
      : saved.address === ""
        ? "room"
        : null,
  );
  const [room, setRoom] = useState(
    saved.prefill?.room ?? saved.roomLink ?? saved.address,
  );
  const [slot, setSlot] = useState(saved.prefill?.slot ?? saved.slot);
  const [password, setPassword] = useState(readPassword);
  const [remember, setRemember] = useState(saved.rememberPassword);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useStatusLine();
  const [joinCopied, setJoinCopied] = useStatusLine();
  const id = useId();
  const phase = phaseOf(status);
  const [page] = useState(currentPage);

  // The join link's fields are in the form now: a later opening shows the saved room
  useEffect(() => {
    if (useApConnectionStore.getState().prefill !== null) {
      useApConnectionStore.setState({ prefill: null });
    }
  }, []);

  const server = (() => {
    const parsed = parseAddress(resolved?.address ?? room);
    return parsed.ok && parsed.kind === "server" ? parsed.address : null;
  })();
  const parsedHost = server?.host ?? "";
  const reach = useReach(server, page, status);
  const reachText = describeReach(reach);

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
    const target = parseAddress(address);
    if (!target.ok || target.kind !== "server") return;
    // A refusal the browser would make anyway: no socket, the way out instead
    const blocked = reachOf(target.address, page, null);
    if (
      blocked.kind === "blocked-insecure" ||
      blocked.kind === "blocked-browser"
    ) {
      setRoomError(describeReach(blocked));
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

  /** A link that opens this dialog with the room and the slot filled in. */
  const copyJoinLink = async () => {
    const parsed = parseAddress(room);
    if (!parsed.ok) {
      setRoomError(ADDRESS_ERRORS[parsed.error]);
      return;
    }
    setJoinCopied(
      copyStatus(await copyText(joinLinkUrl(shareBaseUrl(), { room, slot }))),
    );
  };

  const copyReport = async () => {
    const parsed = parseAddress(useApConnectionStore.getState().address);
    const report = diagnosticReport({
      address: parsed.ok && parsed.kind === "server" ? parsed.address : null,
      now: Date.now(),
      page: currentPage(),
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

        {prefilled && (
          <p className="ap-connect__prefill" data-testid="ap-prefill-note">
            Filled in from a join link. Check the room and your slot, add the
            password if the room has one, then Connect.
          </p>
        )}

        <form className="ap-connect__form" noValidate onSubmit={submit}>
          <div className="ap-field">
            <label className="ap-field__label" htmlFor={`${id}-room`}>
              Room
            </label>
            <input
              aria-describedby={`${id}-room-hint${roomError ? ` ${id}-room-error` : reachText !== null ? ` ${id}-room-reach` : ""}`}
              aria-invalid={roomError !== null}
              autoComplete="off"
              className="ap-field__input"
              data-autofocus={focusOn === "room" ? true : undefined}
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
            {roomError === null && reachText !== null && (
              <p
                className="ap-field__reach"
                data-kind={reach.kind}
                data-testid="ap-room-reach"
                data-tone={REACH_TONE[reach.kind]}
                id={`${id}-room-reach`}
              >
                <span aria-hidden="true" className="ap-field__reach-mark">
                  {REACH_TONE[reach.kind] === "warning" ? "!" : "i"}
                </span>
                {reachText}
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
                data-autofocus={focusOn === "slot" ? true : undefined}
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
              data-autofocus={focusOn === "password" ? true : undefined}
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

        <section aria-labelledby={`${id}-join`} className="ap-join">
          <h3 className="autotrack__heading" id={`${id}-join`}>
            Join link
          </h3>
          <p className="ap-join__text" id={`${id}-join-hint`}>
            A link that opens this dialog with the room and your slot filled in,
            on another device or for a teammate. It never holds the password,
            and it does not connect until Connect is pressed.
          </p>
          <div className="autotrack-actions">
            <button
              aria-describedby={`${id}-join-hint`}
              className="modal-btn modal-btn--ghost"
              data-testid="ap-copy-join"
              onClick={() => void copyJoinLink()}
              type="button"
            >
              Copy a join link
            </button>
            <p aria-live="polite" className="autotrack-actions__status">
              {joinCopied}
            </p>
          </div>
        </section>

        <Steps host={parsedHost} page={page} status={status} />

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
