/** Availability states shown on the maps, with human-readable labels. */
const LEGEND_ITEMS = [
  { className: "available", label: "Available now" },
  { className: "possible", label: "Maybe (needs more items)" },
  { className: "unavailable", label: "Out of logic" },
  { className: "opened", label: "Opened / cleared" },
] as const;

/**
 * MapLegend - explains the colour coding of the map markers so the states are
 * understandable without relying on colour alone (accessibility).
 */
export const MapLegend = () => (
  <section aria-label="Map availability legend" className="map-legend">
    {LEGEND_ITEMS.map((item) => (
      <span className="map-legend__item" key={item.className}>
        <span
          aria-hidden="true"
          className={`map-legend__swatch ${item.className}`}
        />
        {item.label}
      </span>
    ))}
  </section>
);
