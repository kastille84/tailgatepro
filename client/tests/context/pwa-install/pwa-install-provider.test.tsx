import React, { useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import toast from "react-hot-toast";
import {
  PwaInstallProvider,
  usePwaInstall,
} from "../../../src/context/pwa-install";
import {
  initInstallCapture,
  resetInstallCapture,
} from "../../../src/utils/pwa";
import type { BeforeInstallPromptEvent } from "../../../src/interfaces/pwa";

const DISMISS_KEY = "tp.pwa-install.dismissed";

const Probe = () => {
  const ctx = usePwaInstall();
  const [outcome, setOutcome] = useState("");
  return (
    <div>
      <span data-testid="standalone">{String(ctx.isStandalone)}</span>
      <span data-testid="canPrompt">{String(ctx.canPrompt)}</span>
      <span data-testid="dismissed">{String(ctx.wasDismissed)}</span>
      <span data-testid="platform">{ctx.platform}</span>
      <span data-testid="outcome">{outcome}</span>
      <button
        type="button"
        onClick={async () => setOutcome(await ctx.promptInstall())}
      >
        prompt
      </button>
      <button type="button" onClick={ctx.dismiss}>
        dismiss
      </button>
      <button type="button" onClick={ctx.resetDismissed}>
        reset
      </button>
    </div>
  );
};

const renderProvider = () =>
  render(
    <PwaInstallProvider>
      <Probe />
    </PwaInstallProvider>,
  );

const makeInstallEvent = (): BeforeInstallPromptEvent => {
  const event = new Event("beforeinstallprompt") as BeforeInstallPromptEvent;
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
  });
  return event;
};

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(toast.success).mockClear();
  initInstallCapture();
});

afterEach(() => {
  resetInstallCapture();
});

describe("PwaInstallProvider", () => {
  it("seeds sensible defaults in a normal tab", () => {
    renderProvider();
    expect(screen.getByTestId("standalone").textContent).toBe("false");
    expect(screen.getByTestId("canPrompt").textContent).toBe("false");
    expect(screen.getByTestId("dismissed").textContent).toBe("false");
  });

  it("flips canPrompt when a beforeinstallprompt event is captured", () => {
    renderProvider();
    act(() => {
      window.dispatchEvent(makeInstallEvent());
    });
    expect(screen.getByTestId("canPrompt").textContent).toBe("true");
  });

  it("promptInstall() drives the stashed event and returns its outcome", async () => {
    const event = makeInstallEvent();
    renderProvider();
    act(() => {
      window.dispatchEvent(event);
    });

    await act(async () => {
      screen.getByRole("button", { name: "prompt" }).click();
    });

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("outcome").textContent).toBe("accepted");
    expect(screen.getByTestId("canPrompt").textContent).toBe("false");
  });

  it("promptInstall() resolves 'unavailable' with no stashed event", async () => {
    renderProvider();
    await act(async () => {
      screen.getByRole("button", { name: "prompt" }).click();
    });
    expect(screen.getByTestId("outcome").textContent).toBe("unavailable");
  });

  it("announces installation and hides install UI on appinstalled", () => {
    renderProvider();
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("standalone").textContent).toBe("true");
  });

  it("persists dismissal and can reset it", () => {
    renderProvider();

    act(() => {
      screen.getByRole("button", { name: "dismiss" }).click();
    });
    expect(screen.getByTestId("dismissed").textContent).toBe("true");
    expect(window.localStorage.getItem(DISMISS_KEY)).toContain("dismissedAt");

    act(() => {
      screen.getByRole("button", { name: "reset" }).click();
    });
    expect(screen.getByTestId("dismissed").textContent).toBe("false");
    expect(window.localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it("seeds wasDismissed from a recent stored dismissal", () => {
    window.localStorage.setItem(
      DISMISS_KEY,
      JSON.stringify({ dismissedAt: Date.now() }),
    );
    renderProvider();
    expect(screen.getByTestId("dismissed").textContent).toBe("true");
  });

  it("ignores a dismissal older than the 7-day TTL", () => {
    window.localStorage.setItem(
      DISMISS_KEY,
      JSON.stringify({ dismissedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 }),
    );
    renderProvider();
    expect(screen.getByTestId("dismissed").textContent).toBe("false");
  });

  it("throws when usePwaInstall is used outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/within a <PwaInstallProvider/);
    spy.mockRestore();
  });
});
