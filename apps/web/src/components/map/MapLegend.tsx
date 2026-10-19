/** Availability states shown on the maps, with human-readable labels. */
const LEGEND_ITEMS = [
  { className: "available", label: "Available now" },
  { className: "possible", label: "Maybe, or only some" },
  { className: "seen", label: "Visible, not reachable yet" },
  { className: "unavailable", label: "Out of logic" },
  { className: "opened", label: "Opened / cleared" },
] as const;

/**
 * MapLegend - explains the colour coding of the map markers so the states are
 * understandable without relying on colour alone (accessibility).
 * @param seen - Whether the map draws locations seen but not reachable (a
 *   game whose logic has no such channel leaves it out)
 */
export const MapLegend = ({ seen = true }: { seen?: boolean }) => (
  <section
    aria-label="Map availability legend"
    className="map-legend"
    data-testid="map-legend"
  >
    {LEGEND_ITEMS.filter((item) => seen || item.className !== "seen").map(
      (item) => (
        <span className="map-legend__item" key={item.className}>
          <span
            aria-hidden="true"
            className={`map-legend__swatch state-glyph ${item.className}`}
          />
          {item.label}
        </span>
      ),
    )}
  </section>
);
