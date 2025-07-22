import type { GameSettings } from '../types/game'

interface SettingsProps {
  settings: GameSettings
  onUpdateSettings: (newSettings: Partial<GameSettings>) => void
  visible: boolean
}

export function Settings({ settings, onUpdateSettings, visible }: SettingsProps) {
  if (!visible) return null

  return (
    <fieldset className="settings-panel">
      <legend>Settings</legend>
      
      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.showChests}
            onChange={(e) => onUpdateSettings({ showChests: e.target.checked })}
          />
          Show Chests
        </label>
      </div>
      
      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.showCrystals}
            onChange={(e) => onUpdateSettings({ showCrystals: e.target.checked })}
          />
          Show Crystals
        </label>
      </div>
      
      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.showMedallions}
            onChange={(e) => onUpdateSettings({ showMedallions: e.target.checked })}
          />
          Show Medallions
        </label>
      </div>
      
      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.showMap}
            onChange={(e) => onUpdateSettings({ showMap: e.target.checked })}
          />
          Show Map
        </label>
      </div>
      
      <div className="setting-group">
        <label>Map Position:</label>
        <div>
          <label>
            <input
              type="radio"
              name="mapPosition"
              value="below"
              checked={settings.mapPosition === 'below'}
              onChange={(e) => onUpdateSettings({ mapPosition: e.target.value as 'below' | 'side' })}
            />
            Below
          </label>
          <label>
            <input
              type="radio"
              name="mapPosition"
              value="side"
              checked={settings.mapPosition === 'side'}
              onChange={(e) => onUpdateSettings({ mapPosition: e.target.value as 'below' | 'side' })}
            />
            Right
          </label>
        </div>
      </div>
      
      <div className="setting-group">
        <label>Map Orientation:</label>
        <div>
          <label>
            <input
              type="radio"
              name="mapOrientation"
              value="horizontal"
              checked={settings.mapOrientation === 'horizontal'}
              onChange={(e) => onUpdateSettings({ mapOrientation: e.target.value as 'horizontal' | 'vertical' })}
            />
            Horizontal
          </label>
          <label>
            <input
              type="radio"
              name="mapOrientation"
              value="vertical"
              checked={settings.mapOrientation === 'vertical'}
              onChange={(e) => onUpdateSettings({ mapOrientation: e.target.value as 'horizontal' | 'vertical' })}
            />
            Vertical
          </label>
        </div>
      </div>
    </fieldset>
  )
}
