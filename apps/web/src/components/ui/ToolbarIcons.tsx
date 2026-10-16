/**
 * Line icons for the toolbar, drawn in currentColor on a 24-unit grid. They
 * are decorative: every button using one carries its own text label.
 */
const Icon = ({ path }: { path: string }) => (
  <svg
    aria-hidden="true"
    className="toolbar-icon"
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d={path} />
  </svg>
);

export const UndoIcon = () => (
  <Icon path="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
);

export const RedoIcon = () => (
  <Icon path="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
);

/** A keyboard: three rows of keys, the space bar below. */
export const KeyboardIcon = () => (
  <Icon path="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
);

export const ExportIcon = () => <Icon path="M12 3v12M7 10l5 5 5-5M5 21h14" />;

export const ImportIcon = () => <Icon path="M12 15V3M7 8l5-5 5 5M5 21h14" />;

/** A screen casting from its corner: the stream view. */
export const StreamIcon = () => (
  <Icon path="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6M2 12a8 8 0 0 1 8 8M2 16a4 4 0 0 1 4 4M2 20h.01" />
);

export const ReloadIcon = () => (
  <Icon path="M20 12a8 8 0 1 1-2.34-5.66L20 8.5M20 3.5v5h-5" />
);

export const CloseIcon = () => <Icon path="M6 6l12 12M18 6 6 18" />;
