import React from 'react';
import { items as allItems } from '../data/items';

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
  setMapOrientation
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
          {rowItems.map(itemKey => (
            <td
              key={itemKey}
              className="corner"
              style={{
                backgroundImage: typeof allItems[itemKey] === 'boolean' 
                  ? `url(/assets/${itemKey}.png)`
                  : `url(/assets/${itemKey}${allItems[itemKey] || 0}.png)`,
                backgroundSize: '100% 100%',
                cursor: 'pointer'
              }}
              onClick={() => {/* Item config click logic */}}
            />
          ))}
        </tr>
      );
    }

    return (
      <table id="itemconfig" className="itemconfig" style={{ display: editMode ? '' : 'none' }}>
        <tbody>
          {rows}
        </tbody>
      </table>
    );
  };

  return (
    <>
      <button 
        id="settingsbutton" 
        type="button" 
        onClick={handleSettingsToggle}
      >
        {editMode ? 'Exit Edit Mode' : showSettings ? 'X' : '🔧'}
      </button>
      
      <fieldset 
        id="settings" 
        className="settings" 
        style={{ display: showSettings ? 'initial' : 'none' }}
      >
        <legend>Settings</legend>
        
        <fieldset>
          <legend>Item Tracker</legend>
          <button type="button" onClick={handleEditMode}>
            Edit Mode
          </button>
          
          <fieldset>
            <legend>Dungeon Display</legend>
            <label>
              <input 
                type="checkbox" 
                name="showchest" 
                checked={showChests}
                onChange={handleChestToggle}
              />
              Chests
            </label>
            <label>
              <input 
                type="checkbox" 
                name="showcrystal" 
                checked={showPrizes}
                onChange={handlePrizeToggle}
              />
              Prizes
            </label>
            <label>
              <input 
                type="checkbox" 
                name="showmedallion" 
                checked={showMedals}
                onChange={handleMedalToggle}
              />
              Medals
            </label>
          </fieldset>
        </fieldset>
        
        <fieldset>
          <legend>Map Tracker</legend>
          <label>
            <input 
              type="checkbox" 
              name="showmap" 
              checked={showMap}
              onChange={handleMapToggle}
            />
            Enabled
          </label>
          <br />
          
          Position:
          <label>
            <input 
              type="radio" 
              name="mapposition" 
              value="Below" 
              checked={mapPosition}
              onChange={() => handleMapPositionChange(true)}
            />
            Below
          </label>
          <label>
            <input 
              type="radio" 
              name="mapposition" 
              value="Side" 
              checked={!mapPosition}
              onChange={() => handleMapPositionChange(false)}
            />
            Side
          </label>
          <br />
          
          Orientation:
          <label>
            <input 
              type="radio" 
              name="maporientation" 
              value="Horizontal" 
              checked={!mapOrientation}
              onChange={() => handleMapOrientationChange(false)}
            />
            Horizontal
          </label>
          <label>
            <input 
              type="radio" 
              name="maporientation" 
              value="Vertical" 
              checked={mapOrientation}
              onChange={() => handleMapOrientationChange(true)}
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
