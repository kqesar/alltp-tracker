/**
 * A link out of the tracker, said to open a new tab.
 * @param label - What the link says
 * @param url - Where it goes (https)
 */
export const OutLink = ({ label, url }: { label: string; url: string }) => (
  <a href={url} rel="noopener noreferrer" target="_blank">
    {label}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);
