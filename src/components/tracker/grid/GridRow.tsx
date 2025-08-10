import { GridItem } from "@/components/tracker/grid/GridItem";
import { CSS_CLASSES } from "@/constants";

type GridRowProps = {
  /** The index of the row in the grid */
  rowIndex: number;
  /** Array of item identifiers for this row */
  row: string[];
};
/**
 * GridRow component that renders a complete grid row with tracker table structure
 * Contains a table with halfcells on the sides and GridItems in between
 * @param rowIndex - The row index for key generation and passing to GridItems
 * @param row - Array of item identifiers for this row
 */
export const GridRow = ({ rowIndex, row }: GridRowProps) => {
  if (!row) return null;

  return (
    <table
      aria-label={`Item tracker row ${rowIndex + 1}`}
      className={CSS_CLASSES.TRACKER}
      key={rowIndex}
    >
      <caption className="sr-only">
        Item tracker row {rowIndex + 1} containing {row.length} items
      </caption>
      <tbody>
        <tr>
          <td aria-hidden="true" className={CSS_CLASSES.HALFCELL} />
          {row.slice(0, 7).map((item: string, colIndex: number) => (
            <GridItem
              col={colIndex}
              item={item}
              key={`grid-${rowIndex}-${item}`}
              row={rowIndex}
            />
          ))}
          <td aria-hidden="true" className={CSS_CLASSES.HALFCELL} />
        </tr>
      </tbody>
    </table>
  );
};
