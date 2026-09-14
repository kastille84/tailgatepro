// src/context/online-status/use-online-status.ts
import { use } from "react";

import { OnlineStatusContext } from "./online-status-context";

export function useOnlineStatus() {
  const context = use(OnlineStatusContext);

  if (context === undefined) {
    throw new Error(
      "useOnlineStatus must be used strictly within an <OnlineStatusProvider /> environment.",
    );
  }

  return context;
}
