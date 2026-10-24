import { useId } from "react";
import { type Tab, Tabs, tabId } from "@/components/ui/Tabs";
import { ChecksPanel } from "@/games/archipelago/components/ChecksPanel";
import { HintsPanel } from "@/games/archipelago/components/HintsPanel";
import { PlayersPanel } from "@/games/archipelago/components/PlayersPanel";
import { type ApPrefs, useArchipelagoStore } from "@/games/archipelago/store";

type Side = ApPrefs["side"];

/**
 * The panel beside the items: ARIA tabs Checks | Hints | Players over one
 * tabpanel, the choice kept as a pref (`side`). The hints tab says how many
 * hints name an item for the slot, so a new one shows from any tab.
 */
export const SidePanel = () => {
  const side = useArchipelagoStore((state) => state.prefs.side);
  const setPref = useArchipelagoStore((state) => state.setPref);
  const forMe = useArchipelagoStore(
    (state) =>
      state.hints.filter((hint) => hint.forMe && hint.status !== "found")
        .length,
  );
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const tabs: readonly Tab<Side>[] = [
    { label: "Checks", value: "checks" },
    { label: forMe > 0 ? `Hints (${forMe})` : "Hints", value: "hints" },
    { label: "Players", value: "players" },
  ];
  return (
    <section
      aria-label="Slot"
      className="ap-panel ap-side"
      data-testid="ap-side"
    >
      <Tabs
        baseId={baseId}
        label="Slot"
        onSelect={(value) => setPref("side", value)}
        panelId={panelId}
        selected={side}
        tabs={tabs}
        testId="ap-side-tab"
      />
      <div
        aria-labelledby={tabId(baseId, side)}
        className="ap-side__panel"
        id={panelId}
        role="tabpanel"
      >
        {side === "checks" && <ChecksPanel />}
        {side === "hints" && <HintsPanel />}
        {side === "players" && <PlayersPanel />}
      </div>
    </section>
  );
};
