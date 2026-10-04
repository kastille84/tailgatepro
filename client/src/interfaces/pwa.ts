/** Types for the PWA "install app" flow. See `client/src/utils/pwa.ts` for the
 *  detection logic and `client/src/data/installInstructions.ts` for the copy. */

/**
 * The `beforeinstallprompt` event — fired by Chromium browsers only, and absent
 * from the TS DOM lib. We capture it, `preventDefault()` it, and call
 * `.prompt()` later from a user gesture (the Navbar "Install app" button).
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

/** Coarse platform/browser bucket, enough to pick the right install guidance. */
export type InstallPlatform =
  | "ios-safari"
  | "ios-other"
  | "ipados-safari"
  | "android-chromium"
  | "android-firefox"
  | "macos-safari"
  | "desktop-chromium"
  | "desktop-firefox"
  | "in-app"
  | "unknown";

/**
 * - `auto`   — the browser can fire `beforeinstallprompt`; a real install
 *              dialog is possible (Chromium desktop / Android).
 * - `manual` — installable, but only through the browser's own Share / menu
 *              (iOS/iPadOS/macOS Safari, Firefox Android) — needs instructions.
 * - `unsupported` — no install path here (Firefox desktop, in-app webviews).
 */
export type Installability = "auto" | "manual" | "unsupported";

/** A block of step-by-step install guidance for one platform. */
export interface InstallGuide {
  heading: string;
  steps: string[];
  note?: string;
  icon: "share" | "menu" | "dock" | "browser";
}
