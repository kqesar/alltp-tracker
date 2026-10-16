/**
 * Whether the tracker runs on an Apple device, whose keyboards say Cmd and
 * Option where others say Ctrl and Alt. `navigator.userAgentData` names the
 * platform in Chromium ("macOS"); elsewhere `navigator.platform` still does
 * ("MacIntel", "iPhone"; iPadOS reports "MacIntel" too).
 */
export const isApplePlatform = (): boolean => {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ||
    navigator.platform ||
    "";
  return /mac|iphone|ipad|ipod/i.test(platform);
};

/** The modifier of the system's own shortcuts (undo, copy): Cmd or Ctrl. */
export const commandKey = () => (isApplePlatform() ? "Cmd" : "Ctrl");

/** What the Alt key is called on this keyboard: Option on a Mac. */
export const altKey = () => (isApplePlatform() ? "Option" : "Alt");
