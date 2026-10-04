import type {
  BeforeInstallPromptEvent,
  Installability,
  InstallPlatform,
} from "../interfaces/pwa";

/* ------------------------------------------------------------------ *
 *  beforeinstallprompt capture
 *
 *  Chromium fires `beforeinstallprompt` once, early — often before React has
 *  mounted. `initInstallCapture()` is called from main.tsx so the event is
 *  never missed; the PwaInstallProvider then reads it via `getDeferredPrompt()`
 *  and subscribes with `onInstallPromptChange()`.
 * ------------------------------------------------------------------ */

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let captureStarted = false;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

const handleBeforeInstallPrompt = (event: Event) => {
  // Stop Chrome's own mini-infobar; we drive install from our own button.
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  notify();
};

const handleAppInstalled = () => {
  deferredPrompt = null;
  notify();
};

/** Attach the global listeners. Idempotent; safe to call more than once. */
export const initInstallCapture = (): void => {
  if (captureStarted || typeof window === "undefined") return;
  captureStarted = true;
  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);
};

export const getDeferredPrompt = (): BeforeInstallPromptEvent | null =>
  deferredPrompt;

/** Drop the stashed event after it has been used (it is single-shot). */
export const clearDeferredPrompt = (): void => {
  deferredPrompt = null;
  notify();
};

/** Subscribe to "deferred prompt became available / was cleared". */
export const onInstallPromptChange = (callback: () => void): (() => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

/** Test helper — tears the singleton back down between specs. */
export const resetInstallCapture = (): void => {
  if (typeof window !== "undefined") {
    window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.removeEventListener("appinstalled", handleAppInstalled);
  }
  deferredPrompt = null;
  captureStarted = false;
  listeners.clear();
};

/* ------------------------------------------------------------------ *
 *  Environment detection
 * ------------------------------------------------------------------ */

/** True when the page is already running as an installed app. */
export const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  const displayModeStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true;
  const androidApp =
    typeof document !== "undefined" &&
    document.referrer.startsWith("android-app://");
  return displayModeStandalone || iosStandalone || androidApp;
};

const IN_APP_BROWSER_RE =
  /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|Twitter|TwitterAndroid|Snapchat|Pinterest|MicroMessenger|; wv\)/i;

const isSafari = (ua: string): boolean =>
  /Safari/.test(ua) &&
  !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome\/|Chromium|Android/.test(ua);

/**
 * Bucket the current browser/OS. Takes the UA string (and iPad touch count) as
 * arguments so it is trivially unit-testable. iPadOS 13+ reports a Mac UA, so
 * `maxTouchPoints` is what tells an iPad apart from a real Mac.
 */
export const detectPlatform = (
  ua: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
  maxTouchPoints: number = typeof navigator !== "undefined"
    ? (navigator.maxTouchPoints ?? 0)
    : 0,
): InstallPlatform => {
  if (!ua) return "unknown";
  if (IN_APP_BROWSER_RE.test(ua)) return "in-app";

  const isIpad = /iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (isIpad) return isSafari(ua) ? "ipados-safari" : "ios-other";

  if (/iPhone|iPod/.test(ua)) return isSafari(ua) ? "ios-safari" : "ios-other";

  if (/Android/.test(ua)) {
    return /Firefox\//.test(ua) ? "android-firefox" : "android-chromium";
  }

  if (/Macintosh|Mac OS X/.test(ua) && isSafari(ua)) return "macos-safari";

  if (/Firefox\//.test(ua)) return "desktop-firefox";
  if (/Edg\/|Chrome\/|Chromium\/|OPR\//.test(ua)) return "desktop-chromium";

  return "unknown";
};

/** How (if at all) the app can be installed from this platform. */
export const getInstallability = (
  platform: InstallPlatform,
): Installability => {
  switch (platform) {
    case "android-chromium":
    case "desktop-chromium":
      return "auto";
    case "ios-safari":
    case "ipados-safari":
    case "macos-safari":
    case "android-firefox":
      return "manual";
    default:
      return "unsupported";
  }
};
