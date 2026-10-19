/** How long a download link stays valid: the download reads it after the click. */
const DOWNLOAD_URL_LIFETIME_MS = 1000;

/**
 * Save a file the player downloads: an export of the run. The site hands it
 * to the browser through a link in the page; the desktop app, whose webview
 * downloads nothing, asks the system's Save dialog (desktop/files.ts).
 * @param name - The file name offered
 * @param text - Its contents, JSON
 */
export const saveFile = (name: string, text: string) => {
  // Tested inline, so the site's build drops the desktop import
  if (import.meta.env.MODE === "desktop") {
    void import("@/desktop/files").then(({ saveOnDisk }) =>
      saveOnDisk(name, text),
    );
    return;
  }
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  // Firefox only follows a download link that is in the document
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
};
