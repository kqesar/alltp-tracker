import { useState } from "react";
import "./styles.css";
import { MapTracker } from "./components/MapTracker";
import {
  type ItemState,
  chests as initialChests,
  dungeons as initialDungeons,
} from "./data/chests";
import {
  defaultItemGrid,
  items as initialItems,
  itemsMax,
  itemsMin,
} from "./data/items";

/**
 * Main application component for the LttP Item Tracker
 * Manages the overall state of items, layout, settings, and game state
 */
function App() {
  // Game state
  const [items, setItems] = useState<ItemState>({
    ...initialItems,
  } as ItemState);
  const [itemLayout] = useState(JSON.parse(JSON.stringify(defaultItemGrid)));
  const [chestsState, setChestsState] = useState([...initialChests]);
  const [dungeonsState, setDungeonsState] = useState([...initialDungeons]);
  const [medallions, setMedallions] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // Medallion assignments for dungeons
  const [mapOrientation] = useState(false); // Light/Dark World toggle

  const [caption, setCaption] = useState("&nbsp;");

  /**
   * H,andles item state changes when clicked
   * @param item - The item identifier to update
   */
  const handleItemClick = (item: string) => {
    if (!item || item === "blank") return;

    const newItems = { ...items };
    if (typeof items[item] === "boolean") {
      newItems[item] = !newItems[item];
    } else {
      // Special logic for chest items - decrement instead of increment
      if (item.startsWith("chest")) {
        newItems[item] = (newItems[item] as number) - 1;
        const maxValue = itemsMax[item];
        const minValue = itemsMin[item];
        if (newItems[item] < minValue) {
          newItems[item] = maxValue;
        }
      } else {
        // Normal increment logic for other items
        newItems[item] = (newItems[item] as number) + 1;
        const maxValue = itemsMax[item];
        const minValue = itemsMin[item];
        if (newItems[item] > maxValue) {
          newItems[item] = minValue;
        }
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
    if (!item || item === "blank") return "";

    if (typeof items[item] === "boolean") {
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
    if (!item || item === "blank") return "0.25";

    if (typeof items[item] === "boolean") {
      return items[item] ? "1" : "0.25";
    } else if (typeof items[item] === "number" && item.indexOf("boss") === 0) {
      return "1";
    } else {
      const minValue = itemsMin[item] || 0;
      return (items[item] as number) > minValue ? "1" : "0.25";
    }
  };

  /**
   * Creates common grid item styles
   * @param item - The item identifier
   * @returns Style object for grid items
   */
  const getGridItemStyles = (item: string) => ({
    backgroundImage: getItemBackground(item),
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%",
    cursor: "pointer",
    height: "64px",
    opacity: getItemOpacity(item),
    width: "64px",
  });

  /**
   * Creates overlay element styles for boss items
   * @param position - Position object with top/bottom and left/right values
   * @returns Style object for overlay elements
   */
  const getOverlayStyles = (position: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  }) => ({
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%",
    cursor: "pointer",
    height: "28px",
    position: "absolute" as const,
    width: "28px",
    zIndex: 2,
    ...position,
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

    const medallionValue = medallions[bossNumber];
    // Map medallion values to image files (medallion0.png to medallion2.png):
    // 0 = unknown/not assigned (medallion0.png)
    // 1 = bombos (medallion1.png)
    // 2 = ether (medallion2.png)
    // 3 = quake (cycle back to medallion0.png)
    const imageIndex = medallionValue === 3 ? 0 : medallionValue;

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          // Cycle from 0 to 3, then back to 0
          const newMedallions = [...medallions];
          newMedallions[bossNumber] = (medallionValue + 1) % 4;
          setMedallions(newMedallions);
        }}
        style={{
          ...getOverlayStyles({ right: "2px", top: "2px" }),
          backgroundImage: `url(/assets/medallion${imageIndex}.png)`,
        }}
      />
    );
  };

  /**
   * Renders chest count overlay for dungeons
   * @param bossNumber - The boss number (0-9)
   */
  const renderChestOverlay = (bossNumber: number) => {
    const chestKey = `chest${bossNumber}`;
    const chestValue = items[chestKey] as number;

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          handleItemClick(chestKey);
        }}
        style={{
          ...getOverlayStyles({ bottom: "2px", left: "2px" }),
          backgroundImage: `url(/assets/chest${chestValue}.png)`,
        }}
      />
    );
  };

  /**
   * Renders crystal/pendant overlay for dungeons
   * @param bossNumber - The boss number (0-9) used to get individual reward
   */
  const renderRewardOverlay = (bossNumber: number) => {
    const rewardKey = `reward${bossNumber}`;
    const rewardValue = items[rewardKey] as number;

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          // Cycle from 0 to 4, then back to 0
          const nextValue = rewardValue >= 4 ? 0 : rewardValue + 1;
          setItems({ ...items, [rewardKey]: nextValue });
        }}
        style={{
          ...getOverlayStyles({ bottom: "2px", right: "2px" }),
          backgroundImage: `url(/assets/dungeon${rewardValue}.png)`,
        }}
      />
    );
  };

  /**
   * Renders a boss item with overlays
   * @param row - Grid row index
   * @param col - Grid column index
   * @param item - The boss item identifier
   * @param bossNumber - The boss number (0-9)
   */
  const renderBossItem = (
    row: number,
    col: number,
    item: string,
    bossNumber: number,
  ) => (
    <td
      className="griditem"
      key={`${row}_${col}`}
      onClick={() => handleItemClick(item)}
      style={{
        ...getGridItemStyles(item),
        position: "relative",
      }}
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
      className="griditem"
      key={`${row}_${col}`}
      onClick={() => handleItemClick(item)}
      style={getGridItemStyles(item)}
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

    if (item?.startsWith("boss")) {
      const bossNumber = parseInt(item.replace("boss", ""));
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
      <table className="tracker" key={rowIndex}>
        <tbody>
          <tr>
            <td className="halfcell" />
            {row
              .slice(0, 7)
              .map((_: string, colIndex: number) =>
                renderGridItem(rowIndex, colIndex),
              )}
            <td className="halfcell" />
          </tr>
        </tbody>
      </table>
    );
  };

  return (
    <div>
      <div id="layoutdiv">
        <div className="itemdiv" id="itemdiv">
          {itemLayout.map((_: string[], rowIndex: number) =>
            renderGridRow(rowIndex),
          )}
        </div>
        <div className="mapdiv" id="mapdiv">
          <MapTracker
            caption={caption}
            chestsState={chestsState}
            dungeonChests={[
              items.chest0 as number,
              items.chest1 as number,
              items.chest2 as number,
              items.chest3 as number,
              items.chest4 as number,
              items.chest5 as number,
              items.chest6 as number,
              items.chest7 as number,
              items.chest8 as number,
              items.chest9 as number,
            ]}
            dungeonsState={dungeonsState}
            items={items}
            mapOrientation={mapOrientation}
            medallions={medallions}
            setCaption={setCaption}
            setChestsState={setChestsState}
            setDungeonsState={setDungeonsState}
          />
        </div>
      </div>

      <div id="caption" style={{ textAlign: "center", width: "100%" }}>
        {caption === "&nbsp;" ? (
          <span>&nbsp;</span>
        ) : (
          <span dangerouslySetInnerHTML={{ __html: caption }} />
        )}
      </div>
    </div>
  );
}

export default App;
