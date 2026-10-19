import { OBJECTIVES } from "@alltp/pack-sm";
import { useSmStore } from "@/games/sm/store";

const NAME = new Map(OBJECTIVES.map((o) => [o.id, o.name]));

/**
 * The seed's objectives, each a toggle for done, and how many are left: once
 * all are done, the barriers before Mother Brain are down (Map Rando's
 * patches/src/mb_barrier_clear.asm).
 */
export const SmObjectives = () => {
  const objectives = useSmStore((state) => state.objectives);
  const done = useSmStore((state) => state.done);
  const toggleDone = useSmStore((state) => state.toggleDone);
  const left = objectives.filter((id) => !done.includes(id)).length;
  return (
    <section
      aria-labelledby="sm-objectives-heading"
      className="sm-objectives"
      data-testid="sm-objectives"
    >
      <h2 className="sm-objectives__heading" id="sm-objectives-heading">
        Objectives
      </h2>
      <p
        aria-live="polite"
        className="sm-objectives__summary"
        data-testid="sm-objectives-summary"
      >
        {objectives.length === 0
          ? "This seed asks for none."
          : left === 0
            ? "All done: the barriers before Mother Brain are down."
            : `${objectives.length - left} of ${objectives.length} done.`}
      </p>
      {objectives.length > 0 && (
        <ul className="sm-objectives__list">
          {objectives.map((id) => {
            const isDone = done.includes(id);
            return (
              <li key={id}>
                <button
                  aria-pressed={isDone}
                  className="sm-objective"
                  data-testid={`sm-objective-${id}`}
                  onClick={() => toggleDone(id)}
                  type="button"
                >
                  <span aria-hidden="true" className="sm-objective__check">
                    {isDone ? "✓" : ""}
                  </span>
                  {NAME.get(id) ?? id}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
