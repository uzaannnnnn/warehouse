export function playSuccessSound() {
  if (typeof window === "undefined") return;

  try {
    const audio = new Audio("/notifications/success.mp3");
    // Best-effort only; ignore failure (e.g. user gesture requirement)
    // eslint-disable-next-line promise/catch-or-return
    audio.play().catch(() => {});
  } catch {
    // Ignore audio errors silently
  }
}

