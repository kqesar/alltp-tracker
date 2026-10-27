import { OBJECTIVES } from "@alltp/pack-sm";
import { useId } from "react";
import { GameAutotrackDialog } from "@/components/autotrack/GameAutotrackDialog";
import { smAutotrack, useSmAutotrackStore } from "@/games/sm/autotrack/store";

const OBJECTIVE_NAMES = new Map(OBJECTIVES.map(({ id, name }) => [id, name]));

/**
 * What a reading in Race Mode read: the bosses beaten, which the board marks
 * done among the objectives the player set. Neither the seed nor its
 * objectives or settings: the player's in a race.
 */
const RaceRead = ({ bossKills }: { bossKills: readonly string[] }) => {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="readout"
      data-testid="sm-readout"
    >
      <h3 className="autotrack__heading" id={titleId}>
        What I read
      </h3>
      <p className="readout__meta">
        A Map Rando seed, in Race Mode: the tracker reads the items you hold and
        the bosses you beat. Set the seed's objectives, the Wall Jump Boots and
        the split Speed Booster in Mode.
      </p>
      <div className="readout__grid">
        <div className="readout__group" data-testid="sm-readout-bosses">
          <h4 className="readout__title">Bosses beaten</h4>
          {bossKills.length === 0 ? (
            <p className="readout__none">None</p>
          ) : (
            <ul className="readout__chips">
              {bossKills.map((id) => (
                <li className="readout__chip" key={id}>
                  {OBJECTIVE_NAMES.get(id) ?? id}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

/** What the last reading said of the seed, in words. */
const SeedRead = () => {
  const reading = useSmAutotrackStore((state) => state.reading);
  const titleId = useId();
  if (reading?.race && typeof reading.bossKills !== "string") {
    return <RaceRead bossKills={reading.bossKills} />;
  }
  if (reading === null || typeof reading.seed === "string") return null;
  const { seed } = reading;
  const objectives =
    typeof reading.objectives === "string" ? null : reading.objectives;
  const rows: [string, string][] = [
    ["Skill", seed.skill ?? "?"],
    ["Progression", seed.progression ?? "?"],
    ["Quality of life", seed.qol ?? "?"],
    ["Map", seed.map ?? "?"],
    ["Objectives", seed.objectives ?? "?"],
  ];
  return (
    <section
      aria-labelledby={titleId}
      className="readout"
      data-testid="sm-readout"
    >
      <h3 className="autotrack__heading" id={titleId}>
        What I read
      </h3>
      <p className="readout__meta">
        {seed.name === null ? (
          "A Map Rando seed."
        ) : (
          <>
            The Map Rando seed{" "}
            <a
              href={`https://maprando.com/seed/${seed.name}/`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {seed.name}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            .
          </>
        )}{" "}
        Compare it with your game.
      </p>
      <div className="readout__grid">
        <div className="readout__group" data-testid="sm-readout-settings">
          <h4 className="readout__title">Seed settings, from the ROM</h4>
          <dl className="readout__pairs">
            {rows.map(([label, value]) => (
              <div className="readout__pair" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {objectives !== null && (
          <div className="readout__group" data-testid="sm-readout-objectives">
            <h4 className="readout__title">Objectives</h4>
            {objectives.length === 0 ? (
              <p className="readout__none">None</p>
            ) : (
              <ul className="readout__chips">
                {objectives.map(({ done, objective }) => (
                  <li className="readout__chip" key={objective.id}>
                    {objective.name}
                    {done && ", done"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

/**
 * Super Metroid's autotracking dialog: the shared one (GameAutotrackDialog),
 * with what was read of the seed.
 * @param onClose - Called to close the dialog
 */
export const SmAutotrackDialog = ({ onClose }: { onClose: () => void }) => (
  <GameAutotrackDialog
    follows="The board follows your Map Rando game as you play: the items you hold, the seed's objectives and those done, its Wall Jump Boots and split Speed Booster. The marks you set beyond it stay. racetime.gg's Super Metroid Randomizer rules say nothing of autotracking; Map Rando's tournament rules allow it for items and boss kills, so in Race Mode (on by default) it reads those alone: the seed's objectives and settings are yours to set in Mode, and the run timer yours to start and end."
    game="Map Rando"
    onClose={onClose}
    session={smAutotrack}
  >
    <SeedRead />
  </GameAutotrackDialog>
);
