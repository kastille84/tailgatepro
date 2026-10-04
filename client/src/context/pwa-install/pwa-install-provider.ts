// src/context/pwa-install/pwa-install-provider.ts
import React, { useCallback, useEffect, useState, type ReactNode } from "react";
import toast from "react-hot-toast";

import { INSTALLED_TOAST } from "../../data/installInstructions";
import {
  clearDeferredPrompt,
  detectPlatform,
  getDeferredPrompt,
  getInstallability,
  isStandalone,
  onInstallPromptChange,
} from "../../utils/pwa";
import { PwaInstallContext } from "./pwa-install-context";

const DISMISS_KEY = "tp.pwa-install.dismissed";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Read the dismissal timestamp; treat a missing/old/blocked value as "not
 *  dismissed". Safari private mode throws on any storage access. */
const readWasDismissed = (): boolean => {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(JSON.parse(raw)?.dismissedAt);
    return (
      Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_TTL_MS
    );
  } catch {
    return false;
  }
};

const writeDismissed = (value: boolean): void => {
  try {
    if (value) {
      window.localStorage.setItem(
        DISMISS_KEY,
        JSON.stringify({ dismissedAt: Date.now() }),
      );
    } else {
      window.localStorage.removeItem(DISMISS_KEY);
    }
  } catch {
    /* storage unavailable — the in-memory state still updates */
  }
};

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const platform = detectPlatform();
  const installability = getInstallability(platform);

  const [isInstalled, setIsInstalled] = useState<boolean>(isStandalone);
  const [canPrompt, setCanPrompt] = useState<boolean>(
    () => getDeferredPrompt() !== null,
  );
  const [wasDismissed, setWasDismissed] = useState<boolean>(readWasDismissed);

  useEffect(() => {
    // The stashed prompt may arrive (or be cleared) after mount.
    const unsubscribe = onInstallPromptChange(() => {
      setCanPrompt(getDeferredPrompt() !== null);
    });

    const handleInstalled = () => {
      setIsInstalled(true);
      setCanPrompt(false);
      toast.success(INSTALLED_TOAST);
    };
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      unsubscribe();
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<
    "accepted" | "dismissed" | "unavailable"
  > => {
    const event = getDeferredPrompt();
    if (!event) return "unavailable";
    await event.prompt();
    const { outcome } = await event.userChoice;
    clearDeferredPrompt();
    return outcome;
  }, []);

  const dismiss = useCallback(() => {
    writeDismissed(true);
    setWasDismissed(true);
  }, []);

  const resetDismissed = useCallback(() => {
    writeDismissed(false);
    setWasDismissed(false);
  }, []);

  return React.createElement(
    PwaInstallContext.Provider,
    {
      value: {
        isStandalone: isInstalled,
        canPrompt,
        platform,
        installability,
        wasDismissed,
        promptInstall,
        dismiss,
        resetDismissed,
      },
    },
    children,
  );
}
