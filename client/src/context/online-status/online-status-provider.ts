// src/context/online-status/online-status-provider.ts
import React, { useCallback, useEffect, useState, type ReactNode } from "react";

import { useAuth } from "../auth";
import {
  flush,
  getPendingCount,
  resetStuckSyncingRows,
} from "../../utils/db/outbox";
import { createReplayer } from "../../utils/db/replayRegistry";
import { OnlineStatusContext } from "./online-status-context";

// The browser `online` event doesn't fire reliably on every mobile network
// transition, so this is a backstop: re-check periodically too.
const POLL_INTERVAL_MS = 30_000;

export function OnlineStatusProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingCount, setPendingCount] = useState<number>(0);

  const refreshPendingCount = useCallback(() => {
    getPendingCount().then(setPendingCount);
  }, []);

  const runFlush = useCallback(() => {
    if (!session) return;
    flush(createReplayer(session.access_token)).then(refreshPendingCount);
  }, [session, refreshPendingCount]);

  // A row left `syncing` from a previous session is stale — reset it once at
  // boot, before anything else can flush.
  useEffect(() => {
    resetStuckSyncingRows().then(refreshPendingCount);
  }, [refreshPendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      runFlush();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [runFlush]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (navigator.onLine) runFlush();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [runFlush]);

  const retryNow = useCallback(() => {
    runFlush();
  }, [runFlush]);

  return React.createElement(
    OnlineStatusContext.Provider,
    { value: { isOnline, pendingCount, retryNow } },
    children,
  );
}
