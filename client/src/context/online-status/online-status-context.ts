// src/context/online-status/online-status-context.ts
import { createContext } from "react";

export interface OnlineStatusContextType {
  /** Seeded from `navigator.onLine`, kept in sync with the `online`/`offline`
   *  window events. */
  isOnline: boolean;
  /** Outbox rows still waiting to sync (`pending` + `failed`). */
  pendingCount: number;
  /** Runs a flush now, regardless of the `online`/`offline` event history —
   *  the "Retry now" affordance. No-ops without a signed-in session. */
  retryNow: () => void;
}

// Kept module-private (not re-exported from index.ts), matching context/auth.
export const OnlineStatusContext = createContext<
  OnlineStatusContextType | undefined
>(undefined);
