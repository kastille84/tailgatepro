import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLandscapeFullscreen } from "../../../src/ui_comps/signature-pad/useLandscapeFullscreen";

const setFullscreenElement = (value: Element | null) =>
  Object.defineProperty(document, "fullscreenElement", { value, configurable: true });

afterEach(() => {
  vi.unstubAllGlobals();
  setFullscreenElement(null);
  // @ts-expect-error -- remove the per-test stubs
  delete document.documentElement.requestFullscreen;
  // @ts-expect-error -- remove the per-test stubs
  delete document.exitFullscreen;
});

describe("useLandscapeFullscreen", () => {
  it("does nothing while inactive", () => {
    const requestFullscreen = vi.fn();
    document.documentElement.requestFullscreen = requestFullscreen;

    renderHook(() => useLandscapeFullscreen(false));

    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it("requests fullscreen and a landscape lock, then releases both on cleanup", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    const lock = vi.fn().mockResolvedValue(undefined);
    const unlock = vi.fn();
    document.documentElement.requestFullscreen = requestFullscreen;
    document.exitFullscreen = exitFullscreen;
    vi.stubGlobal("screen", { orientation: { lock, unlock } });

    const { unmount } = renderHook(() => useLandscapeFullscreen(true));
    await waitFor(() => expect(lock).toHaveBeenCalledWith("landscape"));
    expect(requestFullscreen).toHaveBeenCalled();

    setFullscreenElement(document.documentElement);
    unmount();
    expect(unlock).toHaveBeenCalled();
    expect(exitFullscreen).toHaveBeenCalled();
  });

  it("ignores a rejected exitFullscreen", async () => {
    document.exitFullscreen = vi.fn().mockRejectedValue(new Error("not fullscreen"));
    vi.stubGlobal("screen", { orientation: { lock: vi.fn(), unlock: vi.fn() } });
    const { unmount } = renderHook(() => useLandscapeFullscreen(true));

    setFullscreenElement(document.documentElement);
    unmount();

    await waitFor(() => expect(document.exitFullscreen).toHaveBeenCalled());
  });

  it("skips requestFullscreen when already fullscreen or unsupported, and swallows a rejected lock", async () => {
    const lock = vi.fn().mockRejectedValue(new Error("NotSupportedError"));
    vi.stubGlobal("screen", { orientation: { lock } });
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined);
    setFullscreenElement(document.documentElement);

    const { unmount } = renderHook(() => useLandscapeFullscreen(true));
    await waitFor(() => expect(lock).toHaveBeenCalled());
    // orientation.unlock is missing here -- cleanup must not throw
    expect(() => unmount()).not.toThrow();
  });

  it("works when screen.orientation is missing entirely (iOS Safari)", async () => {
    vi.stubGlobal("screen", {});
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = requestFullscreen;

    const { unmount } = renderHook(() => useLandscapeFullscreen(true));
    await waitFor(() => expect(requestFullscreen).toHaveBeenCalled());

    expect(() => unmount()).not.toThrow();
  });

  it("swallows an unlock that throws because no lock was acquired", () => {
    vi.stubGlobal("screen", {
      orientation: {
        lock: vi.fn().mockResolvedValue(undefined),
        unlock: vi.fn(() => {
          throw new Error("InvalidStateError");
        }),
      },
    });
    const { unmount } = renderHook(() => useLandscapeFullscreen(true));

    expect(() => unmount()).not.toThrow();
  });
});
