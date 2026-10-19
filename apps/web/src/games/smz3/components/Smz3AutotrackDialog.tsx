import { useId } from "react";
import { GameAutotrackDialog } from "@/components/autotrack/GameAutotrackDialog";
import { smz3Autotrack } from "@/games/smz3/autotrack/store";

const GAMES = {
  credits: "the credits",
  sm: "Super Metroid",
  zelda: "A Link to the Past",
} as const;

const capital = (word: string) => word[0]?.toUpperCase() + word.slice(1);

/** What the last reading said of the seed, in words. */
const SeedRead = () => {
  const reading = smz3Autotrack.useStore((state) => state.reading);
  const titleId = useId();
  if (reading === null || typeof reading.seed === "string") return null;
  const { requirements, seed } = reading;
  const settings: [string, string][] = [
    [
      "Super Metroid logic",
      seed.smLogic === null ? "?" : capital(seed.smLogic),
    ],
    ["Keysanity", seed.keysanity ? "On" : "Off"],
  ];
  const asked: [string, string][] =
    typeof requirements === "string"
      ? []
      : [
          ["Ganon's Tower", `${requirements.towerCrystals ?? "?"} crystals`],
          ["Ganon", `${requirements.ganonCrystals ?? "?"} crystals`],
          ["Tourian", `${requirements.tourianBosses ?? "?"} bosses`],
          ["Misery Mire", capital(requirements.mire ?? "?")],
          ["Turtle Rock", capital(requirements.turtleRock ?? "?")],
        ];
  const pairs = (rows: [string, string][]) => (
    <dl className="readout__pairs">
      {rows.map(([label, value]) => (
        <div className="readout__pair" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <section
      aria-labelledby={titleId}
      className="readout"
      data-testid="smz3-readout"
    >
      <h3 className="autotrack__heading" id={titleId}>
        What I read
      </h3>
      <p className="readout__meta">
        The SMZ3 seed {seed.title}
        {typeof reading.mode === "string" && reading.mode in GAMES
          ? `, in ${GAMES[reading.mode as keyof typeof GAMES]}`
          : ""}
        .{" "}
        {seed.race
          ? "A race seed: its requirements and medallions stay yours to set."
          : requirements === "unreadable"
            ? "Your emulator does not serve the part of the ROM that holds its requirements and medallions: set them yourself."
            : "Compare it with your game."}
      </p>
      <div className="readout__grid">
        <div className="readout__group" data-testid="smz3-readout-settings">
          <h4 className="readout__title">Seed settings, from the ROM</h4>
          {pairs(settings)}
        </div>
        {asked.length > 0 && (
          <div
            className="readout__group"
            data-testid="smz3-readout-requirements"
          >
            <h4 className="readout__title">What it asks for</h4>
            {pairs(asked)}
          </div>
        )}
      </div>
    </section>
  );
};

/**
 * SMZ3's autotracking dialog: the shared one (GameAutotrackDialog), with
 * what was read of the seed.
 * @param onClose - Called to close the dialog
 */
export const Smz3AutotrackDialog = ({ onClose }: { onClose: () => void }) => (
  <GameAutotrackDialog
    follows="The board follows your SMZ3 game as you play, in both games: the items you hold, the rewards found, the locations checked, and the seed's settings. The marks you set beyond it stay. In a race seed, the requirements and medallions stay yours to set."
    game="SMZ3"
    onClose={onClose}
    session={smz3Autotrack}
  >
    <SeedRead />
  </GameAutotrackDialog>
);
