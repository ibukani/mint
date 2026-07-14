export const isApplePlatform = () => {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(
    `${navigator.platform} ${navigator.userAgent}`,
  );
};

export const getPlatformShortcutModifier = () =>
  isApplePlatform() ? "⌘" : "Ctrl";
