import { useState } from 'react';
import './styles.css';
import { items as initialItems, defaultItemGrid, itemsMin, itemsMax, dungeonchests } from './data/items';
import { chests as initialChests, dungeons as initialDungeons } from './data/chests';
import MapTracker from './components/MapTracker';

/**
 * Main application component for the LttP Item Tracker
 * Manages the overall state of items, layout, settings, and game state
 */
function App() {
  // Game state
  const [items, setItems] = useState({ ...initialItems });
  const [itemLayout] = useState(JSON.parse(JSON.stringify(defaultItemGrid)));
  const [chestsState, setChestsState] = useState([...initialChests]);
  const [dungeonsState, setDungeonsState] = useState([...initialDungeons]);
  const [medallions] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // Medallion assignments for dungeons
  const [mapOrientation] = useState(false); // Light/Dark World toggle
  
  // UI state
  const [showSettings, setShowSettings] = useState(false);

  /**
   * Handles item state changes when clicked
   * @param item - The item identifier to update
   */
  const handleItemClick = (item: string) => {
    if (!item || item === 'blank') return;
    
    const newItems = { ...items };
    if (typeof items[item] === 'boolean') {
      newItems[item] = !newItems[item];
    } else {
      newItems[item] = (newItems[item] as number) + 1;
      const maxValue = itemsMax[item];
      const minValue = itemsMin[item];
      if (newItems[item] > maxValue) {
        newItems[item] = minValue;
      }
    }
    setItems(newItems);
  };

  /**
   * Gets the background image URL for an item
   * @param item - The item identifier
   * @returns CSS background-image URL string
   */
  const getItemBackground = (item: string): string => {
    if (!item || item === 'blank') return '';

    if (typeof items[item] === 'boolean') {
      return `url(/assets/${item}.png)`;
    } else {
      return `url(/assets/${item}${items[item]}.png)`;
    }
  };

  /**
   * Calculates opacity based on item state
   * @param item - The item identifier
   * @returns Opacity value as string
   */
  const getItemOpacity = (item: string): string => {
    if (!item || item === 'blank') return '0.25';
    
    if (typeof items[item] === 'boolean') {
      return items[item] ? '1' : '0.25';
    } else if (typeof items[item] === 'number' && item.indexOf('boss') === 0) {
      return '1';
    } else {
      const minValue = itemsMin[item] || 0;
      return (items[item] as number) > minValue ? '1' : '0.25';
    }
  };

  /**
   * Creates common grid item styles
   * @param item - The item identifier
   * @returns Style object for grid items
   */
  const getGridItemStyles = (item: string) => ({
    backgroundImage: getItemBackground(item),
    opacity: getItemOpacity(item),
    width: '64px',
    height: '64px',
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    cursor: 'pointer'
  });

  /**
   * Creates overlay element styles for boss items
   * @param position - Position object with top/bottom and left/right values
   * @returns Style object for overlay elements
   */
  const getOverlayStyles = (position: { top?: string; bottom?: string; left?: string; right?: string }) => ({
    position: 'absolute' as const,
    width: '28px',
    height: '28px',
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    cursor: 'pointer',
    zIndex: 2,
    ...position
  });

  /**
   * Renders the standard corner table for grid items
   */
  const renderCornerTable = () => (
    <table className="lonk">
      <tbody>
        <tr>
          <th className="corner" />
          <th className="corner" />
        </tr>
        <tr>
          <th className="corner" />
          <th className="corner" />
        </tr>
      </tbody>
    </table>
  );

  /**
   * Renders medallion overlay for Dark World bosses
   * @param bossNumber - The boss number (0-9)
   */
  const renderMedallionOverlay = (bossNumber: number) => {
    if (bossNumber < 8) return null;

    return (
      <div
        style={{
          ...getOverlayStyles({ top: '2px', right: '2px' }),
          backgroundImage: 'url(/assets/medallion0.png)'
        }}
        onClick={(e) => {
          e.stopPropagation();
          // TODO: Handle medallion click logic
        }}
      />
    );
  };

  /**
   * Renders chest count overlay for dungeons
   * @param bossNumber - The boss number (0-9)
   */
  const renderChestOverlay = (bossNumber: number) => (
    <div
      style={{
        ...getOverlayStyles({ bottom: '2px', left: '2px' }),
        backgroundImage: `url(/assets/chest${dungeonchests[bossNumber]}.png)`
      }}
      onClick={(e) => {
        e.stopPropagation();
        // TODO: Handle chest click logic
      }}
    />
  );

  /**
   * Renders crystal/pendant overlay for dungeons
   * @param _bossNumber - The boss number (0-9) - unused for now
   */
  const renderRewardOverlay = (_bossNumber: number) => (
    <div
      style={{
        ...getOverlayStyles({ bottom: '2px', right: '2px' }),
        backgroundImage: 'url(/assets/dungeon0.png)'
      }}
      onClick={(e) => {
        e.stopPropagation();
        // TODO: Handle crystal/pendant click logic
      }}
    />
  );

  /**
   * Renders a boss item with overlays
   * @param row - Grid row index
   * @param col - Grid column index
   * @param item - The boss item identifier
   * @param bossNumber - The boss number (0-9)
   */
  const renderBossItem = (row: number, col: number, item: string, bossNumber: number) => (
    <td 
      key={`${row}_${col}`} 
      className="griditem" 
      style={{
        ...getGridItemStyles(item),
        position: 'relative'
      }}
      onClick={() => handleItemClick(item)}
    >
      {renderMedallionOverlay(bossNumber)}
      {renderChestOverlay(bossNumber)}
      {renderRewardOverlay(bossNumber)}
      {renderCornerTable()}
    </td>
  );

  /**
   * Renders a regular (non-boss) item
   * @param row - Grid row index
   * @param col - Grid column index
   * @param item - The item identifier
   */
  const renderRegularItem = (row: number, col: number, item: string) => (
    <td 
      key={`${row}_${col}`} 
      className="griditem" 
      style={getGridItemStyles(item)}
      onClick={() => handleItemClick(item)}
    >
      {renderCornerTable()}
    </td>
  );

  /**
   * Renders a single grid item (boss or regular)
   * @param row - Grid row index
   * @param col - Grid column index
   */
  const renderGridItem = (row: number, col: number) => {
    const item = itemLayout[row][col];
    
    if (item && item.startsWith('boss')) {
      const bossNumber = parseInt(item.replace('boss', ''));
      return renderBossItem(row, col, item, bossNumber);
    }
    
    return renderRegularItem(row, col, item);
  };

  /**
   * Renders a complete grid row
   * @param rowIndex - The row index to render
   */
  const renderGridRow = (rowIndex: number) => {
    const row = itemLayout[rowIndex];
    if (!row) return null;

    return (
      <table key={rowIndex} className="tracker">
        <tbody>
          <tr>
            <td className="halfcell" />
            {row.slice(0, 7).map((_: any, colIndex: number) => 
              renderGridItem(rowIndex, colIndex)
            )}
            <td className="halfcell" />
          </tr>
        </tbody>
      </table>
    );
  };

  /**
   * Renders the settings panel
   */
  const renderSettings = () => (
    <div id='settingsDiv'>
      <button 
        id="settingsbutton" 
        type="button" 
        onClick={() => setShowSettings(!showSettings)}
      >
        {showSettings ? 'X' : '🔧'}
      </button>
      
      {showSettings && (
        <fieldset id="settings" className="settings" style={{ display: 'initial' }}>
          <legend>Settings</legend>
          <p>Settings panel - more options coming soon!</p>
        </fieldset>
      )}
    </div>
  );

  return (
    <div>
      <div id='layoutdiv'>
        <div id='itemdiv' className='itemdiv'>
          {itemLayout.map((_: any, rowIndex: number) => renderGridRow(rowIndex))}
        </div>
        <div id='mapdiv' className='mapdiv'>
          <MapTracker
            chestsState={chestsState}
            setChestsState={setChestsState}
            dungeonsState={dungeonsState}
            setDungeonsState={setDungeonsState}
            items={items}
            medallions={medallions}
            dungeonChests={dungeonchests}
            mapOrientation={mapOrientation}
          />
        </div>
        {renderSettings()}
      </div>
      
      <div style={{ width: '100%', textAlign: 'center' }} id="caption">&nbsp;</div>
    </div>
  );
}

export default App;
