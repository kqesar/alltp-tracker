import { useState } from 'react';
import './styles.css';
import { items as initialItems, defaultItemGrid, itemsMin, itemsMax, dungeonchests} from './data/items';

/**
 * Main application component for the LttP Item Tracker
 * Manages the overall state of items, layout, settings, and game state
 */
function App() {
  // Game state
  const [items, setItems] = useState({ ...initialItems });
  const [itemLayout] = useState(JSON.parse(JSON.stringify(defaultItemGrid)));
  
  // UI state
  const [showSettings, setShowSettings] = useState(false);

  // Simple item click handler for testing
  const handleItemClick = (item: string) => {
    if (!item || item === 'blank') return;
    
    const newItems = { ...items };
    if (typeof items[item] === 'boolean') {
      newItems[item] = !newItems[item];
    } else {
      console.log(`Incrementing item: ${item}`);
      newItems[item] = (newItems[item] as number) + 1;
      console.log(`New value for ${item}: ${newItems[item]}`);
      // Use dynamic max value from itemsMax, fallback to 4 if not defined
      const maxValue = itemsMax[item];
      console.log(`Max value for ${item}: ${maxValue}`);
      const minValue = itemsMin[item];
      console.log(`Min value for ${item}: ${minValue}`);
      if (newItems[item] > maxValue) {
        newItems[item] = minValue;
      }
    }
    setItems(newItems);
  };

  // Get background image for an item
  const getItemBackground = (item: string) => {
    if (!item || item === 'blank') {
      return '';
    }

    if (typeof items[item] === 'boolean') {
      // Boolean items just have one image (item.png)
      return `url(/assets/${item}.png)`;
    } else {
      // Numeric items have multiple images (item0.png, item1.png, etc.)
      return `url(/assets/${item}${items[item]}.png)`;
    }
  };

  // Get item opacity based on its state
  const getItemOpacity = (item: string) => {
    if (!item || item === 'blank') return '0.25';
    
    if (typeof items[item] === 'boolean') {
      // Boolean items: full opacity if true, low opacity if false
      return items[item] ? '1' : '0.25';
    } else if (typeof items[item] === 'number' && item.indexOf('boss') === 0) {
      return '1'
    }
    else{
      // Numeric items: full opacity if > minimum value, low opacity if at minimum
      const minValue = itemsMin[item] || 0;
      return (items[item] as number) > minValue ? '1' : '0.25';
    }
  };

  // Render a single grid item
  const renderGridItem = (row: number, col: number) => {
    const item = itemLayout[row][col];
    
    // Special handling for boss items
    if (item && item.startsWith('boss')) {
      const bossNumber = parseInt(item.replace('boss', ''));
      return (
        <td 
          key={`${row}_${col}`} 
          className="griditem" 
          style={{
            backgroundImage: getItemBackground(item),
            opacity: getItemOpacity(item),
            width: '64px',
            height: '64px',
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            cursor: 'pointer',
            position: 'relative'
          }}
          onClick={() => handleItemClick(item)}
        >
          {/* Medallion (top-right) - only for Dark World bosses (3-9) */}
          {bossNumber >= 8 && (
            <div
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                width: '28px',
                height: '28px',
                backgroundImage: `url(/assets/medallion0.png)`,
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
                cursor: 'pointer',
                zIndex: 2
              }}
              onClick={(e) => {
                e.stopPropagation();
                // Handle medallion click logic here
              }}
            />
          )}
          
          {/* Chest count (bottom-left) */}
          <div
            style={{
              position: 'absolute',
              bottom: '2px',
              left: '2px',
              width: '28px',
              height: '28px',
              backgroundImage: `url(/assets/chest${dungeonchests[bossNumber]}.png)`,
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
              cursor: 'pointer',
              zIndex: 2
            }}
            onClick={(e) => {
              e.stopPropagation();
              // Handle chest click logic here
            }}
          />
          
          {/* Crystal/Pendant (bottom-right) */}
          <div
            style={{
              position: 'absolute',
              bottom: '2px',
              right: '2px',
              width: '28px',
              height: '28px',
              backgroundImage: `url(/assets/dungeon.png)`,
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
              cursor: 'pointer',
              zIndex: 2
            }}
            onClick={(e) => {
              e.stopPropagation();
              // Handle crystal/pendant click logic here
            }}
          />
          
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
        </td>
      );
    }
    
    // Regular item rendering
    return (
      <td 
        key={`${row}_${col}`} 
        className="griditem" 
        style={{
          backgroundImage: getItemBackground(item),
          opacity: getItemOpacity(item),
          width: '64px',
          height: '64px',
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          cursor: 'pointer'
        }}
        onClick={() => handleItemClick(item)}
      >
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
      </td>
    );
  };

  // Render a grid row
  const renderGridRow = (rowIndex: number) => {
    const row = itemLayout[rowIndex];
    if (!row) return null;

    return (
      <table key={rowIndex} className="tracker">
        <tbody>
          <tr>
            <td className="halfcell" />
            {row.slice(0, 7).map((_: any, colIndex: number) => renderGridItem(rowIndex, colIndex))}
            <td className="halfcell" />
          </tr>
        </tbody>
      </table>
    );
  };

  return (
    <div>
      <div id='layoutdiv'>
        <div id='itemdiv' className='itemdiv'>
          {itemLayout.map((_: any, rowIndex: number) => renderGridRow(rowIndex))}
        </div>
        <div id='mapdiv' className='mapdiv'></div>
        
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
      </div>
      
      <div style={{ width: '100%', textAlign: 'center' }} id="caption">&nbsp;</div>
    </div>
  );
}

export default App;
