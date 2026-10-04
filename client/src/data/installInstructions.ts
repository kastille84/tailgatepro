import type { InstallGuide, InstallPlatform } from "../interfaces/pwa";

/** Label for the Navbar "Install app" button. */
export const INSTALL_BUTTON_LABEL = "Install app";

/** Toast shown once the browser reports the app was installed. */
export const INSTALLED_TOAST =
  "TailgatePro is installed — find it on your home screen.";

/**
 * Per-platform install guidance shown in the instructions modal. `auto`
 * platforms (Chromium) normally never reach the modal because the native
 * prompt handles them, but they get a sensible fallback here too in case the
 * `beforeinstallprompt` event has not fired yet.
 */
export const INSTALL_GUIDES: Record<InstallPlatform, InstallGuide> = {
  "ios-safari": {
    heading: "Add TailgatePro to your Home Screen",
    icon: "share",
    steps: [
      "Tap the Share button in Safari's toolbar (the square with an up arrow).",
      "Scroll down and tap “Add to Home Screen”.",
      "Tap “Add” — TailgatePro opens like an app and works offline on site.",
    ],
    note: "On iPhone, only Safari can install web apps.",
  },
  "ipados-safari": {
    heading: "Add TailgatePro to your Home Screen",
    icon: "share",
    steps: [
      "Tap the Share button in the Safari toolbar (top-right).",
      "Tap “Add to Home Screen”.",
      "Tap “Add”.",
    ],
    note: "On iPad, only Safari can install web apps.",
  },
  "ios-other": {
    heading: "Open TailgatePro in Safari to install it",
    icon: "browser",
    steps: [
      "Copy this page's address.",
      "Open Safari and paste it into the address bar.",
      "Use Share → “Add to Home Screen” → “Add”.",
    ],
    note: "On iPhone and iPad, installing a web app only works from Safari.",
  },
  "macos-safari": {
    heading: "Add TailgatePro to your Dock",
    icon: "dock",
    steps: [
      "In Safari, open the File menu — or tap the Share button in the toolbar.",
      "Choose “Add to Dock”.",
      "Confirm the name and click “Add”.",
    ],
  },
  "android-chromium": {
    heading: "Install TailgatePro",
    icon: "menu",
    steps: [
      "Tap the ⋮ menu in the top-right of the browser.",
      "Tap “Add to Home screen” or “Install app”.",
      "Confirm with “Install”.",
    ],
  },
  "android-firefox": {
    heading: "Install TailgatePro",
    icon: "menu",
    steps: [
      "Tap the ⋮ menu in the browser toolbar.",
      "Tap “Install” (or “Add to Home screen”).",
      "Confirm the prompt.",
    ],
  },
  "desktop-chromium": {
    heading: "Install TailgatePro",
    icon: "menu",
    steps: [
      "Click the install icon at the right end of the address bar (a screen with a down arrow).",
      "Or open the ⋮ menu and choose “Install TailgatePro…”.",
      "Confirm with “Install”.",
    ],
  },
  "desktop-firefox": {
    heading: "This browser can't install TailgatePro",
    icon: "browser",
    steps: [
      "Open this page in Chrome, Microsoft Edge, or Safari.",
      "Use that browser's install option to add TailgatePro.",
    ],
    note: "Every feature still works here without installing.",
  },
  "in-app": {
    heading: "Open TailgatePro in your browser to install it",
    icon: "browser",
    steps: [
      "Tap the ⋯ or ⋮ menu in this screen's corner.",
      "Choose “Open in browser” (Chrome, Edge, or Safari).",
      "Then use that browser's install option.",
    ],
    note: "In-app browsers (from social or messaging apps) can't install web apps.",
  },
  unknown: {
    heading: "Install TailgatePro",
    icon: "browser",
    steps: [
      "Open this page in Chrome, Microsoft Edge, or Safari.",
      "Use that browser's menu to add TailgatePro to your device.",
    ],
    note: "Every feature still works here without installing.",
  },
};
