import { useOnlineStatus } from "../../context/online-status";
import { Button } from "../button";
import { StyledBanner } from "./styles";

/**
 * A slim, non-blocking bar that surfaces the offline write queue: shown
 * while offline, and while online with rows still waiting to sync (e.g.
 * after a failed attempt). Hidden entirely once online with nothing queued.
 * See `docs/offline-sync-design.md`.
 */
export const SyncStatusBanner = () => {
  const { isOnline, pendingCount, retryNow } = useOnlineStatus();

  if (isOnline && pendingCount === 0) return null;

  return (
    <StyledBanner role="status" aria-live="polite">
      {!isOnline && (
        <span>
          You&rsquo;re offline. Changes save on this device and sync once
          you&rsquo;re back online.
          {pendingCount > 0 &&
            ` (${pendingCount} waiting)`}
        </span>
      )}
      {isOnline && pendingCount > 0 && (
        <>
          <span>
            {pendingCount} change{pendingCount === 1 ? "" : "s"} waiting to
            sync.
          </span>
          <Button variant="primary" size="sm" onClick={retryNow}>
            Retry now
          </Button>
        </>
      )}
    </StyledBanner>
  );
};
