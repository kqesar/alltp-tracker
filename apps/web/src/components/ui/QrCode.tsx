import { correction, generate } from "lean-qr";

/** Modules of empty margin a scanner needs around the code (the standard's). */
const QUIET_ZONE = 4;

/** The part of lean-qr's bitmap the drawing reads. */
type Modules = { size: number; get: (x: number, y: number) => boolean };

/**
 * The dark modules as one SVG path: each horizontal run of them is a
 * rectangle (`M x y h n v1 h-n z`), so the path stays a fraction of one
 * rectangle per module.
 * @param offset - Added to both coordinates (the quiet zone)
 */
export const modulesPath = (modules: Modules, offset = 0): string => {
  const parts: string[] = [];
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (!modules.get(x, y)) continue;
      const start = x;
      while (x + 1 < modules.size && modules.get(x + 1, y)) x++;
      const run = x - start + 1;
      parts.push(`M${start + offset} ${y + offset}h${run}v1h-${run}z`);
    }
  }
  return parts.join("");
};

/**
 * A QR code of `text`, as inline SVG: dark modules on a white ground in every
 * theme, since a scanner needs dark on light. The smallest version that
 * holds the text is picked, with the most error correction that fits it. Past
 * version 40 (about 2.9 KB) the text does not fit and a sentence shows.
 */
const QrCode = ({ label, text }: { label: string; text: string }) => {
  let modules: Modules;
  try {
    modules = generate(text, { minCorrectionLevel: correction.L });
  } catch {
    return (
      <p className="share-qr__none" data-testid="share-qr-none">
        This link is too long for a QR code. Copy it instead.
      </p>
    );
  }
  const side = modules.size + 2 * QUIET_ZONE;
  return (
    <svg
      aria-label={label}
      className="share-qr"
      data-testid="share-qr"
      role="img"
      shapeRendering="crispEdges"
      viewBox={`0 0 ${side} ${side}`}
    >
      <rect fill="#fff" height={side} width={side} />
      <path d={modulesPath(modules, QUIET_ZONE)} fill="#000" />
    </svg>
  );
};

export default QrCode;
