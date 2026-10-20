/**
 * The GoatCounter site code: visits are counted at
 * `https://<code>.goatcounter.com`, a free account of the owner's. Change it
 * here, nowhere else.
 */
export const GOATCOUNTER_CODE = "rando-atlas";

/** The one host whose visits count: a fork or a local copy never reports. */
export const COUNTED_HOST = "kqesar.github.io";

/** GoatCounter's script: about 3.3 kB gzip, no cookie, no storage. */
const COUNT_SCRIPT = "https://gc.zgo.at/count.js";

/** What a browser says about being tracked (`globalPrivacyControl` is not in lib.dom yet). */
type PrivacySignals = Pick<Navigator, "doNotTrack"> & {
  globalPrivacyControl?: boolean;
};

/**
 * Whether the visitor asks not to be tracked: Do Not Track, or Global Privacy
 * Control, its successor. GoatCounter ignores both by default; this honours
 * them.
 */
export const asksNotToBeTracked = (browser: PrivacySignals): boolean =>
  browser.doNotTrack === "1" || browser.globalPrivacyControl === true;

/**
 * Starts counting this visit: loads GoatCounter's script, once, without
 * blocking anything. Nothing is loaded off the site's host or for a visitor
 * who asked not to be tracked. The caller keeps it out of the desktop app and
 * the stream view (`main.tsx`).
 * @returns whether the script was added
 */
export const startAnalytics = (
  page: Pick<Document, "createElement" | "head"> = document,
  browser: PrivacySignals = navigator,
  host: string = window.location.hostname,
): boolean => {
  if (host !== COUNTED_HOST || asksNotToBeTracked(browser)) return false;
  const script = page.createElement("script");
  script.async = true;
  script.src = COUNT_SCRIPT;
  script.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
  // Visits only: no click events counted
  script.dataset.goatcounterSettings = JSON.stringify({ no_events: true });
  page.head.append(script);
  return true;
};
