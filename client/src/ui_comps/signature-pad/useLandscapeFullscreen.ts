import { useEffect } from "react";

/**
 * While `active`, asks the browser for fullscreen and a landscape orientation
 * lock so the signing area gets the whole phone screen. Both are best effort:
 * iOS Safari supports neither orientation lock nor element fullscreen, and
 * desktop browsers reject the lock outright. The expanded layout works
 * without them, so a rejection is expected and ignored.
 */
export const useLandscapeFullscreen = (active: boolean) => {
  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    const enter = async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
        // Orientation lock only succeeds while fullscreen on most browsers.
        if (!cancelled && screen.orientation?.lock) {
          await screen.orientation.lock("landscape");
        }
      } catch {
        // NotSupportedError / SecurityError / TypeError: unsupported or denied.
        // Expected on iOS and desktop -- the expanded layout still works.
      }
    };
    void enter();

    return () => {
      cancelled = true;
      try {
        screen.orientation?.unlock?.();
      } catch {
        // Unlock throws if no lock was ever acquired.
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {
          // Already left fullscreen (e.g. the user pressed Back/Esc).
        });
      }
    };
  }, [active]);
};
