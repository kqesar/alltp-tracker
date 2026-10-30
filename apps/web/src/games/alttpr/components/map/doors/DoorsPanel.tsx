import {
  type DoorKindNote,
  type DoorShuffleSettings,
  doorId,
  doorTargets,
  homeDungeonOf,
  kindOnlyDoors,
  kindShuffled,
  lobbyDoors,
  PARTITIONS,
  portalId,
  portalsOf,
  shuffledDoors,
} from "@alltp/pack-alttpr/door-world";
import { DR_DATA } from "@alltp/pack-alttpr/door-world/dr";
import {
  memo,
  useDeferredValue,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { doorShuffleSettingsOf } from "@/games/alttpr/data/doorRando";
import { linkChange, linkOf } from "@/games/alttpr/logic/doorNotes";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** DR's door names have no world of their own: one line each. */
type Door = ReturnType<typeof shuffledDoors>[number];

/** The kinds in the words players use, as the kind select offers them. */
const KIND_WORDS: readonly (readonly [DoorKindNote, string])[] = [
  ["normal", "Plain"],
  ["small", "Key door"],
  ["big", "Big key door"],
  ["bomb", "Bombable"],
  ["dash", "Dashable"],
  ["trap", "Trap (shuts behind)"],
];

/** A dungeon's name in the tracker's words. */
const dungeonText = (name: string): string =>
  name === "Agahnims Tower"
    ? "Castle Tower"
    : name === "Thieves Town"
      ? "Thieves' Town"
      : name === "Ganons Tower"
        ? "Ganon's Tower"
        : name;

const DUNGEONS = PARTITIONS.flat();

/** The kind select of a door whose kind the shuffle may change. */
const KindSelect = ({ door, label }: { door: string; label: string }) => {
  const kind = useGameStore((state) => state.doors.kinds?.[door]);
  const noteDoors = useGameStore((state) => state.noteDoors);
  return (
    <select
      aria-label={`${label}: kind`}
      className="checks__input door-row__kind"
      data-testid={`door-kind-${door}`}
      onChange={(event) =>
        noteDoors({
          kinds: {
            [door]:
              event.currentTarget.value === ""
                ? null
                : (event.currentTarget.value as DoorKindNote),
          },
        })
      }
      value={kind ?? ""}
    >
      <option value="">? Kind</option>
      {KIND_WORDS.map(([value, words]) => (
        <option key={value} value={value}>
          {words}
        </option>
      ))}
    </select>
  );
};

/** One door the shuffle relinks: where it leads, and its kind. */
const DoorRow = memo(
  ({
    door,
    settings,
    targets,
  }: {
    door: Door;
    settings: DoorShuffleSettings;
    targets: readonly Door[];
  }) => {
    const id = doorId(door.name);
    const coupled = !settings.decoupled;
    const target = useGameStore((state) =>
      linkOf(state.doors.links, id, coupled),
    );
    const noteDoors = useGameStore((state) => state.noteDoors);
    // A crossed shuffle offers a door of Ganon's Tower some 70 targets, a
    // dungeon thousands in all (440 ms to show it, measured): a row first
    // shows the target noted alone, its other options in a render React
    // defers, so a dungeon picked shows at once
    const full = useDeferredValue(true, false);
    const byDungeon = useMemo(() => {
      if (!full) return [];
      const groups = new Map<string, Door[]>();
      for (const other of targets) {
        const dungeon = homeDungeonOf(other, DR_DATA) ?? "";
        groups.set(dungeon, [...(groups.get(dungeon) ?? []), other]);
      }
      return [...groups];
    }, [full, targets]);
    const noted = full
      ? undefined
      : targets.find((other) => doorId(other.name) === target);
    return (
      <li className="door-row" data-testid={`door-row-${id}`}>
        <span className="door-row__name">{door.name}</span>
        <select
          aria-label={`${door.name}: leads to`}
          className="checks__input door-row__link"
          data-testid={`door-link-${id}`}
          onChange={(event) => {
            const value = event.currentTarget.value;
            noteDoors(
              linkChange(
                useGameStore.getState().doors,
                id,
                value === "" ? null : value,
                coupled,
              ),
            );
          }}
          value={target ?? ""}
        >
          <option value="">? Not known</option>
          {noted !== undefined && (
            <option value={doorId(noted.name)}>{noted.name}</option>
          )}
          {byDungeon.map(([dungeon, doors]) => (
            <optgroup key={dungeon} label={dungeonText(dungeon)}>
              {doors.map((other) => (
                <option key={other.name} value={doorId(other.name)}>
                  {other.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {kindShuffled(door, settings) ? (
          <KindSelect door={id} label={door.name} />
        ) : (
          <span aria-hidden="true" className="door-row__fixed" />
        )}
      </li>
    );
  },
);

/** A portal's lobby at intensity 3: the door it opens on. */
const LobbyRow = ({
  portal,
  settings,
}: {
  portal: string;
  settings: DoorShuffleSettings;
}) => {
  const id = portalId(portal);
  const lobby = useGameStore((state) => state.doors.lobbies?.[id]);
  const noteDoors = useGameStore((state) => state.noteDoors);
  const doors = useMemo(
    () => lobbyDoors(portal, settings.shuffle, DR_DATA),
    [portal, settings.shuffle],
  );
  return (
    <li className="door-row door-row--lobby" data-testid={`door-lobby-${id}`}>
      <span className="door-row__name">{portal} entrance</span>
      <select
        aria-label={`${portal} entrance: opens on`}
        className="checks__input door-row__link"
        onChange={(event) => {
          const value = event.currentTarget.value;
          noteDoors({ lobbies: { [id]: value === "" ? null : value } });
        }}
        value={lobby ?? ""}
      >
        <option value="">? Not known</option>
        {doors.map((door) => (
          <option key={door.name} value={doorId(door.name)}>
            {door.name}
          </option>
        ))}
      </select>
    </li>
  );
};

/** A dungeon's small keys in all, which a pool of dungeons moves. */
const KeysField = ({ dungeon }: { dungeon: string }) => {
  const keys = useGameStore((state) => state.doors.keys?.[dungeon]);
  const noteDoors = useGameStore((state) => state.noteDoors);
  const fieldId = useId();
  return (
    <label className="checks__field doors__keys" htmlFor={fieldId}>
      <span className="checks__field-label">
        Small keys in {dungeonText(dungeon)}, in all
      </span>
      <input
        className="checks__input doors__keys-input"
        data-testid="doors-keys"
        id={fieldId}
        inputMode="numeric"
        max={30}
        min={0}
        onChange={(event) => {
          const text = event.currentTarget.value;
          const count = Number(text);
          noteDoors({
            keys: {
              [dungeon]:
                text === "" || !Number.isInteger(count)
                  ? null
                  : Math.max(0, Math.min(30, count)),
            },
          });
        }}
        placeholder="?"
        type="number"
        value={keys ?? ""}
      />
    </label>
  );
};

/**
 * A door-shuffled Door Randomizer run's doors, one dungeon at a time: each
 * door the shuffle relinks with where it leads and its kind, each door
 * whose kind alone may change, each portal's lobby from intensity 3 and,
 * in a pool of dungeons, the dungeon's small keys. Everything is noted by
 * hand: the tracker never reads a door, a room or a transition. Loaded on
 * demand, with DR's world.
 */
const DoorsPanel = () => {
  const run = useGameStore((state) => state.settings);
  const settings = useMemo(() => doorShuffleSettingsOf(run), [run]);
  const notes = useGameStore((state) => state.doors);
  const noteDoors = useGameStore((state) => state.noteDoors);
  const [dungeon, setDungeon] = useState<string>(DUNGEONS[0] ?? "");
  const [query, setQuery] = useState("");
  const selectId = useId();
  const searchId = useId();
  const headingId = useId();
  const summary = useRef<HTMLParagraphElement>(null);
  const relinked = useMemo(
    () =>
      settings === undefined
        ? []
        : shuffledDoors(settings, DR_DATA).filter(
            (d) => homeDungeonOf(d, DR_DATA) === dungeon,
          ),
    [settings, dungeon],
  );
  const kindOnly = useMemo(
    () =>
      settings === undefined
        ? []
        : kindOnlyDoors(settings, DR_DATA).filter(
            (d) => homeDungeonOf(d, DR_DATA) === dungeon,
          ),
    [settings, dungeon],
  );
  const targets = useMemo(
    () =>
      new Map(
        settings === undefined
          ? []
          : relinked.map((door) => [
              door.name,
              doorTargets(door, settings, DR_DATA),
            ]),
      ),
    [settings, relinked],
  );
  if (settings === undefined) return null;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (door: Door) =>
    words.every((word) => door.name.toLowerCase().includes(word));
  const linked = relinked.filter(
    (door) =>
      linkOf(notes.links, doorId(door.name), !settings.decoupled) !== undefined,
  ).length;
  const unknownKinds = [...relinked, ...kindOnly].filter(
    (door) =>
      kindShuffled(door, settings) &&
      notes.kinds?.[doorId(door.name)] === undefined,
  );
  // The doors the player went through (a link noted from or into them)
  // whose kind is not noted: the quick control notes them plain
  const through = new Set([
    ...Object.keys(notes.links ?? {}),
    ...Object.values(notes.links ?? {}),
  ]);
  const unknownLinked = unknownKinds.filter((door) =>
    through.has(doorId(door.name)),
  );
  const portals = settings.intensity >= 3 ? portalsOf(dungeon, DR_DATA) : [];
  return (
    <div className="doors" data-testid="doors-panel">
      <div className="doors__bar">
        <label className="checks__field" htmlFor={selectId}>
          <span className="checks__field-label">Dungeon</span>
          <select
            className="checks__input"
            data-testid="doors-dungeon"
            id={selectId}
            onChange={(event) => setDungeon(event.currentTarget.value)}
            value={dungeon}
          >
            {DUNGEONS.map((name) => (
              <option key={name} value={name}>
                {dungeonText(name)}
              </option>
            ))}
          </select>
        </label>
        <label className="checks__field" htmlFor={searchId}>
          <span className="checks__field-label">Search</span>
          <input
            autoComplete="off"
            className="checks__input"
            id={searchId}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Door name"
            type="search"
            value={query}
          />
        </label>
      </div>
      <p
        className="entrances__summary"
        data-testid="doors-summary"
        ref={summary}
        role="status"
        tabIndex={-1}
      >
        {linked} of {relinked.length} doors of {dungeonText(dungeon)} noted,{" "}
        {unknownKinds.length} {unknownKinds.length === 1 ? "kind" : "kinds"} not
        known
      </p>
      <p className="entrances__hint">
        Note each door by hand as you go through it: the tracker never reads a
        door, a room or a transition. A door not noted leads nowhere, and a door
        whose kind is not noted is maybe to pass, linked or not.
      </p>
      {unknownLinked.length > 0 && (
        <button
          className="doors__plain"
          data-testid="doors-plain"
          onClick={() => {
            noteDoors({
              kinds: Object.fromEntries(
                unknownLinked.map((door) => [doorId(door.name), "normal"]),
              ),
            });
            // The button goes with the kinds it noted: focus moves to the
            // summary they change, never to the page's start (WCAG 2.4.3)
            summary.current?.focus();
          }}
          type="button"
        >
          Note the {unknownLinked.length} linked{" "}
          {unknownLinked.length === 1 ? "door" : "doors"} of{" "}
          {dungeonText(dungeon)} plain
        </button>
      )}
      {settings.shuffle !== "basic" && <KeysField dungeon={dungeon} />}
      {portals.length > 0 && (
        <section
          aria-labelledby={`${headingId}-lobbies`}
          className="entrances__world"
        >
          <h3
            className="entrances__heading page-background"
            id={`${headingId}-lobbies`}
          >
            Lobbies
          </h3>
          <ul className="entrances__list">
            {portals.map((portal) => (
              <LobbyRow key={portal} portal={portal} settings={settings} />
            ))}
          </ul>
        </section>
      )}
      <section
        aria-labelledby={`${headingId}-doors`}
        className="entrances__world"
      >
        <h3
          className="entrances__heading page-background"
          id={`${headingId}-doors`}
        >
          Doors
        </h3>
        <ul className="entrances__list">
          {relinked.filter(matches).map((door) => (
            <DoorRow
              door={door}
              key={door.name}
              settings={settings}
              targets={targets.get(door.name) ?? []}
            />
          ))}
        </ul>
      </section>
      {kindOnly.length > 0 && (
        <section
          aria-labelledby={`${headingId}-rooms`}
          className="entrances__world"
        >
          <h3
            className="entrances__heading page-background"
            id={`${headingId}-rooms`}
          >
            Doors inside rooms
          </h3>
          <ul className="entrances__list">
            {kindOnly.filter(matches).map((door) => (
              <li
                className="door-row door-row--kind"
                data-testid={`door-row-${doorId(door.name)}`}
                key={door.name}
              >
                <span className="door-row__name">{door.name}</span>
                <KindSelect door={doorId(door.name)} label={door.name} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default DoorsPanel;
