// src/context/pwa-install/use-pwa-install.ts
import { use } from "react";

import { PwaInstallContext } from "./pwa-install-context";

export function usePwaInstall() {
  const context = use(PwaInstallContext);

  if (context === undefined) {
    throw new Error(
      "usePwaInstall must be used strictly within a <PwaInstallProvider /> environment.",
    );
  }

  return context;
}
