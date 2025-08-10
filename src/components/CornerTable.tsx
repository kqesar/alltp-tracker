import { CSS_CLASSES } from "@/constants";

/**
 * CornerTable renders the standard corner table layout for grid items
 * This is a decorative component that provides the visual corner styling
 */
export const CornerTable = () => (
  <table className={CSS_CLASSES.LONK}>
    <tbody>
      <tr>
        <th className={CSS_CLASSES.CORNER} />
        <th className={CSS_CLASSES.CORNER} />
      </tr>
      <tr>
        <th className={CSS_CLASSES.CORNER} />
        <th className={CSS_CLASSES.CORNER} />
      </tr>
    </tbody>
  </table>
);
