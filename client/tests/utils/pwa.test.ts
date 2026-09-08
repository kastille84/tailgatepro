import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearDeferredPrompt,
  detectPlatform,
  getDeferredPrompt,
  getInstallability,
  initInstallCapture,
  isStandalone,
  onInstallPromptChange,
  resetInstallCapture,
} from "../../src/utils/pwa";
import type { InstallPlatform } from "../../src/interfaces/pwa";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
  ipadOsSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  ipadLegacySafari:
    "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
  pixelChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  samsungInternet:
    "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  androidFirefox:
    "Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  winChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  winEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  winFirefox:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  instagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.0 (iPhone14,2; iOS 16_6; en_US)",
  facebook:
    "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 [FBAN/EMA;FBAV/400.0.0.0]",
};

afterEach(() => {
  resetInstallCapture();
});

describe("detectPlatform", () => {
  it.each<[keyof typeof UA, InstallPlatform, number]>([
    ["iphoneSafari", "ios-safari", 5],
    ["iphoneChrome", "ios-other", 5],
    ["ipadOsSafari", "ipados-safari", 5],
    ["ipadLegacySafari", "ipados-safari", 5],
    ["pixelChrome", "android-chromium", 5],
    ["samsungInternet", "android-chromium", 5],
    ["androidFirefox", "android-firefox", 5],
    ["macSafari", "macos-safari", 0],
    ["winChrome", "desktop-chromium", 0],
    ["winEdge", "desktop-chromium", 0],
    ["winFirefox", "desktop-firefox", 0],
    ["instagram", "in-app", 5],
    ["facebook", "in-app", 5],
  ])("maps %s → %s", (key, expected, touch) => {
    expect(detectPlatform(UA[key], touch)).toBe(expected);
  });

  it("treats a Mac UA with touch points as an iPad", () => {
    expect(detectPlatform(UA.ipadOsSafari, 5)).toBe("ipados-safari");
    expect(detectPlatform(UA.macSafari, 0)).toBe("macos-safari");
  });

  it("returns 'unknown' for an empty or unrecognised UA", () => {
    expect(detectPlatform("", 0)).toBe("unknown");
    expect(detectPlatform("SomeCrawler/1.0", 0)).toBe("unknown");
  });
});

describe("getInstallability", () => {
  it("maps platforms to auto / manual / unsupported", () => {
    expect(getInstallability("android-chromium")).toBe("auto");
    expect(getInstallability("desktop-chromium")).toBe("auto");
    expect(getInstallability("ios-safari")).toBe("manual");
    expect(getInstallability("ipados-safari")).toBe("manual");
    expect(getInstallability("macos-safari")).toBe("manual");
    expect(getInstallability("android-firefox")).toBe("manual");
    expect(getInstallability("ios-other")).toBe("unsupported");
    expect(getInstallability("desktop-firefox")).toBe("unsupported");
    expect(getInstallability("in-app")).toBe("unsupported");
    expect(getInstallability("unknown")).toBe("unsupported");
  });
});

describe("isStandalone", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    // @ts-expect-error test cleanup of an optional non-standard field
    delete window.navigator.standalone;
  });

  it("is false in a normal browser tab", () => {
    expect(isStandalone()).toBe(false);
  });

  it("is true when display-mode is standalone", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    expect(isStandalone()).toBe(true);
  });

  it("is true when navigator.standalone is set (iOS)", () => {
    Object.defineProperty(window.navigator, "standalone", {
      value: true,
      configurable: true,
    });
    expect(isStandalone()).toBe(true);
  });
});

describe("beforeinstallprompt capture", () => {
  it("stashes the event, notifies subscribers, and clears on demand", () => {
    initInstallCapture();
    initInstallCapture(); // idempotent

    const onChange = vi.fn();
    const unsubscribe = onInstallPromptChange(onChange);

    expect(getDeferredPrompt()).toBeNull();

    const event = new Event("beforeinstallprompt");
    const preventDefault = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(getDeferredPrompt()).toBe(event);
    expect(onChange).toHaveBeenCalledTimes(1);

    clearDeferredPrompt();
    expect(getDeferredPrompt()).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(2);

    unsubscribe();
    clearDeferredPrompt();
    expect(onChange).toHaveBeenCalledTimes(2); // no longer notified
  });

  it("drops the stashed event when the app is installed", () => {
    initInstallCapture();
    window.dispatchEvent(new Event("beforeinstallprompt"));
    expect(getDeferredPrompt()).not.toBeNull();

    window.dispatchEvent(new Event("appinstalled"));
    expect(getDeferredPrompt()).toBeNull();
  });
});
