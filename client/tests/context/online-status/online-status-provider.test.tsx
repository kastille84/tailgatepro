import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.fn();
vi.mock("../../../src/context/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

import {
  OnlineStatusProvider,
  useOnlineStatus,
} from "../../../src/context/online-status";
import { tailgateDb } from "../../../src/utils/db/tailgateDb";
import {
  registerReplayHandler,
  resetReplayHandlers,
} from "../../../src/utils/db/replayRegistry";
import type { OutboxRow } from "../../../src/interfaces/sync";

const setOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    configurable: true,
  });
};

const seedOutboxRow = (overrides: Partial<OutboxRow> = {}) =>
  tailgateDb.outbox.add({
    id: "row-1",
    entity: "project",
    entityId: "project-1",
    op: "create",
    payload: {},
    status: "pending",
    attempts: 0,
    lastError: null,
    createdAt: "2026-09-13T00:00:00.000Z",
    syncedAt: null,
    ...overrides,
  });

const Probe = () => {
  const ctx = useOnlineStatus();
  return (
    <div>
      <span data-testid="isOnline">{String(ctx.isOnline)}</span>
      <span data-testid="pendingCount">{ctx.pendingCount}</span>
      <button type="button" onClick={ctx.retryNow}>
        retry
      </button>
    </div>
  );
};

const renderProvider = () =>
  render(
    <OnlineStatusProvider>
      <Probe />
    </OnlineStatusProvider>,
  );

beforeEach(() => {
  setOnline(true);
  mockUseAuth.mockReturnValue({ session: { access_token: "token-123" } });
});

afterEach(async () => {
  await tailgateDb.outbox.clear();
  resetReplayHandlers();
});

describe("OnlineStatusProvider", () => {
  it("seeds isOnline from navigator.onLine", () => {
    renderProvider();
    expect(screen.getByTestId("isOnline").textContent).toBe("true");
  });

  it("flips isOnline on the online/offline window events", () => {
    renderProvider();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByTestId("isOnline").textContent).toBe("false");

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.getByTestId("isOnline").textContent).toBe("true");
  });

  it("reports pendingCount from the outbox, refreshed after boot's stuck-row reset", async () => {
    await seedOutboxRow();
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("pendingCount").textContent).toBe("1"),
    );
  });

  it("resets a row stuck syncing from a previous session, then counts it as pending", async () => {
    await seedOutboxRow({ status: "syncing" });
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("pendingCount").textContent).toBe("1"),
    );
    expect((await tailgateDb.outbox.get("row-1"))?.status).toBe("pending");
  });

  it("flushes and updates pendingCount when the online event fires", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registerReplayHandler("project", handler);
    await seedOutboxRow();
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("pendingCount").textContent).toBe("1"),
    );

    await act(async () => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByTestId("pendingCount").textContent).toBe("0"),
    );
    expect(handler).toHaveBeenCalledWith("token-123", expect.anything());
  });

  it("retryNow() flushes with the current session's token", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registerReplayHandler("project", handler);
    await seedOutboxRow();
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("pendingCount").textContent).toBe("1"),
    );

    await act(async () => {
      screen.getByRole("button", { name: "retry" }).click();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByTestId("pendingCount").textContent).toBe("0"),
    );
  });

  it("retryNow() no-ops without a signed-in session", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    const handler = vi.fn().mockResolvedValue(undefined);
    registerReplayHandler("project", handler);
    await seedOutboxRow();
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("pendingCount").textContent).toBe("1"),
    );

    await act(async () => {
      screen.getByRole("button", { name: "retry" }).click();
      await Promise.resolve();
    });

    expect(handler).not.toHaveBeenCalled();
    expect(screen.getByTestId("pendingCount").textContent).toBe("1");
  });

  it("throws when useOnlineStatus is used outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      /within an <OnlineStatusProvider/,
    );
    spy.mockRestore();
  });
});
