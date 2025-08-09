import { GridRow } from "./GridRow";

type TrackerGridProps = {
  /** Grid layout data - array of rows containing item identifiers */
  itemLayout: string[][];
};

/**
 * TrackerGrid component that renders the complete item tracker grid
 * Maps over the grid layout and renders each row using GridRow components
 * @param itemLayout - 2D array representing the grid layout with item identifiers
 */
export const TrackerGrid = ({ itemLayout }: TrackerGridProps) => {
  return (
    <div className="itemdiv" id="itemdiv">
      {itemLayout.map((row: string[], rowIndex: number) => (
        <GridRow
          // biome-ignore lint/suspicious/noArrayIndexKey: Row position is stable and meaningful in grid layout
          key={`row-${rowIndex}`}
          row={row}
          rowIndex={rowIndex}
        />
      ))}
    </div>
  );
};
