/**
 * CornerTable renders the standard corner table layout for grid items
 * This is a decorative component that provides the visual corner styling
 */
export const CornerTable = () => (
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
