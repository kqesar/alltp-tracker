import { OBJECTIVES } from "@alltp/pack-sm";
import { ToggleList } from "@/components/ui/ToggleList";
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
    <ToggleList
      className="sm-objectives"
      items={objectives.map((id) => ({
        id,
        name: NAME.get(id) ?? id,
        on: done.includes(id),
        testId: `sm-objective-${id}`,
      }))}
      onToggle={({ id }) => toggleDone(id)}
      summary={
        objectives.length === 0
          ? "This seed asks for none."
          : left === 0
            ? "All done: the barriers before Mother Brain are down."
            : `${objectives.length - left} of ${objectives.length} done.`
      }
      testId="sm-objectives"
      title="Objectives"
    />
  );
};
