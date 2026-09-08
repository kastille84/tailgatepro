// src/context/pwa-install/pwa-install-context.ts
import { createContext } from "react";

import type { Installability, InstallPlatform } from "../../interfaces/pwa";

export interface PwaInstallState {
  /** The page is already running as an installed app — hide all install UI. */
  isStandalone: boolean;
  /** A `beforeinstallprompt` event is stashed; `promptInstall()` can fire the
   *  native dialog. */
  canPrompt: boolean;
  platform: InstallPlatform;
  installability: Installability;
  /** The user dismissed an install nudge within the last 7 days. Reserved for a
   *  future banner — the Navbar button ignores it. */
  wasDismissed: boolean;
}

export interface PwaInstallContextType extends PwaInstallState {
  /** Fire the native install dialog. Resolves `"unavailable"` when there is no
   *  stashed prompt (the caller should show instructions instead). */
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  dismiss: () => void;
  resetDismissed: () => void;
}

// Kept module-private (not re-exported from index.ts), matching context/auth.
export const PwaInstallContext = createContext<
  PwaInstallContextType | undefined
>(undefined);
