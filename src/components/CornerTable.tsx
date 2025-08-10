import { CSS_CLASSES } from "@/constants";

/**
 * CornerTable renders the standard corner grid layout for grid items
 * Uses CSS Grid instead of table for standards compliance
 * This is a decorative component that provides the visual corner styling
 */
export const CornerTable = () => (
  <div className={CSS_CLASSES.LONK}>
    <div className={CSS_CLASSES.CORNER} />
    <div className={CSS_CLASSES.CORNER} />
    <div className={CSS_CLASSES.CORNER} />
    <div className={CSS_CLASSES.CORNER} />
  </div>
);
