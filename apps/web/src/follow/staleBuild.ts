/** The page's own entry script: the module script with a `src`. */
const ENTRY = 'script[type="module"][src]';

/**
 * Whether the server now serves another build than the one this page runs.
 * The desktop app serves its own files to a browser source in OBS, which
 * keeps its page open for days: after the app updated, the page still runs
 * the old build, whose lazy chunks no longer exist. The entry script's
 * address carries a content hash, so a different one means a new build.
 *
 * Anything unclear (the server unreachable, a page with no entry script) is
 * not stale: a reload would only lose the run on screen.
 * @param fetchPage - Fetches the page's own address; the browser's `fetch`
 */
export const isStaleBuild = async (
  fetchPage: typeof fetch = fetch,
): Promise<boolean> => {
  try {
    const response = await fetchPage(import.meta.env.BASE_URL, {
      cache: "no-store",
    });
    if (!response.ok) return false;
    const served = new DOMParser()
      .parseFromString(await response.text(), "text/html")
      .querySelector(ENTRY)
      ?.getAttribute("src");
    const running = document.querySelector(ENTRY)?.getAttribute("src");
    return Boolean(served && running && served !== running);
  } catch {
    return false;
  }
};
