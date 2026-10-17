import {
  type DeviceKind,
  type Environment,
  type OperatingSystem,
  type SessionStatus,
  type SetupStepId,
  type SetupVariant,
  type StepState,
  setupProgress,
  sniAssets,
} from "@alltp/autotrack";
import { useId, useState } from "react";
import { deviceInUse, type Fix, fixFor } from "@/autotrack/guide";
import { headlineOf } from "@/autotrack/status";
import { type Tab, Tabs, tabId } from "@/components/ui/Tabs";

/** The systems the guide covers, as its tabs. */
const SYSTEMS = [
  { label: "Windows", value: "windows" },
  { label: "macOS", value: "macos" },
  { label: "Linux", value: "linux" },
] as const satisfies readonly Tab<OperatingSystem>[];

type System = (typeof SYSTEMS)[number]["value"];

/** The emulators and consoles the guide has instructions for. */
const DEVICES = [
  { kind: "retroarch", label: "RetroArch" },
  { kind: "fxpakpro", label: "FX Pak Pro (SD2SNES)" },
  { kind: "luabridge", label: "BizHawk" },
  { kind: "emunwa", label: "Snes9x or bsnes-plus (NWA)" },
] as const satisfies readonly { kind: DeviceKind; label: string }[];

type Device = (typeof DEVICES)[number]["kind"];

const isDevice = (kind: DeviceKind | null): kind is Device =>
  DEVICES.some((device) => device.kind === kind);

/** The name the guide's text gives the game. */
const GAME = "ALttPR";

const STATE_NAMES: Record<StepState, string> = {
  done: "done",
  failing: "needs attention",
  pending: "to do",
};

/** A link out of the tracker, said to open a new tab. */
const OutLink = ({ label, url }: { label: string; url: string }) => (
  <a href={url} rel="noopener noreferrer" target="_blank">
    {label}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);

/** A variant of a step: its own heading when the step has several. */
const Variant = ({
  titled,
  variant,
}: {
  titled: boolean;
  variant: SetupVariant;
}) => (
  <div className="setup-variant">
    {titled && <h5 className="setup-variant__title">{variant.title}</h5>}
    <ul className="setup-variant__items">
      {variant.items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
    {variant.links.length > 0 && (
      <p className="setup-variant__links">
        {variant.links.map((link) => (
          <OutLink key={link.url} {...link} />
        ))}
      </p>
    )}
  </div>
);

/** The fix for the failing step: what is wrong, what to do. */
const FixNote = ({ fix, headline }: { fix: Fix; headline: string }) => (
  <div className="setup-fix" data-testid="setup-fix">
    <p className="setup-fix__title">{headline}</p>
    {fix.lines.map((line) => (
      <p className="setup-fix__line" key={line}>
        {line}
      </p>
    ))}
    {fix.allow.map((variant) => (
      <Variant key={variant.title} titled variant={variant} />
    ))}
  </div>
);

/** The SNI download for the system shown, by file name. */
const SniFiles = ({ env }: { env: Pick<Environment, "os" | "arch"> }) => {
  const assets = sniAssets(env);
  return (
    <div className="setup-variant">
      <p className="setup-variant__lead">
        The file for this system, from the latest release (its version number
        changes):
      </p>
      <ul className="setup-variant__items">
        {assets.map((asset) => (
          <li key={asset.name}>
            <code>{asset.name}</code>
            {asset.note && ` (${asset.note})`}
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * The setup guide, ticked live from the session: OS tabs (the detected one
 * first, any other a click away), the emulator or console, and the five
 * steps, each done, failing or to do. The first failing step opens with its
 * fix, or the first step to do; the others open on a click.
 * @param status - The status shown
 * @param environment - The system and browser detected
 */
export const SetupGuide = ({
  environment,
  status,
}: {
  environment: Environment;
  status: SessionStatus;
}) => {
  const detected: System = SYSTEMS.some((s) => s.value === environment.os)
    ? (environment.os as System)
    : "windows";
  const [system, setSystem] = useState<System>(detected);
  const [picked, setPicked] = useState<Device>("retroarch");
  const inUse = deviceInUse(status);
  const device = isDevice(inUse) ? inUse : picked;
  // Another system's tab cannot know its CPU: it lists every download
  const shownEnv: Environment = {
    ...environment,
    arch: system === environment.os ? environment.arch : "unknown",
    os: system,
  };
  const progress = setupProgress(status, shownEnv, { device, game: GAME });
  const allow = progress.steps
    .filter(({ step }) => step.id === "permission")
    .flatMap(({ variants }) => variants);
  const fix = fixFor(status, allow);

  // The step to open follows the session; a click opens or closes any other
  const [opened, setOpened] = useState<ReadonlySet<SetupStepId>>(
    new Set(progress.focus ? [progress.focus] : []),
  );
  const [focus, setFocus] = useState(progress.focus);
  if (focus !== progress.focus) {
    setFocus(progress.focus);
    setOpened(new Set(progress.focus ? [progress.focus] : []));
  }
  const toggle = (id: SetupStepId) =>
    setOpened((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const baseId = useId();
  const done = progress.steps.filter((s) => s.state === "done").length;

  return (
    <section aria-labelledby={`${baseId}-title`} className="setup">
      <div className="setup__header">
        <h3 className="autotrack__heading" id={`${baseId}-title`}>
          Setup
        </h3>
        <p className="setup__count" data-testid="setup-count">
          {done} of {progress.steps.length} steps done
        </p>
      </div>
      <div className="setup__choices">
        <Tabs
          baseId={baseId}
          label="Your system"
          onSelect={setSystem}
          panelId={`${baseId}-panel`}
          selected={system}
          tabs={SYSTEMS}
          testId="setup-tab"
        />
        <label className="setup-device">
          <span className="setup-device__label">Emulator or console</span>
          <select
            className="setup-device__select"
            data-testid="setup-device"
            disabled={isDevice(inUse)}
            onChange={(event) => setPicked(event.target.value as Device)}
            value={device}
          >
            {DEVICES.map(({ kind, label }) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        aria-labelledby={tabId(baseId, system)}
        className="setup__panel"
        id={`${baseId}-panel`}
        role="tabpanel"
      >
        <ol className="setup-steps">
          {progress.steps.map(({ state, step, variants }, index) => {
            const isOpen = opened.has(step.id);
            const panelId = `${baseId}-step-${step.id}`;
            return (
              <li
                className="setup-step"
                data-state={state}
                data-testid={`setup-step-${step.id}`}
                key={step.id}
              >
                <h4 className="setup-step__heading">
                  <button
                    aria-controls={panelId}
                    aria-expanded={isOpen}
                    className="setup-step__toggle"
                    data-testid={`setup-toggle-${step.id}`}
                    onClick={() => toggle(step.id)}
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
                  {state === "failing" && fix && (
                    <FixNote fix={fix} headline={headlineOf(status, true)} />
                  )}
                  {step.id === "get-bridge" && <SniFiles env={shownEnv} />}
                  {variants.map((variant) => (
                    <Variant
                      key={variant.title}
                      titled={variants.length > 1}
                      variant={variant}
                    />
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};
