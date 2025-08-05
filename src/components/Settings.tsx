import type React from "react";
import { items as allItems } from "../data/items";

interface SettingsProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  editMode: boolean;
  setEditMode: (edit: boolean) => void;
  showChests: boolean;
  setShowChests: (show: boolean) => void;
  showPrizes: boolean;
  setShowPrizes: (show: boolean) => void;
  showMedals: boolean;
  setShowMedals: (show: boolean) => void;
  showMap: boolean;
  setShowMap: (show: boolean) => void;
  mapPosition: boolean;
  setMapPosition: (position: boolean) => void;
  mapOrientation: boolean;
  setMapOrientation: (orientation: boolean) => void;
  items: any;
  itemLayout: string[][];
}

/**
 * Settings component handles the settings panel and controls
 */
const Settings: React.FC<SettingsProps> = ({
  showSettings,
  setShowSettings,
  editMode,
  setEditMode,
  showChests,
  setShowChests,
  showPrizes,
  setShowPrizes,
  showMedals,
  setShowMedals,
  showMap,
  setShowMap,
  mapPosition,
  setMapPosition,
  mapOrientation,
  setMapOrientation,
}) => {
  const handleSettingsToggle = () => {
    if (editMode) {
      // Exit edit mode
      setEditMode(false);
      setShowSettings(false);
    } else {
      // Toggle settings panel
      setShowSettings(!showSettings);
    }
  };

  const handleEditMode = () => {
    setEditMode(true);
    setShowSettings(false);
  };

  const handleMapToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setShowMap(event.target.checked);
  };

  const handleChestToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setShowChests(event.target.checked);
  };

  const handlePrizeToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setShowPrizes(event.target.checked);
  };

  const handleMedalToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setShowMedals(event.target.checked);
  };

  const handleMapPositionChange = (below: boolean) => {
    setMapPosition(below);
  };

  const handleMapOrientationChange = (vertical: boolean) => {
    setMapOrientation(vertical);
  };

  // Render item configuration table for edit mode
  const renderItemConfig = () => {
    if (!editMode) return null;

    const itemKeys = Object.keys(allItems);
    const rows = [];

    for (let i = 0; i < itemKeys.length; i += 10) {
      const rowItems = itemKeys.slice(i, i + 10);
      rows.push(
        <tr key={i}>
          {rowItems.map((itemKey) => (
            <td
              className="corner"
              key={itemKey}
              onClick={() => {
                /* Item config click logic */
              }}
              style={{
                backgroundImage:
                  typeof allItems[itemKey] === "boolean"
                    ? `url(/assets/${itemKey}.png)`
                    : `url(/assets/${itemKey}${allItems[itemKey] || 0}.png)`,
                backgroundSize: "100% 100%",
                cursor: "pointer",
              }}
            />
          ))}
        </tr>,
      );
    }

    return (
      <table
        className="itemconfig"
        id="itemconfig"
        style={{ display: editMode ? "" : "none" }}
      >
        <tbody>{rows}</tbody>
      </table>
    );
  };

  return (
    <>
      <button id="settingsbutton" onClick={handleSettingsToggle} type="button">
        {editMode ? "Exit Edit Mode" : showSettings ? "X" : "🔧"}
      </button>

      <fieldset
        className="settings"
        id="settings"
        style={{ display: showSettings ? "initial" : "none" }}
      >
        <legend>Settings</legend>

        <fieldset>
          <legend>Item Tracker</legend>
          <button onClick={handleEditMode} type="button">
            Edit Mode
          </button>

          <fieldset>
            <legend>Dungeon Display</legend>
            <label>
              <input
                checked={showChests}
                name="showchest"
                onChange={handleChestToggle}
                type="checkbox"
              />
              Chests
            </label>
            <label>
              <input
                checked={showPrizes}
                name="showcrystal"
                onChange={handlePrizeToggle}
                type="checkbox"
              />
              Prizes
            </label>
            <label>
              <input
                checked={showMedals}
                name="showmedallion"
                onChange={handleMedalToggle}
                type="checkbox"
              />
              Medals
            </label>
          </fieldset>
        </fieldset>

        <fieldset>
          <legend>Map Tracker</legend>
          <label>
            <input
              checked={showMap}
              name="showmap"
              onChange={handleMapToggle}
              type="checkbox"
            />
            Enabled
          </label>
          <br />
          Position:
          <label>
            <input
              checked={mapPosition}
              name="mapposition"
              onChange={() => handleMapPositionChange(true)}
              type="radio"
              value="Below"
            />
            Below
          </label>
          <label>
            <input
              checked={!mapPosition}
              name="mapposition"
              onChange={() => handleMapPositionChange(false)}
              type="radio"
              value="Side"
            />
            Side
          </label>
          <br />
          Orientation:
          <label>
            <input
              checked={!mapOrientation}
              name="maporientation"
              onChange={() => handleMapOrientationChange(false)}
              type="radio"
              value="Horizontal"
            />
            Horizontal
          </label>
          <label>
            <input
              checked={mapOrientation}
              name="maporientation"
              onChange={() => handleMapOrientationChange(true)}
              type="radio"
              value="Vertical"
            />
            Vertical
          </label>
        </fieldset>
      </fieldset>

      {renderItemConfig()}
    </>
  );
};

export default Settings;
